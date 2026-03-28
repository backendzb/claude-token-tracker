#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { calculateCost } = require('./data-loader');

const LOGS_DIR = path.join(os.homedir(), '.claude', 'usage-logs');

// ANSI 颜色
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGray: '\x1b[100m',
};

function fmt(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function costColor(cost) {
  if (cost >= 0.5) return C.red;
  if (cost >= 0.1) return C.yellow;
  return C.green;
}

function pad(str, len, align = 'right') {
  str = String(str);
  if (align === 'right') return str.padStart(len);
  return str.padEnd(len);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 1, summary: false, session: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      opts.days = parseInt(args[i + 1], 10) || 1;
      i++;
    } else if (args[i] === '--summary') {
      opts.summary = true;
    } else if (args[i] === '--session' && args[i + 1]) {
      opts.session = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
${C.bold}Claude Code Token 用量查看器${C.reset}

用法: node view-usage.js [选项]

选项:
  --days N       显示最近 N 天的数据（默认: 1，即今天）
  --summary      仅显示汇总，不显示明细
  --session ID   按 session ID 过滤
  -h, --help     显示帮助
`);
      process.exit(0);
    }
  }
  return opts;
}

function loadLogs(days, sessionFilter) {
  const records = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const logFile = path.join(LOGS_DIR, `${dateStr}.jsonl`);

    if (!fs.existsSync(logFile)) continue;

    const content = fs.readFileSync(logFile, 'utf8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (sessionFilter && rec.session_id !== sessionFilter) continue;
        // 用 data-loader 的分层计价重新算费用，覆盖日志中可能不准确的旧值
        const usage = {
          input_tokens: rec.input_tokens || 0,
          output_tokens: rec.output_tokens || 0,
          cache_creation_input_tokens: rec.cache_creation_input_tokens || 0,
          cache_read_input_tokens: rec.cache_read_input_tokens || 0,
        };
        rec.cost_usd = calculateCost(usage, rec.model, 'standard');
        records.push(rec);
      } catch (_) {}
    }
  }

  // 按时间排序
  records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return records;
}

function printDetail(records) {
  if (records.length === 0) {
    console.log(`\n${C.dim}  暂无数据。请确认 hook 已安装并发送过消息。${C.reset}\n`);
    return;
  }

  // 表头
  const header = `  ${pad('#', 4, 'right')}  ${pad('时间', 8, 'left')}  ${pad('模型', 12, 'left')}  ${pad('Input', 8)}  ${pad('Cache写', 8)}  ${pad('Cache读', 8)}  ${pad('Output', 8)}  ${pad('费用', 9)}  预览`;
  console.log(`\n${C.bold}${C.cyan}${header}${C.reset}`);
  console.log(`${C.dim}  ${'─'.repeat(100)}${C.reset}`);

  let idx = 0;
  for (const rec of records) {
    idx++;
    const time = rec.timestamp ? new Date(rec.timestamp).toTimeString().slice(0, 8) : '??:??:??';
    const model = (rec.model || 'unknown').replace('claude-', '').slice(0, 12);
    const cc = costColor(rec.cost_usd);
    const preview = (rec.content_preview || '').slice(0, 30);

    const line = `  ${pad(idx, 4)}  ${pad(time, 8, 'left')}  ${pad(model, 12, 'left')}  ${pad(fmt(rec.input_tokens), 8)}  ${pad(fmt(rec.cache_creation_input_tokens), 8)}  ${pad(fmt(rec.cache_read_input_tokens), 8)}  ${pad(fmt(rec.output_tokens), 8)}  ${cc}${pad('$' + rec.cost_usd.toFixed(4), 9)}${C.reset}  ${C.dim}${preview}${C.reset}`;
    console.log(line);
  }

  console.log(`${C.dim}  ${'─'.repeat(100)}${C.reset}`);
}

function printSummary(records) {
  if (records.length === 0) return;

  const totals = {
    input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0,
  };

  const modelBreakdown = {};

  for (const rec of records) {
    totals.input += rec.input_tokens || 0;
    totals.output += rec.output_tokens || 0;
    totals.cacheWrite += rec.cache_creation_input_tokens || 0;
    totals.cacheRead += rec.cache_read_input_tokens || 0;
    totals.cost += rec.cost_usd || 0;

    const model = rec.model || 'unknown';
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = { requests: 0, cost: 0, input: 0, output: 0 };
    }
    modelBreakdown[model].requests++;
    modelBreakdown[model].cost += rec.cost_usd || 0;
    modelBreakdown[model].input += rec.input_tokens || 0;
    modelBreakdown[model].output += rec.output_tokens || 0;
  }

  console.log(`\n${C.bold}  汇总${C.reset}`);
  console.log(`${C.dim}  ${'─'.repeat(60)}${C.reset}`);
  console.log(`  请求数:       ${C.bold}${fmt(records.length)}${C.reset}`);
  console.log(`  Input:        ${C.bold}${fmt(totals.input)}${C.reset} tokens`);
  console.log(`  Output:       ${C.bold}${fmt(totals.output)}${C.reset} tokens`);
  console.log(`  Cache 写入:   ${C.bold}${fmt(totals.cacheWrite)}${C.reset} tokens`);
  console.log(`  Cache 读取:   ${C.bold}${fmt(totals.cacheRead)}${C.reset} tokens`);
  console.log(`  总 tokens:    ${C.bold}${fmt(totals.input + totals.output + totals.cacheWrite + totals.cacheRead)}${C.reset}`);
  console.log(`  等价 API 费用: ${C.bold}${costColor(totals.cost)}$${totals.cost.toFixed(4)}${C.reset}`);

  // 按模型分组
  const models = Object.keys(modelBreakdown);
  if (models.length > 1) {
    console.log(`\n${C.bold}  按模型分组${C.reset}`);
    console.log(`${C.dim}  ${'─'.repeat(60)}${C.reset}`);
    for (const model of models) {
      const m = modelBreakdown[model];
      console.log(`  ${model}: ${m.requests} 请求, ${costColor(m.cost)}$${m.cost.toFixed(4)}${C.reset}`);
    }
  }

  console.log('');
}

function main() {
  const opts = parseArgs();

  if (!fs.existsSync(LOGS_DIR)) {
    console.log(`\n${C.dim}  日志目录不存在: ${LOGS_DIR}${C.reset}`);
    console.log(`${C.dim}  请先安装 hook: node install.js${C.reset}\n`);
    process.exit(0);
  }

  const records = loadLogs(opts.days, opts.session);

  const dateRange = opts.days === 1
    ? new Date().toISOString().slice(0, 10)
    : `最近 ${opts.days} 天`;

  console.log(`\n${C.bold}${C.cyan}  ══ Claude Code Token 用量报告 ── ${dateRange} ══${C.reset}`);

  if (!opts.summary) {
    printDetail(records);
  }

  printSummary(records);
}

main();
