import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import './PageHeader.css';

interface Props {
  title: string;
  onToggleTheme: () => void;
}

async function showCloseDialog() {
  const choice = await new Promise<number>((resolve) => {
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
  if (choice === 0) await invoke('hide_to_tray');
  else if (choice === 1) await invoke('quit_app');
}

export default function PageHeader({ title, onToggleTheme }: Props) {
  const win = getCurrentWindow();

  return (
    <div className="page-header" data-tauri-drag-region>
      <h1 className="page-title" data-tauri-drag-region>{title}</h1>
      <div className="page-header-actions">
        <button className="ph-btn" onClick={onToggleTheme} title="切换主题">
          <span className="material-symbols-rounded">dark_mode</span>
        </button>
        <button className="ph-btn" onClick={() => win.minimize()} title="最小化">
          <span className="material-symbols-rounded">remove</span>
        </button>
        <button className="ph-btn" onClick={() => win.toggleMaximize()} title="最大化">
          <span className="material-symbols-rounded">crop_square</span>
        </button>
        <button className="ph-btn ph-close" onClick={showCloseDialog} title="关闭">
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>
    </div>
  );
}
