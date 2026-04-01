import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { SessionSummary } from '../../api/types';
import './SessionsPage.css';

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(7);

  useEffect(() => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    api.getSessions({ since }).then(setSessions).catch(console.error);
  }, [days]);

  // Group by project
  const groups = new Map<string, SessionSummary[]>();
  for (const s of sessions) {
    const list = groups.get(s.project) || [];
    list.push(s);
    groups.set(s.project, list);
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="sessions-page">
      <div className="sessions-controls">
        <select value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={1}>今天</option>
          <option value={7}>7 天</option>
          <option value={30}>30 天</option>
        </select>
        <span className="sessions-count">{sessions.length} 个会话</span>
      </div>
      {[...groups.entries()].map(([project, items]) => {
        const totalCost = items.reduce((s, i) => s + i.totalCost, 0);
        return (
          <div key={project} className="session-group">
            <div className="session-group-header">
              <span className="session-project">{project}</span>
              <span className="session-group-meta">{items.length} 会话 · ${totalCost.toFixed(4)}</span>
            </div>
            {items.map(s => (
              <div key={s.sessionId} className="session-item">
                <div className="session-row" onClick={() => toggle(s.sessionId)}>
                  <span className="session-id">{s.sessionId.slice(0, 8)}</span>
                  <span className="session-models">{s.models.join(', ')}</span>
                  <span className="session-meta">{s.requestCount} 请求 · {fmt(s.totalTokens)} tokens</span>
                  <span className="session-cost">${s.totalCost.toFixed(4)}</span>
                  <span className="session-toggle">{expanded.has(s.sessionId) ? '▼' : '▶'}</span>
                </div>
                {expanded.has(s.sessionId) && (
                  <div className="session-detail">
                    <div className="session-detail-row">
                      <span>Input: {fmt(s.input_tokens)}</span>
                      <span>Output: {fmt(s.output_tokens)}</span>
                      <span>Cache写: {fmt(s.cache_creation_input_tokens)}</span>
                      <span>Cache读: {fmt(s.cache_read_input_tokens)}</span>
                    </div>
                    <div className="session-detail-row">
                      <span>开始: {new Date(s.firstTimestamp).toLocaleString('zh-CN')}</span>
                      <span>结束: {new Date(s.lastTimestamp).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {groups.size === 0 && <div className="sessions-empty">暂无数据</div>}
    </div>
  );
}
