import { useState, useEffect } from 'react';
import TitleBar from './components/layout/TitleBar';
import TabNav from './components/layout/TabNav';
import OverviewPage from './components/overview/OverviewPage';
import ComparePage from './components/compare/ComparePage';
import RankingPage from './components/ranking/RankingPage';
import SessionsPage from './components/sessions/SessionsPage';
import ChatPage from './components/chat/ChatPage';
import SettingsPage from './components/settings/SettingsPage';
import FloatWindow from './components/float/FloatWindow';
import './App.css';

const tabs = ['总览', '对比', '排名', '会话', '对话', '设置'] as const;
type Tab = typeof tabs[number];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('总览');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFloat, setIsFloat] = useState(false);

  useEffect(() => {
    // Check if this is the float window
    if (window.location.hash === '#/float' || (window as any).__TAURI_FLOAT__) {
      setIsFloat(true);
      return;
    }
    // Listen for hash changes (float window navigation)
    const onHash = () => {
      if (window.location.hash === '#/float') setIsFloat(true);
    };
    window.addEventListener('hashchange', onHash);

    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Float window — render only the float component
  if (isFloat) {
    return <FloatWindow />;
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <>
      <TitleBar theme={theme} onToggleTheme={toggleTheme} />
      <TabNav tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <main className="page-container">
        {activeTab === '总览' && <OverviewPage />}
        {activeTab === '对比' && <ComparePage />}
        {activeTab === '排名' && <RankingPage />}
        {activeTab === '会话' && <SessionsPage />}
        {activeTab === '对话' && <ChatPage />}
        {activeTab === '设置' && <SettingsPage />}
      </main>
    </>
  );
}

export default App;
