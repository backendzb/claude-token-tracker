import { useState } from 'react';
import type { UsageRecord } from '../../api/types';
import './RequestTable.css';

interface Props {
  records: UsageRecord[];
}

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

const PAGE_SIZE = 30;

export default function RequestTable({ records }: Props) {
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!records.length) return null;

  const sorted = [...records].reverse();
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRecords = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const modelTag = (model: string) => {
    if (model.includes('opus')) return 'tag-opus';
    if (model.includes('sonnet')) return 'tag-sonnet';
    if (model.includes('haiku')) return 'tag-haiku';
    return '';
  };

  const shortModel = (m: string) =>
    m.replace('claude-', '').replace(/-\d{8}$/, '');

  return (
    <div className="req-table-section">
      <div className="req-table-header">
        <span className="req-table-title">请求日志</span>
        <span className="req-table-pages">
          {page + 1} / {totalPages}（共 {sorted.length} 条）
        </span>
      </div>
      <table className="req-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>模型</th>
            <th>Input</th>
            <th>Output</th>
            <th>Cache</th>
            <th>费用</th>
          </tr>
        </thead>
        <tbody>
          {pageRecords.map((r, i) => {
            const key = `${r.timestamp}-${r.request_id}-${i}`;
            const isExpanded = expandedId === key;
            return (
              <>
                <tr key={key} className="req-row" onClick={() => setExpandedId(isExpanded ? null : key)}>
                  <td className="req-time">{new Date(r.timestamp).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td><span className={`req-model-tag ${modelTag(r.model)}`}>{shortModel(r.model)}</span></td>
                  <td className="req-num">{fmt(r.input_tokens)}</td>
                  <td className="req-num">{fmt(r.output_tokens)}</td>
                  <td className="req-num">{fmt(r.cache_creation_input_tokens + r.cache_read_input_tokens)}</td>
                  <td className="req-cost">${r.cost_usd.toFixed(4)}</td>
                </tr>
                {isExpanded && (
                  <tr key={key + '-detail'} className="req-detail-row">
                    <td colSpan={6}>
                      <div className="req-detail">
                        {r.user_query && <div className="req-query"><strong>用户:</strong> {r.user_query}</div>}
                        <div className="req-response"><strong>回复:</strong> {r.content_preview || r.content || '(无预览)'}</div>
                        <div className="req-meta-detail">
                          Session: {r.session_id.slice(0, 8)} · 项目: {r.project}
                          {r.speed === 'fast' && <span className="req-fast-tag">FAST</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="req-pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>上一页</button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}
