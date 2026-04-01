import { useState, useEffect } from 'react';
import { api } from '../../api';
import './SettingsPage.css';

export default function SettingsPage() {
  const [dailyBudget, setDailyBudget] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [requestThreshold, setRequestThreshold] = useState('');
  const [shortcut, setShortcut] = useState('Ctrl+Shift+T');
  const [floatShortcut, setFloatShortcut] = useState('');
  const [floatOpacity, setFloatOpacity] = useState(0.9);
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.getSettings().then((s: any) => {
      setDailyBudget(s.dailyBudget || '');
      setMonthlyBudget(s.monthlyBudget || '');
      setRequestThreshold(s.requestThreshold || '');
      setShortcut(s.shortcut || 'Ctrl+Shift+T');
      setFloatShortcut(s.floatShortcut || '');
      setFloatOpacity(s.floatOpacity ?? 0.9);
    });
    api.getVersion().then(setVersion);
  }, []);

  const [floatVisible, setFloatVisible] = useState(false);

  useEffect(() => {
    api.getFloatVisible().then(setFloatVisible);
  }, []);

  const save = async () => {
    const settings = {
      dailyBudget: parseFloat(dailyBudget as string) || 0,
      monthlyBudget: parseFloat(monthlyBudget as string) || 0,
      requestThreshold: parseFloat(requestThreshold as string) || 0,
      shortcut,
      floatShortcut,
      floatOpacity,
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

  return (
    <div className="settings-page">
      <div className="settings-section">
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
        <div className="setting-group">
          <h4>悬浮窗</h4>
          <div className="setting-row">
            <label>悬浮费用窗口:</label>
            <button className="btn-float-toggle" onClick={toggleFloat}>
              {floatVisible ? '关闭' : '开启'}
            </button>
          </div>
          <div className="setting-hint">始终置顶的小窗口，实时显示今日费用</div>
          <div className="setting-row">
            <label>透明度:</label>
            <input type="range" min="0.3" max="1" step="0.05" value={floatOpacity} onChange={e => setFloatOpacity(Number(e.target.value))} />
            <span className="opacity-val">{Math.round(floatOpacity * 100)}%</span>
          </div>
        </div>
        <button className="btn-save" onClick={save}>保存设置</button>
        {status && <span className="save-status">{status}</span>}
        <div className="setting-group" style={{ marginTop: 24 }}>
          <h4>关于</h4>
          <div className="setting-row">
            <label>版本:</label>
            <span className="version-text">v{version}</span>
          </div>
          <div className="setting-hint">Tauri v2 + React + Rust</div>
        </div>
      </div>
    </div>
  );
}
