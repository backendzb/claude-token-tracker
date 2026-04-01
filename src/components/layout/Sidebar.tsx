import './Sidebar.css';

const navItems = [
  { key: '总览', icon: 'bar_chart' },
  { key: '对比', icon: 'compare_arrows' },
  { key: '排名', icon: 'leaderboard' },
  { key: '会话', icon: 'chat' },
  { key: '对话', icon: 'receipt_long' },
  { key: '设置', icon: 'settings' },
] as const;

interface Props {
  active: string;
  onChange: (key: string) => void;
}

export default function Sidebar({ active, onChange }: Props) {
  return (
    <div className="sidebar" data-tauri-drag-region>
      <div className="sidebar-logo">
        <span className="material-symbols-rounded sidebar-logo-icon">diamond</span>
        <span className="sidebar-logo-text">Token Tracker</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <div
            key={item.key}
            className={`nav-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            <span className="material-symbols-rounded nav-icon">{item.icon}</span>
            <span className="nav-label">{item.key}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}
