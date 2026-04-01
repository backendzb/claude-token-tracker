import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { SessionSummary } from '../../api/types';
import './RankingPage.css';

export default function RankingPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    api.getSessions({ since }).then(setSessions).catch(console.error);
  }, [days]);

  // Group by project
  const projectMap = new Map<string, { cost: number; requests: number }>();
  for (const s of sessions) {
    const p = projectMap.get(s.project) || { cost: 0, requests: 0 };
    p.cost += s.totalCost;
    p.requests += s.requestCount;
    projectMap.set(s.project, p);
  }
  const projects = [...projectMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.cost - a.cost);
  const maxCost = projects[0]?.cost || 1;

  // Top sessions
  const topSessions = [...sessions].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
  const maxSessionCost = topSessions[0]?.totalCost || 1;

  return (
    <div className="ranking-page">
      <div className="ranking-controls">
        <select value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>7 天</option>
          <option value={30}>30 天</option>
          <option value={90}>90 天</option>
        </select>
      </div>
      <div className="ranking-panels">
        <div className="ranking-panel">
          <h3>项目排名</h3>
          {projects.map((p, i) => (
            <div key={p.name} className="rank-item">
              <span className={`rank-num ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
              <div className="rank-info">
                <div className="rank-name">{p.name}</div>
                <div className="rank-bar-bg">
                  <div className="rank-bar" style={{ width: `${(p.cost / maxCost * 100).toFixed(1)}%` }} />
                </div>
              </div>
              <span className="rank-cost">${p.cost.toFixed(4)}</span>
            </div>
          ))}
          {projects.length === 0 && <div className="rank-empty">暂无数据</div>}
        </div>
        <div className="ranking-panel">
          <h3>会话排名</h3>
          {topSessions.map((s, i) => (
            <div key={s.sessionId} className="rank-item">
              <span className={`rank-num ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
              <div className="rank-info">
                <div className="rank-name">{s.sessionId.slice(0, 8)} · {s.project}</div>
                <div className="rank-bar-bg">
                  <div className="rank-bar" style={{ width: `${(s.totalCost / maxSessionCost * 100).toFixed(1)}%` }} />
                </div>
              </div>
              <span className="rank-cost">${s.totalCost.toFixed(4)}</span>
            </div>
          ))}
          {topSessions.length === 0 && <div className="rank-empty">暂无数据</div>}
        </div>
      </div>
    </div>
  );
}
