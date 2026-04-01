import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from '../../api';
import './FloatWindow.css';

interface FloatData {
  todayCost: number;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  burnRate: number;
  latestModel: string;
}

type ThemeColors = { bg: number[]; text: string; text2: string; text3: string; border: string; blue: string; green: string; yellow: string; red: string; purple: string };

const THEMES: Record<string, ThemeColors> = {
  'deep-ocean': { bg: [30, 30, 56], text: '#ffffff', text2: '#8888aa', text3: '#666688', border: '#2a2a4a', blue: '#6366f1', green: '#34d399', yellow: '#fbbf24', red: '#f85149', purple: '#a78bfa' },
  'midnight': { bg: [0, 0, 0], text: '#e0e0e0', text2: '#808080', text3: '#555555', border: '#222222', blue: '#6366f1', green: '#34d399', yellow: '#fbbf24', red: '#f85149', purple: '#a78bfa' },
  'github-dark': { bg: [13, 17, 23], text: '#e6edf3', text2: '#8b949e', text3: '#484f58', border: '#30363d', blue: '#58a6ff', green: '#3fb950', yellow: '#d29922', red: '#f85149', purple: '#a371f7' },
  'dracula': { bg: [40, 42, 54], text: '#f8f8f2', text2: '#9da0b3', text3: '#6272a4', border: '#44475a', blue: '#8be9fd', green: '#50fa7b', yellow: '#f1fa8c', red: '#ff5555', purple: '#bd93f9' },
  'nord': { bg: [46, 52, 64], text: '#eceff4', text2: '#a3b1c5', text3: '#6b7d99', border: '#4c566a', blue: '#88c0d0', green: '#a3be8c', yellow: '#ebcb8b', red: '#bf616a', purple: '#b48ead' },
  'monokai': { bg: [39, 40, 34], text: '#f8f8f2', text2: '#a6a690', text3: '#75715e', border: '#49483e', blue: '#66d9ef', green: '#a6e22e', yellow: '#e6db74', red: '#f92672', purple: '#ae81ff' },
  'light': { bg: [240, 240, 245], text: '#1a1a2e', text2: '#6b7280', text3: '#9ca3af', border: '#e2e2ea', blue: '#6366f1', green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', purple: '#8250df' },
  'github-light': { bg: [255, 255, 255], text: '#1f2328', text2: '#656d76', text3: '#8b949e', border: '#d0d7de', blue: '#0969da', green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', purple: '#8250df' },
};

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function costClass(cost: number) {
  if (cost >= 5) return 'cost-red';
  if (cost >= 1) return 'cost-yellow';
  return 'cost-green';
}

function shortModel(m: string) {
  if (!m || m === 'unknown') return '-';
  return m.replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/(\w+)-(\d+)-(\d+)/, (_, name: string, maj: string, min: string) =>
      name.charAt(0).toUpperCase() + name.slice(1) + ' ' + maj + '.' + min)
    .replace(/(\w+)-(\d+)$/, (_, name: string, ver: string) =>
      name.charAt(0).toUpperCase() + name.slice(1) + ' ' + ver);
}

export default function FloatWindow() {
  const [data, setData] = useState<FloatData>({
    todayCost: 0, requestCount: 0, inputTokens: 0, outputTokens: 0,
    cacheTokens: 0, totalTokens: 0, burnRate: 0, latestModel: '',
  });
  const [pinned, setPinned] = useState(true);
  const [theme, setTheme] = useState('deep-ocean');

  const loadData = async () => {
    try {
      const todayStart = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
      const records = await api.getUsage({ since: todayStart });
      const todayCost = records.reduce((s, r) => s + r.cost_usd, 0);
      const inputTokens = records.reduce((s, r) => s + r.input_tokens, 0);
      const outputTokens = records.reduce((s, r) => s + r.output_tokens, 0);
      const cacheTokens = records.reduce((s, r) => s + r.cache_creation_input_tokens + r.cache_read_input_tokens, 0);
      const latestModel = records.length > 0 ? records[records.length - 1].model : '';

      let burnRate = 0;
      try {
        const buckets = await api.getBuckets({});
        const active = buckets.find(b => b.isActive);
        if (active) burnRate = active.burnRate;
      } catch {}

      setData({
        todayCost, requestCount: records.length,
        inputTokens, outputTokens, cacheTokens,
        totalTokens: inputTokens + outputTokens + cacheTokens,
        burnRate, latestModel,
      });
    } catch (err) {
      console.error('Float update failed:', err);
    }
  };

  useEffect(() => {
    api.getSettings().then((s: any) => {
      setTheme(s.theme || 'deep-ocean');
    });

    loadData();
    const timer = setInterval(loadData, 30000);
    const unlistenData = listen('data-changed', () => loadData());
    const unlistenTheme = listen<string>('theme-changed', (e) => setTheme(e.payload));

    return () => {
      clearInterval(timer);
      unlistenData.then(fn => fn());
      unlistenTheme.then(fn => fn());
    };
  }, []);

  const t = THEMES[theme] || THEMES['deep-ocean'];
  const [r, g, b] = t.bg;

  // Sync body background with theme so rgba works correctly
  useEffect(() => {
    document.body.style.background = `rgb(${r},${g},${b})`;
    document.documentElement.style.background = `rgb(${r},${g},${b})`;
  }, [r, g, b]);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    invoke('float_set_always_on_top', { flag: next });
  };

  const close = () => {
    getCurrentWindow().hide();
  };

  return (
    <div
      className="float-container"
      style={{
        background: `rgb(${r},${g},${b})`,
        color: t.text,
        borderColor: t.border,
      }}
    >
      <div className="float-header">
        <span className="float-title" style={{ color: t.text2 }}>API 费用</span>
        <div className="float-actions">
          <button className={`float-btn ${pinned ? 'pin-active' : 'pin-inactive'}`}
            onClick={togglePin} title={pinned ? '已置顶' : '未置顶'}
            style={{ color: pinned ? t.blue : t.text3 }}>📌</button>
          <button className="float-btn float-close" onClick={close} title="关闭"
            style={{ color: t.text3 }}>✕</button>
        </div>
      </div>
      <div className="float-cost-row">
        <div className="float-cost" style={{ color: data.todayCost >= 5 ? t.red : data.todayCost >= 1 ? t.yellow : t.green }}>
          ${data.todayCost.toFixed(4)}
        </div>
        <div className="float-cost-label" style={{ color: t.text3 }}>今日</div>
      </div>
      <div className="float-divider" style={{ background: t.border }} />
      <div className="float-metrics">
        <div className="float-metric"><span className="fm-label" style={{ color: t.text3 }}>请求</span><span className="fm-val" style={{ color: t.text2 }}>{data.requestCount}</span></div>
        <div className="float-metric"><span className="fm-label" style={{ color: t.text3 }}>速率</span><span className="fm-val" style={{ color: t.blue }}>{data.burnRate > 0 ? `$${data.burnRate.toFixed(4)}/h` : '-'}</span></div>
        <div className="float-metric"><span className="fm-label" style={{ color: t.text3 }}>Input</span><span className="fm-val" style={{ color: t.text2 }}>{fmt(data.inputTokens)}</span></div>
        <div className="float-metric"><span className="fm-label" style={{ color: t.text3 }}>Output</span><span className="fm-val" style={{ color: t.text2 }}>{fmt(data.outputTokens)}</span></div>
        <div className="float-metric"><span className="fm-label" style={{ color: t.text3 }}>Cache</span><span className="fm-val" style={{ color: t.text2 }}>{fmt(data.cacheTokens)}</span></div>
        <div className="float-metric"><span className="fm-label" style={{ color: t.text3 }}>总Token</span><span className="fm-val" style={{ color: t.text }}>{fmt(data.totalTokens)}</span></div>
      </div>
      <div className="float-model" style={{ color: t.purple }}>{shortModel(data.latestModel)}</div>
    </div>
  );
}
