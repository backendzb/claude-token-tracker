import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo } from '@tauri-apps/api/event';
import Sidebar from './components/layout/Sidebar';
import PageHeader from './components/layout/PageHeader';
import OverviewPage from './components/overview/OverviewPage';
import ComparePage from './components/compare/ComparePage';
import RankingPage from './components/ranking/RankingPage';
import SessionsPage from './components/sessions/SessionsPage';
import ChatPage from './components/chat/ChatPage';
import SettingsPage from './components/settings/SettingsPage';
import FloatWindow from './components/float/FloatWindow';
import { api } from './api';
import './App.css';

const isFloat = (() => {
  try { return getCurrentWindow().label === 'float'; } catch { return false; }
})();

const pageTitles: Record<string, string> = {
  '总览': '总览', '对比': '对比', '排名': '排名',
  '会话': '会话', '对话': '对话', '设置': '设置',
};

function App() {
  const [activePage, setActivePage] = useState('总览');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (isFloat) return;
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  if (isFloat) {
    return <FloatWindow />;
  }

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const settings = await api.getSettings();
    await api.saveSettings({ ...settings, theme: next });
    emitTo('float', 'theme-changed', next);
  };

  return (
    <div className="app-layout">
      <Sidebar active={activePage} onChange={setActivePage} />
      <div className="app-content">
        <PageHeader title={pageTitles[activePage]} onToggleTheme={toggleTheme} />
        <div className="app-page">
          {activePage === '总览' && <OverviewPage />}
          {activePage === '对比' && <ComparePage />}
          {activePage === '排名' && <RankingPage />}
          {activePage === '会话' && <SessionsPage />}
          {activePage === '对话' && <ChatPage />}
          {activePage === '设置' && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}

export default App;
