import { getCurrentWindow } from '@tauri-apps/api/window';
import './TitleBar.css';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function TitleBar({ theme, onToggleTheme }: Props) {
  const win = getCurrentWindow();

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left">
        <span className="titlebar-logo">◆</span>
        <span className="titlebar-title">Claude Token Tracker</span>
      </div>
      <div className="titlebar-right">
        <button className="titlebar-btn" onClick={onToggleTheme} title="切换主题">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <div className="titlebar-window-controls">
          <button className="win-btn" onClick={() => win.minimize()} title="最小化">
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="win-btn" onClick={() => win.toggleMaximize()} title="最大化">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
          </button>
          <button className="win-btn win-close" onClick={() => win.close()} title="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
