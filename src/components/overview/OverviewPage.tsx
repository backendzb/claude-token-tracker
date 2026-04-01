import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { api } from '../../api';
import type { UsageRecord } from '../../api/types';
import StatsGrid from './StatsGrid';
import BucketCards from './BucketCards';
import './OverviewPage.css';

export default function OverviewPage() {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const days = parseInt(timeRange) || 7;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const data = await api.getUsage({ since });
      setRecords(data);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }, [timeRange]);

  const exportRecords = async (format: 'csv' | 'json') => {
    try {
      const content = await api.exportData(format, records as any);
      const ext = format === 'csv' ? 'csv' : 'json';
      const filePath = await save({
        title: '导出数据',
        defaultPath: `claude-usage-${new Date().toISOString().slice(0, 10)}.${ext}`,
        filters: [{ name: format.toUpperCase(), extensions: [ext] }],
      });
      if (filePath) {
        await writeTextFile(filePath, content);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh when file watcher detects changes
  useEffect(() => {
    const unlisten = listen('data-changed', () => { loadData(); });
    return () => { unlisten.then(fn => fn()); };
  }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  return (
    <div className="overview">
      <div className="overview-controls">
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)}>
          <option value="1">今天</option>
          <option value="3">3 天</option>
          <option value="7">7 天</option>
          <option value="30">30 天</option>
          <option value="90">90 天</option>
        </select>
        <button className="btn-refresh" onClick={loadData}>刷新</button>
        <div style={{ flex: 1 }} />
        <button className="btn-export" onClick={() => exportRecords('csv')}>CSV</button>
        <button className="btn-export" onClick={() => exportRecords('json')}>JSON</button>
        <span className="overview-status">
          {loading ? '加载中...' : `${records.length} 条记录`}
        </span>
      </div>
      <StatsGrid records={records} />
      <BucketCards />
      {!loading && records.length === 0 && (
        <div className="empty-state">暂无数据</div>
      )}
    </div>
  );
}
