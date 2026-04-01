import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
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
    loadData();
    const timer = setInterval(loadData, 30000);
    const unlisten = listen('data-changed', () => loadData());
    return () => {
      clearInterval(timer);
      unlisten.then(fn => fn());
    };
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    invoke('float_set_always_on_top', { flag: next });
  };

  const close = () => {
    invoke('toggle_float_window');
  };

  return (
    <div className="float-container">
      <div className="float-header">
        <span className="float-title">API 费用</span>
        <div className="float-actions">
          <button className={`float-btn ${pinned ? 'pin-active' : 'pin-inactive'}`}
            onClick={togglePin} title={pinned ? '已置顶' : '未置顶'}>📌</button>
          <button className="float-btn float-close" onClick={close} title="关闭">✕</button>
        </div>
      </div>
      <div className="float-cost-row">
        <div className={`float-cost ${costClass(data.todayCost)}`}>
          ${data.todayCost.toFixed(4)}
        </div>
        <div className="float-cost-label">今日</div>
      </div>
      <div className="float-divider" />
      <div className="float-metrics">
        <div className="float-metric"><span className="fm-label">请求</span><span className="fm-val">{data.requestCount}</span></div>
        <div className="float-metric"><span className="fm-label">速率</span><span className="fm-val fm-rate">{data.burnRate > 0 ? `$${data.burnRate.toFixed(4)}/h` : '-'}</span></div>
        <div className="float-metric"><span className="fm-label">Input</span><span className="fm-val">{fmt(data.inputTokens)}</span></div>
        <div className="float-metric"><span className="fm-label">Output</span><span className="fm-val">{fmt(data.outputTokens)}</span></div>
        <div className="float-metric"><span className="fm-label">Cache</span><span className="fm-val">{fmt(data.cacheTokens)}</span></div>
        <div className="float-metric"><span className="fm-label">总Token</span><span className="fm-val">{fmt(data.totalTokens)}</span></div>
      </div>
      <div className="float-model">{shortModel(data.latestModel)}</div>
    </div>
  );
}
