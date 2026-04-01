import { useState, useEffect } from 'react';
import { api } from '../../api';
import './ActivityPanel.css';

interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

interface StatsCache {
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
  totalSessions: number;
  totalMessages: number;
  hourCounts: Record<string, number>;
  firstSessionDate: string;
}

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function ActivityPanel() {
  const [stats, setStats] = useState<StatsCache | null>(null);

  useEffect(() => {
    api.getStatsCache().then((d: any) => {
      if (d && d.dailyActivity) setStats(d);
    }).catch(console.error);
  }, []);

  if (!stats) return null;

  const maxMsg = Math.max(...stats.dailyActivity.map(d => d.messageCount), 1);
  const hours = stats.hourCounts || {};
  const maxHour = Math.max(...Object.values(hours), 1);

  // Model token totals
  const modelEntries = Object.entries(stats.modelUsage || {});
  const totalModelTokens = modelEntries.reduce((s, [, v]) =>
    s + v.inputTokens + v.outputTokens + v.cacheReadInputTokens + v.cacheCreationInputTokens, 0) || 1;

  return (
    <div className="activity-panel">
      <div className="activity-header">Claude Code 统计</div>
      <div className="activity-grid">

        {/* 每日活动趋势 */}
        <div className="activity-card">
          <div className="ac-title">每日活动</div>
          <div className="ac-subtitle">消息 / 会话 / 工具调用</div>
          <div className="daily-bars">
            {stats.dailyActivity.map(d => (
              <div key={d.date} className="daily-bar-col">
                <div className="daily-bar" style={{ height: `${(d.messageCount / maxMsg * 60)}px` }} title={`${d.date}: ${d.messageCount} 消息`} />
                <div className="daily-label">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="ac-stats-row">
            <span>总会话 <strong>{stats.totalSessions}</strong></span>
            <span>总消息 <strong>{fmt(stats.totalMessages)}</strong></span>
            <span>首次 <strong>{stats.firstSessionDate?.slice(0, 10)}</strong></span>
          </div>
        </div>

        {/* 模型 Token 分布 */}
        <div className="activity-card">
          <div className="ac-title">模型 Token 分布</div>
          <div className="model-bars">
            {modelEntries.map(([model, usage]) => {
              const total = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
              const pct = (total / totalModelTokens * 100).toFixed(1);
              const shortName = model.replace('claude-', '').replace(/-\d{8}$/, '');
              return (
                <div key={model} className="model-bar-row">
                  <span className="model-bar-name">{shortName}</span>
                  <div className="model-bar-track">
                    <div className="model-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="model-bar-val">{fmt(total)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 活跃时段 */}
        <div className="activity-card">
          <div className="ac-title">活跃时段</div>
          <div className="hour-grid">
            {Array.from({ length: 24 }, (_, h) => {
              const count = hours[String(h)] || 0;
              const intensity = count / maxHour;
              return (
                <div key={h} className="hour-cell" style={{
                  opacity: count > 0 ? 0.3 + intensity * 0.7 : 0.08,
                  background: count > 0 ? 'var(--blue)' : 'var(--border)',
                }} title={`${h}:00 — ${count} 次`}>
                  <span className="hour-label">{h}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
