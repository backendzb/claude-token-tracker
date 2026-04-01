import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './TitleBar.css';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

async function showCloseDialog() {
  const choice = await new Promise<number>((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'close-dialog-overlay';
    overlay.innerHTML = `
      <div class="close-dialog">
        <div class="close-dialog-title">Claude Token Tracker</div>
        <div class="close-dialog-msg">要最小化到托盘还是退出程序？</div>
        <div class="close-dialog-btns">
          <button class="close-dialog-btn primary" data-action="0">最小化到托盘</button>
          <button class="close-dialog-btn danger" data-action="1">退出</button>
          <button class="close-dialog-btn" data-action="2">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]');
      if (btn) {
        resolve(parseInt(btn.getAttribute('data-action')!));
        overlay.remove();
      }
    });
  });

  if (choice === 0) {
    await invoke('hide_to_tray');
  } else if (choice === 1) {
    await invoke('quit_app');
  }
}

export default function TitleBar({ theme, onToggleTheme }: Props) {
  const win = getCurrentWindow();

  // Listen for close-requested event from Rust (window X button or Alt+F4)
  useEffect(() => {
    const unlisten = listen('close-requested', () => {
      showCloseDialog();
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

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
          <button className="win-btn win-close" onClick={showCloseDialog} title="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
