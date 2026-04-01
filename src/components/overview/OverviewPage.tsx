import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { UsageRecord } from '../../api/types';
import StatsGrid from './StatsGrid';
import BucketCards from './BucketCards';
import './OverviewPage.css';

export default function OverviewPage() {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7');

  const loadData = async () => {
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
  };

  useEffect(() => { loadData(); }, [timeRange]);

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
