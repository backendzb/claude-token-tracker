import { useState, useEffect } from 'react';
import { api } from '../../api';
import { themes } from '../../themes';
import './SettingsPage.css';


interface SettingsProps {
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
}

export default function SettingsPage({ currentTheme, onThemeChange }: SettingsProps) {
  const [dailyBudget, setDailyBudget] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [requestThreshold, setRequestThreshold] = useState('');
  const [shortcut, setShortcut] = useState('Ctrl+Shift+T');
  const [floatShortcut, setFloatShortcut] = useState('');
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [floatVisible, setFloatVisible] = useState(false);

  useEffect(() => {
    api.getSettings().then((s: any) => {
      setDailyBudget(s.dailyBudget || '');
      setMonthlyBudget(s.monthlyBudget || '');
      setRequestThreshold(s.requestThreshold || '');
      setShortcut(s.shortcut || 'Ctrl+Shift+T');
      setFloatShortcut(s.floatShortcut || '');
    });
    api.getVersion().then(setVersion);
    api.getFloatVisible().then(setFloatVisible);
  }, []);

  const save = async () => {
    const settings = {
      dailyBudget: parseFloat(dailyBudget as string) || 0,
      monthlyBudget: parseFloat(monthlyBudget as string) || 0,
      requestThreshold: parseFloat(requestThreshold as string) || 0,
      shortcut,
      floatShortcut,
    };
    const result = await api.saveSettings(settings);
    await api.registerShortcuts();
    setStatus(result?.success ? '已保存' : '保存失败');
    setTimeout(() => setStatus(''), 2000);
  };

  const toggleFloat = async () => {
    const result = await api.toggleFloatWindow();
    setFloatVisible(result?.visible ?? false);
  };

  const darkThemes = themes.filter(t => t.group === 'dark');
  const lightThemes = themes.filter(t => t.group === 'light');

  return (
    <div className="settings-page">
      <div className="settings-section">
        <div className="setting-group">
          <h4>主题</h4>
          <div className="theme-label">暗色</div>
          <div className="theme-grid">
            {darkThemes.map(t => (
              <div
                key={t.id}
                className={`theme-card ${currentTheme === t.id ? 'active' : ''}`}
                onClick={() => onThemeChange(t.id)}
              >
                <div className="theme-swatch" style={{ background: t.preview }} />
                <span className="theme-name">{t.name}</span>
              </div>
            ))}
          </div>
          <div className="theme-label" style={{ marginTop: 12 }}>亮色</div>
          <div className="theme-grid">
            {lightThemes.map(t => (
              <div
                key={t.id}
                className={`theme-card ${currentTheme === t.id ? 'active' : ''}`}
                onClick={() => onThemeChange(t.id)}
              >
                <div className="theme-swatch" style={{ background: t.preview, border: '1px solid #ccc' }} />
                <span className="theme-name">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="setting-group">
          <h4>预算告警</h4>
          <div className="setting-row">
            <label>日预算 (USD):</label>
            <input type="number" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} placeholder="0 = 不限" step="0.1" min="0" />
          </div>
          <div className="setting-hint">超出时弹出桌面通知</div>
          <div className="setting-row">
            <label>月预算 (USD):</label>
            <input type="number" value={monthlyBudget} onChange={e => setMonthlyBudget(e.target.value)} placeholder="0 = 不限" step="1" min="0" />
          </div>
          <div className="setting-row">
            <label>单次请求阈值:</label>
            <input type="number" value={requestThreshold} onChange={e => setRequestThreshold(e.target.value)} placeholder="0 = 不限" step="0.01" min="0" />
          </div>
        </div>
        <div className="setting-group">
          <h4>悬浮窗</h4>
          <div className="setting-row">
            <label>悬浮费用窗口:</label>
            <button className={`toggle-btn ${floatVisible ? 'on' : ''}`} onClick={toggleFloat}>
              <span className="toggle-thumb" />
              <span className="toggle-label">{floatVisible ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div className="setting-hint">始终置顶的小窗口，实时显示今日费用</div>
        </div>
        <div className="setting-group">
          <h4>快捷键</h4>
          <div className="setting-row">
            <label>显示/隐藏窗口:</label>
            <input type="text" value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="Ctrl+Shift+T" />
          </div>
          <div className="setting-row">
            <label>悬浮窗开关:</label>
            <input type="text" value={floatShortcut} onChange={e => setFloatShortcut(e.target.value)} placeholder="如 Ctrl+Shift+F" />
          </div>
        </div>
        <button className="btn-save" onClick={save}>保存设置</button>
        {status && <span className="save-status">{status}</span>}
        <div className="setting-group" style={{ marginTop: 24 }}>
          <h4>关于</h4>
          <div className="setting-row">
            <label>当前版本:</label>
            <span className="version-text">v{version}</span>
          </div>
          <div className="setting-row">
            <label>检查更新:</label>
            <button className="btn-check-update" onClick={async () => {
              setUpdateStatus('检查中...');
              try {
                // Open GitHub releases page as fallback
                const { open } = await import('@tauri-apps/plugin-shell');
                await open('https://github.com/backendzb/claude-token-tracker/releases');
                setUpdateStatus('已打开下载页面');
              } catch {
                setUpdateStatus('打开失败');
              }
              setTimeout(() => setUpdateStatus(''), 3000);
            }}>检查</button>
            {updateStatus && <span className="update-status">{updateStatus}</span>}
          </div>
          <div className="setting-hint">前往 GitHub Releases 查看最新版本</div>
        </div>
      </div>
    </div>
  );
}
