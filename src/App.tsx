import { useState, useEffect } from 'react';
import TitleBar from './components/layout/TitleBar';
import TabNav from './components/layout/TabNav';
import OverviewPage from './components/overview/OverviewPage';
import './App.css';

const tabs = ['总览', '对比', '排名', '会话', '对话', '设置'] as const;
type Tab = typeof tabs[number];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('总览');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

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
        {activeTab === '对比' && <Placeholder name="对比" />}
        {activeTab === '排名' && <Placeholder name="排名" />}
        {activeTab === '会话' && <Placeholder name="会话" />}
        {activeTab === '对话' && <Placeholder name="对话" />}
        {activeTab === '设置' && <Placeholder name="设置" />}
      </main>
    </>
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>
      {name} — 即将实现
    </div>
  );
}

export default App;
