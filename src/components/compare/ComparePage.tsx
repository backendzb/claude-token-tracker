import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { UsageRecord } from '../../api/types';
import './ComparePage.css';

type Mode = 'day' | 'week' | 'month';

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function pctBadge(a: number, b: number) {
  if (b === 0) return '';
  const pct = ((a - b) / b * 100).toFixed(1);
  const cls = a >= b ? 'badge-up' : 'badge-down';
  const sign = a >= b ? '+' : '';
  return <span className={`compare-badge ${cls}`}>{sign}{pct}%</span>;
}

export default function ComparePage() {
  const [mode, setMode] = useState<Mode>('day');
  const [current, setCurrent] = useState<UsageRecord[]>([]);
  const [previous, setPrevious] = useState<UsageRecord[]>([]);

  useEffect(() => {
    const now = new Date();
    let curSince: Date, curUntil: Date, prevSince: Date, prevUntil: Date;

    if (mode === 'day') {
      curSince = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      curUntil = now;
      prevSince = new Date(curSince.getTime() - 86400000);
      prevUntil = new Date(curSince.getTime());
    } else if (mode === 'week') {
      const dayOfWeek = now.getDay() || 7;
      curSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
      curUntil = now;
      prevSince = new Date(curSince.getTime() - 7 * 86400000);
      prevUntil = new Date(curSince.getTime());
    } else {
      curSince = new Date(now.getFullYear(), now.getMonth(), 1);
      curUntil = now;
      prevSince = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevUntil = new Date(curSince.getTime());
    }

    Promise.all([
      api.getUsage({ since: curSince.toISOString(), until: curUntil.toISOString() }),
      api.getUsage({ since: prevSince.toISOString(), until: prevUntil.toISOString() }),
    ]).then(([c, p]) => { setCurrent(c); setPrevious(p); });
  }, [mode]);

  const sum = (recs: UsageRecord[]) => ({
    n: recs.length,
    cost: recs.reduce((s, r) => s + r.cost_usd, 0),
    input: recs.reduce((s, r) => s + r.input_tokens, 0),
    output: recs.reduce((s, r) => s + r.output_tokens, 0),
  });

  const c = sum(current), p = sum(previous);
  const labels: Record<Mode, [string, string]> = {
    day: ['今天', '昨天'], week: ['本周', '上周'], month: ['本月', '上月'],
  };

  const metrics = [
    { label: '请求数', cur: c.n, prev: p.n, format: fmt },
    { label: '费用', cur: c.cost, prev: p.cost, format: (v: number) => '$' + v.toFixed(4) },
    { label: 'Input', cur: c.input, prev: p.input, format: fmt },
    { label: 'Output', cur: c.output, prev: p.output, format: fmt },
  ];

  return (
    <div className="compare-page">
      <div className="compare-controls">
        {(['day', 'week', 'month'] as Mode[]).map(m => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
            {m === 'day' ? '日' : m === 'week' ? '周' : '月'}对比
          </button>
        ))}
      </div>
      <div className="compare-grid">
        {metrics.map(m => (
          <div key={m.label} className="compare-card">
            <div className="compare-label">{m.label}</div>
            <div className="compare-row">
              <div className="compare-col">
                <div className="compare-period">{labels[mode][0]}</div>
                <div className="compare-value">{m.format(m.cur)}</div>
              </div>
              <div className="compare-vs">vs</div>
              <div className="compare-col">
                <div className="compare-period">{labels[mode][1]}</div>
                <div className="compare-value prev">{m.format(m.prev)}</div>
              </div>
            </div>
            <div className="compare-diff">{pctBadge(m.cur, m.prev)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
