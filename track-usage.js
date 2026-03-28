#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { calculateCost } = require('./data-loader');

const LOGS_DIR = path.join(os.homedir(), '.claude', 'usage-logs');
const STATE_DIR = path.join(LOGS_DIR, '.state');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');


function getContentPreview(message) {
  if (!message || !message.content) return '';
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      return block.text.slice(0, 80).replace(/\n/g, ' ');
    }
  }
  return '';
}

function logError(err) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.appendFileSync(ERROR_LOG, `[${new Date().toISOString()}] ${err}\n`);
  } catch (_) {}
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    // 超时保护：2秒后强制返回
    setTimeout(() => resolve(data), 2000);
  });
}

async function main() {
  try {
    const stdinData = await readStdin();
    if (!stdinData.trim()) {
      process.exit(0);
    }

    const hookInput = JSON.parse(stdinData);
    const { session_id, transcript_path } = hookInput;

    if (!transcript_path || !fs.existsSync(transcript_path)) {
      process.exit(0);
    }

    // 确保目录存在
    fs.mkdirSync(STATE_DIR, { recursive: true });

    // 读取去重状态
    const stateFile = path.join(STATE_DIR, `${session_id}.json`);
    let seenRequestIds = new Set();
    try {
      const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      seenRequestIds = new Set(stateData);
    } catch (_) {}

    // 逐行解析 transcript，提取 assistant 消息
    const transcriptContent = fs.readFileSync(transcript_path, 'utf8');
    const lines = transcriptContent.split('\n');

    // 按 requestId 分组，每组取最后一条
    const requestMap = new Map(); // requestId -> {message, timestamp, requestId}
    for (const line of lines) {
      if (!line.trim()) continue;
      // 快速过滤：只解析包含 "assistant" 的行
      if (!line.includes('"type":"assistant"') && !line.includes('"type": "assistant"')) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant' && obj.message && obj.message.usage && obj.requestId) {
          requestMap.set(obj.requestId, obj);
        }
      } catch (_) {}
    }

    // 过滤出新请求
    const newRequests = [];
    for (const [reqId, obj] of requestMap) {
      if (!seenRequestIds.has(reqId)) {
        newRequests.push(obj);
        seenRequestIds.add(reqId);
      }
    }

    if (newRequests.length === 0) {
      process.exit(0);
    }

    // 写入日志
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(LOGS_DIR, `${today}.jsonl`);

    const logLines = [];
    for (const obj of newRequests) {
      const usage = obj.message.usage;
      const model = obj.message.model || 'unknown';
      const speed = usage.speed || 'standard';
      const cost = calculateCost(usage, model, speed);

      logLines.push(JSON.stringify({
        timestamp: obj.timestamp,
        session_id: session_id,
        request_id: obj.requestId,
        model: model,
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens || 0,
        cost_usd: cost,
        content_preview: getContentPreview(obj.message),
      }));
    }

    fs.appendFileSync(logFile, logLines.join('\n') + '\n');

    // 更新状态文件（原子写入）
    const tmpState = stateFile + '.tmp';
    fs.writeFileSync(tmpState, JSON.stringify([...seenRequestIds]));
    fs.renameSync(tmpState, stateFile);

  } catch (err) {
    logError(String(err));
  }
  process.exit(0);
}

main();
