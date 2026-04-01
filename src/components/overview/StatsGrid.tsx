import type { UsageRecord } from '../../api/types';
import './StatsGrid.css';

interface Props {
  records: UsageRecord[];
}

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function fmtCost(n: number): string {
  return '$' + n.toFixed(4);
}

const CARD_COLORS = ['blue', 'green', 'yellow', 'pink', 'purple', 'cyan'] as const;

export default function StatsGrid({ records }: Props) {
  const t = records.reduce(
    (acc, r) => {
      acc.n++;
      acc.input += r.input_tokens;
      acc.output += r.output_tokens;
      acc.cw += r.cache_creation_input_tokens;
      acc.cr += r.cache_read_input_tokens;
      acc.cost += r.cost_usd;
      return acc;
    },
    { n: 0, input: 0, output: 0, cw: 0, cr: 0, cost: 0 }
  );
  const total = t.input + t.output + t.cw + t.cr || 1;

  const cards = [
    { label: '总请求数', value: fmt(t.n), sub: '', color: CARD_COLORS[0] },
    { label: 'Input Tokens', value: fmt(t.input), sub: ((t.input / total) * 100).toFixed(1) + '%', color: CARD_COLORS[1] },
    { label: 'Output Tokens', value: fmt(t.output), sub: ((t.output / total) * 100).toFixed(1) + '%', color: CARD_COLORS[2] },
    { label: 'Cache 写入', value: fmt(t.cw), sub: ((t.cw / total) * 100).toFixed(1) + '%', color: CARD_COLORS[3] },
    { label: 'Cache 读取', value: fmt(t.cr), sub: ((t.cr / total) * 100).toFixed(1) + '%', color: CARD_COLORS[4] },
    { label: '等价 API 费用', value: fmtCost(t.cost), sub: fmt(t.input + t.output + t.cw + t.cr) + ' tokens', color: CARD_COLORS[5] },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c, i) => (
        <div key={i} className={`stat-card stat-${c.color}`}>
          <div className="stat-label">{c.label}</div>
          <div className="stat-value">{c.value}</div>
          {c.sub && <div className="stat-sub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
