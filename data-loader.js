'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// 数据缓存（TTL 10秒，避免同一刷新周期内重复加载）
const _cache = new Map(); // key -> { data, timestamp }
const CACHE_TTL_MS = 10000;

function getCached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data;
  return null;
}

function setCache(key, data) {
  _cache.set(key, { data, timestamp: Date.now() });
}

// 参考 ccusage 的路径查找逻辑
const USER_HOME = os.homedir();
const CLAUDE_PATHS = [
  path.join(USER_HOME, '.config', 'claude'),  // XDG
  path.join(USER_HOME, '.claude'),             // legacy
];

// 模型价格（per token）——完全来自 ccusage 内置的 LiteLLM 定价
// 注意：opus-4-6 (1M context) 价格远低于 opus-4 (200K context)
const DEFAULT_TIERED_THRESHOLD = 200000;

const MODEL_PRICING = {
  // Opus 4.6 (1M context) — $5/$25 per M
  'claude-opus-4-6': {
    input: 5e-6, output: 25e-6, cache_write: 6.25e-6, cache_read: 5e-7,
    input_above_200k: 1e-5, output_above_200k: 37.5e-6,
    cache_write_above_200k: 12.5e-6, cache_read_above_200k: 1e-6,
    fast_multiplier: 6,
  },
  'claude-opus-4-6-20260205': {
    input: 5e-6, output: 25e-6, cache_write: 6.25e-6, cache_read: 5e-7,
    input_above_200k: 1e-5, output_above_200k: 37.5e-6,
    cache_write_above_200k: 12.5e-6, cache_read_above_200k: 1e-6,
    fast_multiplier: 6,
  },
  // Opus 4.5 — $5/$25 per M
  'claude-opus-4-5': {
    input: 5e-6, output: 25e-6, cache_write: 6.25e-6, cache_read: 5e-7,
  },
  'claude-opus-4-5-20251101': {
    input: 5e-6, output: 25e-6, cache_write: 6.25e-6, cache_read: 5e-7,
  },
  // Opus 4 (200K context) — $15/$75 per M
  'claude-4-opus-20250514': {
    input: 15e-6, output: 75e-6, cache_write: 18.75e-6, cache_read: 1.5e-6,
  },
  // Sonnet 4.6 — $3/$15 per M
  'claude-sonnet-4-6': {
    input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
    input_above_200k: 6e-6, output_above_200k: 22.5e-6,
    cache_write_above_200k: 7.5e-6, cache_read_above_200k: 6e-7,
  },
  // Sonnet 4.5 — $3/$15 per M
  'claude-sonnet-4-5': {
    input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
    input_above_200k: 6e-6, output_above_200k: 22.5e-6,
    cache_write_above_200k: 7.5e-6, cache_read_above_200k: 6e-7,
  },
  'claude-sonnet-4-5-20250514': {
    input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
    input_above_200k: 6e-6, output_above_200k: 22.5e-6,
    cache_write_above_200k: 7.5e-6, cache_read_above_200k: 6e-7,
  },
  'claude-sonnet-4-20250514': {
    input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
    input_above_200k: 6e-6, output_above_200k: 22.5e-6,
    cache_write_above_200k: 7.5e-6, cache_read_above_200k: 6e-7,
  },
  // Haiku 4.5 — $1/$5 per M
  'claude-haiku-4-5-20251001': {
    input: 1e-6, output: 5e-6, cache_write: 1.25e-6, cache_read: 1e-7,
  },
  'claude-haiku-4-5': {
    input: 1e-6, output: 5e-6, cache_write: 1.25e-6, cache_read: 1e-7,
  },
  // 3.5 系列
  'claude-3-5-sonnet': {
    input: 3e-6, output: 15e-6, cache_write: 3.75e-6, cache_read: 3e-7,
  },
  'claude-3-5-haiku': {
    input: 8e-7, output: 4e-6, cache_write: 1e-6, cache_read: 8e-8,
  },
};

function getPricing(modelName) {
  if (!modelName || modelName === '<synthetic>') return null;
  // 精确匹配
  if (MODEL_PRICING[modelName]) return MODEL_PRICING[modelName];
  // 前缀匹配
  for (const [key, val] of Object.entries(MODEL_PRICING)) {
    if (modelName.startsWith(key)) return val;
  }
  // 模糊匹配
  const m = modelName.toLowerCase();
  if (m.includes('haiku')) return MODEL_PRICING['claude-haiku-4-5'];
  if (m.includes('sonnet')) return MODEL_PRICING['claude-sonnet-4-6'];
  if (m.includes('opus-4-6') || m.includes('opus-4-5')) return MODEL_PRICING['claude-opus-4-6'];
  if (m.includes('opus')) return MODEL_PRICING['claude-4-opus-20250514'];
  return MODEL_PRICING['claude-opus-4-6'];
}

// 参考 ccusage: calculateTieredCost + calculateCostFromPricing
function calculateTieredCost(totalTokens, basePrice, tieredPrice, threshold) {
  if (!totalTokens || totalTokens <= 0 || basePrice == null) return 0;
  if (totalTokens > threshold && tieredPrice != null) {
    const below = Math.min(totalTokens, threshold);
    return below * basePrice + Math.max(0, totalTokens - threshold) * tieredPrice;
  }
  return totalTokens * basePrice;
}

function calculateCost(usage, modelName, speed) {
  const pricing = getPricing(modelName);
  if (!pricing) return 0;
  const threshold = DEFAULT_TIERED_THRESHOLD;
  const input = calculateTieredCost(usage.input_tokens, pricing.input, pricing.input_above_200k, threshold);
  const output = calculateTieredCost(usage.output_tokens, pricing.output, pricing.output_above_200k, threshold);
  const cacheWrite = calculateTieredCost(usage.cache_creation_input_tokens, pricing.cache_write, pricing.cache_write_above_200k, threshold);
  const cacheRead = calculateTieredCost(usage.cache_read_input_tokens, pricing.cache_read, pricing.cache_read_above_200k, threshold);
  let cost = input + output + cacheWrite + cacheRead;
  // fast 模式费用倍数
  if (speed === 'fast' && pricing.fast_multiplier) {
    cost *= pricing.fast_multiplier;
  }
  return cost;
}

// 参考 ccusage: createUniqueHash
function createUniqueHash(data) {
  const messageId = data.message?.id;
  const requestId = data.requestId;
  if (messageId == null || requestId == null) return null;
  return `${messageId}:${requestId}`;
}

// 参考 ccusage: extractProjectFromPath
function extractProjectFromPath(filePath) {
  const segments = filePath.replace(/[/\\]/g, path.sep).split(path.sep);
  const idx = segments.findIndex(s => s === 'projects');
  if (idx === -1 || idx + 1 >= segments.length) return 'unknown';
  const name = segments[idx + 1];
  return (name && name.trim()) || 'unknown';
}

// 查找所有 JSONL transcript 文件
function getClaudePaths() {
  const valid = [];
  for (const p of CLAUDE_PATHS) {
    const projectsDir = path.join(p, 'projects');
    if (fs.existsSync(projectsDir)) valid.push(p);
  }
  return valid;
}

async function globJsonlFiles(claudePaths) {
  const files = [];
  for (const cp of claudePaths) {
    const projectsDir = path.join(cp, 'projects');
    if (!fs.existsSync(projectsDir)) continue;
    await walkDir(projectsDir, files);
  }
  return files;
}

async function walkDir(dir, result) {
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, result);
    } else if (entry.name.endsWith('.jsonl')) {
      result.push(fullPath);
    }
  }
}

// 逐行处理 JSONL
async function processJsonlFile(filePath, callback) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let parseErrors = 0;
    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        callback(JSON.parse(line));
      } catch { parseErrors++; }
    });
    rl.on('close', () => {
      if (parseErrors > 0) console.warn(`[data-loader] ${parseErrors} parse errors in ${filePath}`);
      resolve();
    });
    rl.on('error', (err) => {
      console.error(`[data-loader] Stream error reading ${filePath}:`, err.message);
      resolve();
    });
  });
}

// 提取完整内容（文本 + thinking + 工具调用摘要）
function getFullContent(message) {
  if (!message?.content) return '';
  const parts = [];
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text);
    } else if (block.type === 'thinking') {
      if (block.thinking) parts.push('[Thinking]\n' + block.thinking);
      else parts.push('[Thinking]');
    } else if (block.type === 'tool_use') {
      const hint = block.input?.command || block.input?.file_path || block.input?.pattern || '';
      parts.push(`[${block.name}${hint ? ': ' + hint : ''}]`);
    }
  }
  return parts.join('\n');
}

// 提取内容预览（截断用于表格显示）
function getContentPreview(message) {
  if (!message?.content) return '';
  // 优先找 text block
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      return block.text.slice(0, 100).replace(/\n/g, ' ');
    }
  }
  // 没有 text block，尝试其他类型
  for (const block of message.content) {
    if (block.type === 'thinking' && block.thinking) {
      return '[Thinking] ' + block.thinking.slice(0, 80).replace(/\n/g, ' ');
    }
    if (block.type === 'tool_use') {
      return `[${block.name}]`;
    }
  }
  return '';
}

/**
 * 加载所有用量数据
 * @param {Object} options - { since, until, project }
 * @returns {Promise<Array>} 每条记录包含完整的 token 和费用信息
 */
async function loadAllUsageData(options = {}) {
  const cacheKey = 'usage:' + JSON.stringify(options);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const claudePaths = getClaudePaths();
  if (claudePaths.length === 0) return [];

  const jsonlFiles = await globJsonlFiles(claudePaths);
  if (jsonlFiles.length === 0) return [];

  // 参考 ccusage：用 messageId:requestId 去重
  const processedHashes = new Set();
  const allEntries = [];

  for (const file of jsonlFiles) {
    const project = extractProjectFromPath(file);

    // 按项目过滤
    if (options.project && project !== options.project) continue;

    let lastUserQuery = '';

    await processJsonlFile(file, (obj) => {
      // 追踪用户的文本提问（非 tool_result）
      if (obj.type === 'user' && typeof obj.message?.content === 'string') {
        lastUserQuery = obj.message.content;
        return;
      }

      // 只处理 assistant 消息（含 usage）
      if (obj.type !== 'assistant') return;
      if (!obj.message?.usage) return;

      // sessionId 过滤（提前跳过不匹配的记录）
      if (options.sessionId && obj.sessionId !== options.sessionId) return;

      // 去重
      const hash = createUniqueHash(obj);
      if (hash != null) {
        if (processedHashes.has(hash)) return;
        processedHashes.add(hash);
      }

      // 日期过滤
      const ts = obj.timestamp;
      if (options.since && ts < options.since) return;
      if (options.until && ts > options.until) return;

      const usage = obj.message.usage;
      const model = obj.message.model || 'unknown';
      // 跳过 <synthetic> 模型（ccusage 也跳过）
      if (model === '<synthetic>') return;
      // 参考 ccusage: auto 模式 - 优先用 costUSD，否则计算
      const speed = usage.speed || 'standard';
      const cost = obj.costUSD != null ? obj.costUSD : calculateCost(usage, model, speed);

      allEntries.push({
        timestamp: ts,
        sessionId: obj.sessionId || '',
        requestId: obj.requestId || '',
        messageId: obj.message.id || '',
        model,
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens || 0,
        speed: usage.speed || 'standard',
        cost_usd: cost,
        content: getFullContent(obj.message),
        content_preview: getContentPreview(obj.message),
        user_query: lastUserQuery,
        project,
        cwd: obj.cwd || '',
      });
    });
  }

  // 按时间排序（ISO 8601 可直接字符串比较）
  allEntries.sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  setCache(cacheKey, allEntries);
  return allEntries;
}

/**
 * 获取所有项目名列表
 */
async function getProjectList() {
  const claudePaths = getClaudePaths();
  const files = await globJsonlFiles(claudePaths);
  const projects = new Set();
  for (const f of files) {
    projects.add(extractProjectFromPath(f));
  }
  return [...projects].sort();
}

/**
 * 会话列表：按 sessionId 分组汇总
 */
async function loadSessionList(options = {}) {
  const records = await loadAllUsageData(options);
  const map = new Map();
  for (const r of records) {
    if (!r.sessionId) continue;
    let s = map.get(r.sessionId);
    if (!s) {
      s = {
        sessionId: r.sessionId, project: r.project, cwd: r.cwd,
        startTime: r.timestamp, endTime: r.timestamp,
        requestCount: 0, totalCost: 0,
        input_tokens: 0, output_tokens: 0,
        cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        models: new Set(),
      };
      map.set(r.sessionId, s);
    }
    s.endTime = r.timestamp;
    s.requestCount++;
    s.totalCost += r.cost_usd;
    s.input_tokens += r.input_tokens;
    s.output_tokens += r.output_tokens;
    s.cache_creation_input_tokens += r.cache_creation_input_tokens;
    s.cache_read_input_tokens += r.cache_read_input_tokens;
    s.models.add(r.model);
  }
  const list = [...map.values()].map(s => ({
    ...s,
    totalTokens: s.input_tokens + s.output_tokens + s.cache_creation_input_tokens + s.cache_read_input_tokens,
    models: [...s.models],
  }));
  list.sort((a, b) => b.startTime < a.startTime ? -1 : b.startTime > a.startTime ? 1 : 0);
  return list;
}

/**
 * 会话详情：返回某 session 内所有请求
 */
async function loadSessionDetail(sessionId) {
  return await loadAllUsageData({ sessionId });
}

/**
 * 5 小时窗口分析（参考 ccusage identifySessionBlocks）
 */
const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

async function loadBucketData(options = {}) {
  const records = await loadAllUsageData(options);
  if (records.length === 0) return [];

  const sorted = [...records].sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  const blocks = [];
  let blockStart = null;
  let blockEntries = [];

  function pushBlock() {
    if (blockEntries.length === 0) return;
    const first = blockEntries[0];
    const last = blockEntries[blockEntries.length - 1];
    const startTime = blockStart.toISOString();
    const endTime = new Date(blockStart.getTime() + SESSION_DURATION_MS).toISOString();
    const now = new Date();
    const isActive = now >= blockStart && now <= new Date(blockStart.getTime() + SESSION_DURATION_MS);

    const tk = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    let cost = 0;
    const models = new Set();
    for (const e of blockEntries) {
      tk.input += e.input_tokens;
      tk.output += e.output_tokens;
      tk.cacheWrite += e.cache_creation_input_tokens;
      tk.cacheRead += e.cache_read_input_tokens;
      cost += e.cost_usd;
      models.add(e.model);
    }

    const durationMin = (new Date(last.timestamp) - new Date(first.timestamp)) / 60000;
    const burnRate = durationMin > 0 ? (cost / durationMin) * 60 : 0;

    let projection = null;
    if (isActive && burnRate > 0) {
      const remainMin = Math.max(0, (new Date(blockStart.getTime() + SESSION_DURATION_MS) - now) / 60000);
      projection = {
        totalCost: Math.round((cost + (burnRate / 60) * remainMin) * 10000) / 10000,
        remainingMinutes: Math.round(remainMin),
      };
    }

    blocks.push({
      id: startTime,
      startTime, endTime,
      actualEndTime: last.timestamp,
      isActive,
      requestCount: blockEntries.length,
      tokenCounts: tk,
      totalTokens: tk.input + tk.output + tk.cacheWrite + tk.cacheRead,
      costUSD: cost,
      models: [...models],
      burnRate: Math.round(burnRate * 10000) / 10000,
      projection,
    });
  }

  for (const r of sorted) {
    const entryTime = new Date(r.timestamp);
    if (blockStart === null) {
      blockStart = floorToHour(entryTime);
      blockEntries = [r];
    } else {
      const sinceStart = entryTime - blockStart;
      const lastTime = new Date(blockEntries[blockEntries.length - 1].timestamp);
      const sinceLast = entryTime - lastTime;
      if (sinceStart > SESSION_DURATION_MS || sinceLast > SESSION_DURATION_MS) {
        pushBlock();
        blockStart = floorToHour(entryTime);
        blockEntries = [r];
      } else {
        blockEntries.push(r);
      }
    }
  }
  pushBlock();

  return blocks;
}

/**
 * 数据导出
 */
function csvField(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatLocalTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts; }
}

function exportToCSV(records) {
  const headers = ['时间', '会话ID', '模型', '项目', '速度', 'Input Tokens', 'Output Tokens',
    'Cache写入', 'Cache读取', '费用(USD)', '内容预览'];
  const lines = [headers.join(',')];
  for (const r of records) {
    lines.push([
      csvField(formatLocalTime(r.timestamp)), csvField(r.sessionId), csvField(r.model), csvField(r.project),
      csvField(r.speed), r.input_tokens, r.output_tokens,
      r.cache_creation_input_tokens, r.cache_read_input_tokens,
      r.cost_usd.toFixed(6),
      csvField(r.content_preview || ''),
    ].join(','));
  }
  return '\ufeff' + lines.join('\n') + '\n';
}

function exportToJSON(records) {
  return JSON.stringify(records, null, 2);
}

module.exports = {
  loadAllUsageData, getProjectList, calculateCost, getPricing,
  loadSessionList, loadSessionDetail, loadBucketData,
  exportToCSV, exportToJSON,
};
