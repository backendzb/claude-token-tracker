import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { BucketData } from '../../api/types';
import './BucketCards.css';

interface Props {
  timeRange: string;
}

type ViewMode = 'session' | 'window';

export default function BucketCards({ timeRange }: Props) {
  const [buckets, setBuckets] = useState<BucketData[]>([]);
  const [mode, setMode] = useState<ViewMode>('window');

  useEffect(() => {
    const days = parseInt(timeRange) || 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const fetcher = mode === 'session' ? api.getBuckets : api.getTimeBuckets;
    fetcher({ since }).then(setBuckets).catch(console.error);
  }, [timeRange, mode]);

  if (!buckets.length) return null;

  const recent = [...buckets].reverse().slice(0, 9);

  return (
    <div className="bucket-section">
      <div className="bucket-header-row">
        <span className="bucket-title-row">{buckets.length} 个{mode === 'session' ? '会话' : '窗口'}</span>
        <div className="bucket-toggle">
          <button className={mode === 'window' ? 'active-window' : ''} onClick={() => setMode('window')}>5h窗口</button>
          <button className={mode === 'session' ? 'active' : ''} onClick={() => setMode('session')}>会话</button>
        </div>
      </div>
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
            <div key={b.id} className={`bucket-card ${cls} ${mode === 'window' ? 'window-mode' : ''}`}>
              <div className="bucket-time">{start} ~ {end}</div>
              <div className={`bucket-cost ${costCls(b.costUSD)}`}>${b.costUSD.toFixed(4)}</div>
              <div className="bucket-meta">
                {b.requestCount} 请求 · {fmt(b.totalTokens)} tokens
                {b.burnRate > 0 && <> · ${b.burnRate.toFixed(4)}/h</>}
                {mode === 'window' && b.projection && (
                  <> · 预估 ${b.projection.totalCost.toFixed(4)} ({b.projection.remainingMinutes}min)</>
                )}
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
