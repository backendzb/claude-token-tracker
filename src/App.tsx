import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import PageHeader from './components/layout/PageHeader';
import OverviewPage from './components/overview/OverviewPage';
import ComparePage from './components/compare/ComparePage';
import RankingPage from './components/ranking/RankingPage';
import SessionsPage from './components/sessions/SessionsPage';
import ChatPage from './components/chat/ChatPage';
import SettingsPage from './components/settings/SettingsPage';
import { applyTheme, getStoredTheme } from './themes';
import { api } from './api';
import './App.css';

const pageTitles: Record<string, string> = {
  '总览': '总览', '对比': '对比', '排名': '排名',
  '会话': '会话', '对话': '对话', '设置': '设置',
};

function App() {
  const [activePage, setActivePage] = useState('总览');
  const [theme, setTheme] = useState(getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, []);

  const changeTheme = async (themeId: string) => {
    setTheme(themeId);
    applyTheme(themeId);
    const settings = await api.getSettings();
    await api.saveSettings({ ...settings, theme: themeId });
  };

  return (
    <div className="app-layout">
      <Sidebar active={activePage} onChange={setActivePage} />
      <div className="app-content">
        <PageHeader title={pageTitles[activePage]} onToggleTheme={() => {
          const next = theme.includes('light') ? 'deep-ocean' : 'light';
          changeTheme(next);
        }} />
        <div className="app-page">
          {activePage === '总览' && <OverviewPage />}
          {activePage === '对比' && <ComparePage />}
          {activePage === '排名' && <RankingPage />}
          {activePage === '会话' && <SessionsPage />}
          {activePage === '对话' && <ChatPage />}
          {activePage === '设置' && <SettingsPage currentTheme={theme} onThemeChange={changeTheme} />}
        </div>
      </div>
    </div>
  );
}

export default App;
