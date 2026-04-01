import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { BucketData } from '../../api/types';
import './BucketCards.css';

export default function BucketCards() {
  const [buckets, setBuckets] = useState<BucketData[]>([]);

  useEffect(() => {
    api.getBuckets({}).then(setBuckets).catch(console.error);
  }, []);

  if (!buckets.length) return null;

  const recent = buckets.slice(-8);

  return (
    <div className="bucket-section">
      <div className="bucket-title-row">5 小时窗口</div>
      <div className="bucket-list">
        {recent.map(b => {
          const cls = b.isActive
            ? b.projection && b.projection.totalCost > b.costUSD * 1.5
              ? 'warning' : 'active'
            : '';
          const start = new Date(b.startTime).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          const end = new Date(b.endTime).toLocaleString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
          const elapsed = b.isActive
            ? Math.min(1, (Date.now() - new Date(b.startTime).getTime()) / (5 * 3600000))
            : 1;
          const barColor = elapsed > 0.8 ? 'var(--red)' : elapsed > 0.5 ? 'var(--yellow)' : 'var(--blue)';

          return (
            <div key={b.id} className={`bucket-card ${cls}`}>
              <div className="bucket-header">
                <span>{start} — {end}</span>
                {b.isActive && <span className={`bucket-badge ${cls}`}>{cls === 'warning' ? '注意' : '活跃'}</span>}
              </div>
              <div className={`bucket-cost ${costCls(b.costUSD)}`}>${b.costUSD.toFixed(4)}</div>
              <div className="bucket-meta">
                {b.requestCount} 请求 · {fmt(b.totalTokens)} tokens
                {b.burnRate > 0 && <> · ${b.burnRate.toFixed(4)}/h</>}
                {b.projection && <> · 预估 ${b.projection.totalCost.toFixed(4)}</>}
              </div>
              <div className="bucket-bar">
                <div className="bucket-bar-fill" style={{ width: `${(elapsed * 100).toFixed(1)}%`, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function costCls(c: number) {
  if (c >= 5) return 'cost-red';
  if (c >= 1) return 'cost-yellow';
  return 'cost-green';
}
