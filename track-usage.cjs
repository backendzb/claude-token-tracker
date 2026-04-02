#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOGS_DIR = path.join(os.homedir(), '.claude', 'usage-logs');
const STATE_DIR = path.join(LOGS_DIR, '.state');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');

// Inline pricing (no external dependency)
const MODEL_PRICING = {
  'claude-opus-4-6': { input: 5e-6, output: 25e-6, cw: 6.25e-6, cr: 5e-7, fast: 6 },
  'claude-opus-4-5': { input: 5e-6, output: 25e-6, cw: 6.25e-6, cr: 5e-7 },
  'claude-opus-4-0': { input: 15e-6, output: 75e-6, cw: 18.75e-6, cr: 1.5e-6 },
  'claude-sonnet-4-6': { input: 3e-6, output: 15e-6, cw: 3.75e-6, cr: 3e-7 },
  'claude-sonnet-4-5': { input: 3e-6, output: 15e-6, cw: 3.75e-6, cr: 3e-7 },
  'claude-haiku-4-5': { input: 1e-6, output: 5e-6, cw: 1.25e-6, cr: 1e-7 },
  'claude-3-5-sonnet': { input: 3e-6, output: 15e-6, cw: 3.75e-6, cr: 3e-7 },
  'claude-3-5-haiku': { input: 8e-7, output: 4e-6, cw: 1e-6, cr: 8e-8 },
};

function calculateCost(usage, model, speed) {
  let p = MODEL_PRICING[model];
  if (!p) {
    for (const [k, v] of Object.entries(MODEL_PRICING)) {
      if (model.startsWith(k)) { p = v; break; }
    }
  }
  if (!p) return 0;
  let cost = (usage.input_tokens || 0) * p.input
    + (usage.output_tokens || 0) * p.output
    + (usage.cache_creation_input_tokens || 0) * p.cw
    + (usage.cache_read_input_tokens || 0) * p.cr;
  if (speed === 'fast' && p.fast) cost *= p.fast;
  return Math.round(cost * 10000) / 10000;
}

function getContentPreview(message) {
  if (!message || !message.content) return '';
  if (typeof message.content === 'string') return message.content.slice(0, 80);
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
    setTimeout(() => resolve(data), 2000);
  });
}

async function main() {
  try {
    const stdinData = await readStdin();
    if (!stdinData.trim()) process.exit(0);

    const hookInput = JSON.parse(stdinData);
    const { session_id, transcript_path } = hookInput;
    if (!transcript_path || !fs.existsSync(transcript_path)) process.exit(0);

    fs.mkdirSync(STATE_DIR, { recursive: true });

    const stateFile = path.join(STATE_DIR, `${session_id}.json`);
    let seenRequestIds = new Set();
    try {
      seenRequestIds = new Set(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
    } catch (_) {}

    const lines = fs.readFileSync(transcript_path, 'utf8').split('\n');
    const requestMap = new Map();
    for (const line of lines) {
      if (!line.trim() || !line.includes('"assistant"')) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant' && obj.message && obj.message.usage && obj.requestId) {
          requestMap.set(obj.requestId, obj);
        }
      } catch (_) {}
    }

    const newRequests = [];
    for (const [reqId, obj] of requestMap) {
      if (!seenRequestIds.has(reqId)) {
        newRequests.push(obj);
        seenRequestIds.add(reqId);
      }
    }

    if (newRequests.length === 0) process.exit(0);

    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(LOGS_DIR, `${today}.jsonl`);
    const logLines = [];
    for (const obj of newRequests) {
      const usage = obj.message.usage;
      const model = obj.message.model || 'unknown';
      const speed = usage.speed || 'standard';
      logLines.push(JSON.stringify({
        timestamp: obj.timestamp,
        session_id,
        request_id: obj.requestId,
        model,
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens || 0,
        cost_usd: calculateCost(usage, model, speed),
        content_preview: getContentPreview(obj.message),
      }));
    }

    fs.appendFileSync(logFile, logLines.join('\n') + '\n');

    const tmpState = stateFile + '.tmp';
    fs.writeFileSync(tmpState, JSON.stringify([...seenRequestIds]));
    fs.renameSync(tmpState, stateFile);
  } catch (err) {
    logError(String(err));
  }
  process.exit(0);
}

main();
