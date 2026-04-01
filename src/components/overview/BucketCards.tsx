import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { BucketData } from '../../api/types';
import './BucketCards.css';

interface Props {
  timeRange: string;
}

export default function BucketCards({ timeRange }: Props) {
  const [buckets, setBuckets] = useState<BucketData[]>([]);

  useEffect(() => {
    const days = parseInt(timeRange) || 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    api.getBuckets({ since }).then(setBuckets).catch(console.error);
  }, [timeRange]);

  if (!buckets.length) return null;

  // Reverse: newest first, show up to 8
  const recent = [...buckets].reverse().slice(0, 8);

  return (
    <div className="bucket-section">
      <div className="bucket-title-row">{buckets.length} 个 5 小时窗口</div>
      <div className="bucket-grid">
        {recent.map(b => {
          const cls = b.isActive
            ? b.projection && b.projection.totalCost > b.costUSD * 1.5
              ? 'warning' : 'active'
            : '';
          const start = new Date(b.startTime).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          const end = b.isActive
            ? '进行中'
            : new Date(b.endTime).toLocaleString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

          return (
            <div key={b.id} className={`bucket-card ${cls}`}>
              <div className="bucket-time">{start} ~ {end}</div>
              <div className={`bucket-cost ${costCls(b.costUSD)}`}>${b.costUSD.toFixed(4)}</div>
              <div className="bucket-meta">
                {b.requestCount} 请求 · {fmt(b.totalTokens)} tokens
                {b.burnRate > 0 && <> · ${b.burnRate.toFixed(4)}/h</>}
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
