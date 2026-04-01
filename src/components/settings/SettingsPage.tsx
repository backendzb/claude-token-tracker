import { useState, useEffect } from 'react';
import { api } from '../../api';
import './SettingsPage.css';

function BatterySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  const segments = 10;
  const filled = Math.round(value * segments);
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div className="battery-wrap">
      <div className="battery-body" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onChange(Math.round(Math.max(0.3, x) * 20) / 20);
      }}>
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className={`battery-seg ${i < filled ? 'filled' : ''}`}
            style={{ background: i < filled ? color : undefined }}
          />
        ))}
      </div>
      <div className="battery-tip" />
      <span className="battery-pct">{pct}%</span>
    </div>
  );
}

export default function SettingsPage() {
  const [dailyBudget, setDailyBudget] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [requestThreshold, setRequestThreshold] = useState('');
  const [shortcut, setShortcut] = useState('Ctrl+Shift+T');
  const [floatShortcut, setFloatShortcut] = useState('');
  const [floatOpacity, setFloatOpacity] = useState(0.9);
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState('');
  const [floatVisible, setFloatVisible] = useState(false);

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
          <h4>悬浮窗</h4>
          <div className="setting-row">
            <label>悬浮费用窗口:</label>
            <button className={`toggle-btn ${floatVisible ? 'on' : ''}`} onClick={toggleFloat}>
              <span className="toggle-thumb" />
              <span className="toggle-label">{floatVisible ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div className="setting-hint">始终置顶的小窗口，实时显示今日费用</div>
          <div className="setting-row">
            <label>透明度:</label>
            <BatterySlider value={floatOpacity} onChange={setFloatOpacity} />
          </div>
          <div className="setting-hint">鼠标悬停时自动恢复完全不透明</div>
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
            <label>版本:</label>
            <span className="version-text">v{version}</span>
          </div>
          <div className="setting-hint">Tauri v2 + React + Rust</div>
        </div>
      </div>
    </div>
  );
}
