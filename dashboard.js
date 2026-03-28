#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOGS_DIR = path.join(os.homedir(), '.claude', 'usage-logs');
const PORT = 3456;

function loadLogs(days) {
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
      try { records.push(JSON.parse(line)); } catch (_) {}
    }
  }
  records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return records;
}

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Token 用量仪表盘</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f1117; color: #e1e4e8; min-height: 100vh;
  }
  .header {
    background: linear-gradient(135deg, #1a1b2e 0%, #16213e 100%);
    padding: 24px 32px; border-bottom: 1px solid #30363d;
  }
  .header h1 { font-size: 22px; font-weight: 600; color: #f0f6fc; }
  .header .sub { color: #8b949e; font-size: 13px; margin-top: 4px; }
  .controls {
    display: flex; gap: 12px; align-items: center;
    padding: 16px 32px; background: #161b22; border-bottom: 1px solid #21262d;
  }
  .controls label { color: #8b949e; font-size: 13px; }
  .controls select, .controls button {
    background: #21262d; border: 1px solid #30363d; color: #e1e4e8;
    padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;
  }
  .controls button:hover { background: #30363d; }
  .controls .auto-refresh { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .controls .auto-refresh input { accent-color: #58a6ff; }
  .stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px; padding: 24px 32px;
  }
  .stat-card {
    background: #161b22; border: 1px solid #21262d; border-radius: 10px;
    padding: 18px 20px; position: relative; overflow: hidden;
  }
  .stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  }
  .stat-card.requests::before { background: #58a6ff; }
  .stat-card.input::before { background: #3fb950; }
  .stat-card.output::before { background: #d29922; }
  .stat-card.cache-w::before { background: #f778ba; }
  .stat-card.cache-r::before { background: #a371f7; }
  .stat-card.cost::before { background: #f85149; }
  .stat-label { font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 26px; font-weight: 700; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .stat-card.requests .stat-value { color: #58a6ff; }
  .stat-card.input .stat-value { color: #3fb950; }
  .stat-card.output .stat-value { color: #d29922; }
  .stat-card.cache-w .stat-value { color: #f778ba; }
  .stat-card.cache-r .stat-value { color: #a371f7; }
  .stat-card.cost .stat-value { color: #f85149; }

  .charts {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    padding: 0 32px 24px;
  }
  .chart-card {
    background: #161b22; border: 1px solid #21262d; border-radius: 10px;
    padding: 20px;
  }
  .chart-card h3 { font-size: 14px; color: #8b949e; margin-bottom: 16px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 3px; height: 140px; }
  .bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .bar {
    width: 100%; border-radius: 3px 3px 0 0; min-height: 2px;
    transition: height 0.3s; position: relative; cursor: pointer;
  }
  .bar:hover { opacity: 0.8; }
  .bar-label { font-size: 9px; color: #484f58; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tooltip {
    display: none; position: absolute; bottom: calc(100% + 8px); left: 50%;
    transform: translateX(-50%); background: #1c2128; border: 1px solid #30363d;
    border-radius: 6px; padding: 8px 12px; font-size: 11px; white-space: nowrap;
    z-index: 100; color: #e1e4e8; pointer-events: none;
  }
  .bar:hover .tooltip { display: block; }

  .donut-container { display: flex; align-items: center; justify-content: center; gap: 24px; }
  .donut-legend { display: flex; flex-direction: column; gap: 8px; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }

  .table-section { padding: 0 32px 32px; }
  .table-section h2 { font-size: 16px; margin-bottom: 12px; color: #f0f6fc; }
  .table-wrap {
    background: #161b22; border: 1px solid #21262d; border-radius: 10px;
    overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    background: #1c2128; padding: 10px 14px; text-align: left;
    font-weight: 600; color: #8b949e; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.5px;
    border-bottom: 1px solid #21262d; position: sticky; top: 0;
  }
  thead th.num { text-align: right; }
  tbody td { padding: 10px 14px; border-bottom: 1px solid #21262d; }
  tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover { background: #1c2128; }
  tbody tr:last-child td { border-bottom: none; }
  .cost-low { color: #3fb950; }
  .cost-mid { color: #d29922; }
  .cost-high { color: #f85149; }
  .model-tag {
    display: inline-block; padding: 2px 8px; border-radius: 12px;
    font-size: 11px; font-weight: 500;
  }
  .model-tag.opus { background: #3b1d60; color: #d2a8ff; }
  .model-tag.sonnet { background: #1a3a1a; color: #7ee787; }
  .model-tag.haiku { background: #3d2b00; color: #e3b341; }
  .preview { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #484f58; }
  .empty { text-align: center; padding: 60px; color: #484f58; }
  .empty svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.3; }
  .scroll-table { max-height: 500px; overflow-y: auto; }

  @media (max-width: 800px) {
    .charts { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Claude Code Token 用量仪表盘</h1>
    <div class="sub">实时追踪每次请求的 token 消耗与等价 API 费用</div>
  </div>
  <div class="controls">
    <label>时间范围:</label>
    <select id="daysSelect">
      <option value="1">今天</option>
      <option value="3">最近 3 天</option>
      <option value="7" selected>最近 7 天</option>
      <option value="30">最近 30 天</option>
    </select>
    <button onclick="refresh()">刷新</button>
    <div class="auto-refresh">
      <input type="checkbox" id="autoRefresh" checked>
      <label for="autoRefresh" style="cursor:pointer">自动刷新 (30s)</label>
    </div>
  </div>
  <div class="stats" id="statsArea"></div>
  <div class="charts" id="chartsArea"></div>
  <div class="table-section">
    <h2>请求明细</h2>
    <div class="table-wrap">
      <div class="scroll-table" id="tableArea"></div>
    </div>
  </div>

<script>
let autoTimer = null;

function fmtNum(n) {
  return (n || 0).toLocaleString('en-US');
}

function costClass(c) {
  if (c >= 0.5) return 'cost-high';
  if (c >= 0.1) return 'cost-mid';
  return 'cost-low';
}

function modelClass(m) {
  if (!m) return 'opus';
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  return 'opus';
}

function modelShort(m) {
  return (m || 'unknown').replace('claude-', '');
}

async function fetchData() {
  const days = document.getElementById('daysSelect').value;
  const res = await fetch('/api/usage?days=' + days);
  return res.json();
}

function renderStats(records) {
  const t = { requests: records.length, input: 0, output: 0, cw: 0, cr: 0, cost: 0 };
  for (const r of records) {
    t.input += r.input_tokens || 0;
    t.output += r.output_tokens || 0;
    t.cw += r.cache_creation_input_tokens || 0;
    t.cr += r.cache_read_input_tokens || 0;
    t.cost += r.cost_usd || 0;
  }
  document.getElementById('statsArea').innerHTML = [
    ['requests', '请求数', fmtNum(t.requests)],
    ['input', 'Input Tokens', fmtNum(t.input)],
    ['output', 'Output Tokens', fmtNum(t.output)],
    ['cache-w', 'Cache 写入', fmtNum(t.cw)],
    ['cache-r', 'Cache 读取', fmtNum(t.cr)],
    ['cost', '等价 API 费用', '$' + t.cost.toFixed(4)],
  ].map(([cls, label, val]) =>
    '<div class="stat-card ' + cls + '"><div class="stat-label">' + label + '</div><div class="stat-value">' + val + '</div></div>'
  ).join('');
}

function renderCharts(records) {
  if (records.length === 0) {
    document.getElementById('chartsArea').innerHTML = '';
    return;
  }

  // 按时间分组 (每小时或每天)
  const days = parseInt(document.getElementById('daysSelect').value);
  const grouped = {};

  for (const r of records) {
    const d = new Date(r.timestamp);
    const key = days <= 1
      ? d.toTimeString().slice(0, 5)
      : d.toISOString().slice(5, 10);
    if (!grouped[key]) grouped[key] = { cost: 0, output: 0, input: 0, cr: 0, cw: 0, count: 0 };
    grouped[key].cost += r.cost_usd || 0;
    grouped[key].output += r.output_tokens || 0;
    grouped[key].input += r.input_tokens || 0;
    grouped[key].cr += r.cache_read_input_tokens || 0;
    grouped[key].cw += r.cache_creation_input_tokens || 0;
    grouped[key].count++;
  }

  const keys = Object.keys(grouped);
  const maxCost = Math.max(...keys.map(k => grouped[k].cost), 0.001);
  const maxTokens = Math.max(...keys.map(k => grouped[k].output + grouped[k].input), 1);

  // 费用柱状图
  const costBars = keys.map(k => {
    const g = grouped[k];
    const h = Math.max((g.cost / maxCost) * 120, 2);
    return '<div class="bar-group"><div class="bar" style="height:' + h + 'px;background:#f85149;">' +
      '<div class="tooltip">$' + g.cost.toFixed(4) + ' (' + g.count + ' 请求)</div></div>' +
      '<div class="bar-label">' + k + '</div></div>';
  }).join('');

  // Token 柱状图
  const tokenBars = keys.map(k => {
    const g = grouped[k];
    const total = g.output + g.input;
    const h = Math.max((total / maxTokens) * 120, 2);
    return '<div class="bar-group"><div class="bar" style="height:' + h + 'px;background:linear-gradient(to top, #3fb950, #58a6ff);">' +
      '<div class="tooltip">Input: ' + fmtNum(g.input) + '\\nOutput: ' + fmtNum(g.output) + '</div></div>' +
      '<div class="bar-label">' + k + '</div></div>';
  }).join('');

  // Token 分布（饼图用比例条代替）
  const t = { input: 0, output: 0, cw: 0, cr: 0 };
  for (const r of records) {
    t.input += r.input_tokens || 0;
    t.output += r.output_tokens || 0;
    t.cw += r.cache_creation_input_tokens || 0;
    t.cr += r.cache_read_input_tokens || 0;
  }
  const total = t.input + t.output + t.cw + t.cr || 1;
  const segments = [
    { label: 'Input', value: t.input, color: '#3fb950' },
    { label: 'Output', value: t.output, color: '#d29922' },
    { label: 'Cache 写入', value: t.cw, color: '#f778ba' },
    { label: 'Cache 读取', value: t.cr, color: '#a371f7' },
  ];

  // SVG 圆环图
  let cumPercent = 0;
  const radius = 52, cx = 65, cy = 65, stroke = 24;
  const circumference = 2 * Math.PI * radius;
  let svgPaths = '';
  for (const seg of segments) {
    const pct = seg.value / total;
    const dashLen = pct * circumference;
    const dashOffset = -cumPercent * circumference;
    svgPaths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + seg.color +
      '" stroke-width="' + stroke + '" stroke-dasharray="' + dashLen + ' ' + (circumference - dashLen) +
      '" stroke-dashoffset="' + dashOffset + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
    cumPercent += pct;
  }
  const donutSvg = '<svg width="130" height="130" viewBox="0 0 130 130">' + svgPaths + '</svg>';
  const legendHtml = segments.map(s =>
    '<div class="legend-item"><span class="legend-dot" style="background:' + s.color + '"></span>' +
    s.label + ': ' + fmtNum(s.value) + ' (' + ((s.value / total) * 100).toFixed(1) + '%)</div>'
  ).join('');

  document.getElementById('chartsArea').innerHTML =
    '<div class="chart-card"><h3>费用趋势</h3><div class="bar-chart">' + costBars + '</div></div>' +
    '<div class="chart-card"><h3>Token 分布</h3><div class="donut-container">' + donutSvg + '<div class="donut-legend">' + legendHtml + '</div></div></div>';
}

function renderTable(records) {
  if (records.length === 0) {
    document.getElementById('tableArea').innerHTML =
      '<div class="empty"><div style="font-size:36px;opacity:0.3">📊</div><p>暂无数据</p><p style="font-size:12px;margin-top:8px">使用 Claude Code 发送消息后，数据会自动出现</p></div>';
    return;
  }

  const rows = [...records].reverse().map((r, i) => {
    const time = r.timestamp ? new Date(r.timestamp).toLocaleString('zh-CN', { hour12: false }) : '-';
    const mc = modelClass(r.model);
    return '<tr>' +
      '<td>' + (records.length - i) + '</td>' +
      '<td>' + time + '</td>' +
      '<td><span class="model-tag ' + mc + '">' + modelShort(r.model) + '</span></td>' +
      '<td class="num">' + fmtNum(r.input_tokens) + '</td>' +
      '<td class="num">' + fmtNum(r.cache_creation_input_tokens) + '</td>' +
      '<td class="num">' + fmtNum(r.cache_read_input_tokens) + '</td>' +
      '<td class="num">' + fmtNum(r.output_tokens) + '</td>' +
      '<td class="num ' + costClass(r.cost_usd) + '">$' + (r.cost_usd || 0).toFixed(4) + '</td>' +
      '<td class="preview" title="' + (r.content_preview || '').replace(/"/g, '&quot;') + '">' + (r.content_preview || '-') + '</td>' +
      '</tr>';
  }).join('');

  document.getElementById('tableArea').innerHTML =
    '<table><thead><tr>' +
    '<th>#</th><th>时间</th><th>模型</th>' +
    '<th class="num">Input</th><th class="num">Cache写</th><th class="num">Cache读</th><th class="num">Output</th>' +
    '<th class="num">费用</th><th>预览</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

async function refresh() {
  try {
    const records = await fetchData();
    renderStats(records);
    renderCharts(records);
    renderTable(records);
  } catch (e) {
    console.error('Failed to fetch data:', e);
  }
}

function setupAutoRefresh() {
  const cb = document.getElementById('autoRefresh');
  cb.addEventListener('change', () => {
    if (cb.checked) {
      autoTimer = setInterval(refresh, 30000);
    } else {
      clearInterval(autoTimer);
    }
  });
  autoTimer = setInterval(refresh, 30000);
}

document.getElementById('daysSelect').addEventListener('change', refresh);
refresh();
setupAutoRefresh();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/usage')) {
    const url = new URL(req.url, 'http://localhost');
    const days = parseInt(url.searchParams.get('days')) || 7;
    const records = loadLogs(days);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(records));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Claude Code Token 用量仪表盘已启动');
  console.log('');
  console.log('  打开浏览器访问: http://localhost:' + PORT);
  console.log('');
  console.log('  按 Ctrl+C 停止');
  console.log('');

  // Windows 下自动打开浏览器
  const { exec } = require('child_process');
  exec('start http://localhost:' + PORT);
});
