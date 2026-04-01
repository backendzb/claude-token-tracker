import { useState, useEffect } from 'react';
import { api } from '../../api';
import './ChatPage.css';

interface SessionItem {
  sessionId: string;
  project: string;
  firstUserMsg: string;
  firstTimestamp: string;
  lastTimestamp: string;
  msgCount: number;
}

interface Message {
  role: string;
  content: string;
  timestamp: string;
  model: string;
  toolCalls: string[];
}

function relativeTime(ts: string) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' 小时前';
  return Math.floor(hr / 24) + ' 天前';
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [project, setProject] = useState('');

  useEffect(() => {
    api.getSessionIndex().then(setSessions).catch(console.error);
  }, []);

  const openChat = async (id: string) => {
    setActiveId(id);
    try {
      const data = await api.loadConversation(id);
      setMessages(data.messages || []);
      setProject(data.project || '');
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = sessions.filter(s =>
    !search || s.firstUserMsg.toLowerCase().includes(search.toLowerCase()) ||
    s.project.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        <input
          className="chat-search"
          placeholder="搜索对话..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="chat-list">
          {filtered.map(s => (
            <div
              key={s.sessionId}
              className={`chat-list-item ${s.sessionId === activeId ? 'active' : ''}`}
              onClick={() => openChat(s.sessionId)}
            >
              <div className="chat-list-preview">{s.firstUserMsg || '(空)'}</div>
              <div className="chat-list-meta">
                <span>{s.project}</span>
                <span>{relativeTime(s.lastTimestamp)}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="chat-list-empty">无对话</div>}
        </div>
      </div>
      <div className="chat-main">
        {activeId ? (
          <>
            <div className="chat-header">
              <span className="chat-header-project">{project}</span>
              <span className="chat-header-id">{activeId.slice(0, 8)}</span>
            </div>
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role}`}>
                  <div className="chat-bubble-header">
                    <span className={`chat-role ${m.role}`}>
                      {m.role === 'user' ? '用户' : 'Claude'}
                    </span>
                    {m.model && <span className="chat-model">{m.model}</span>}
                    {m.timestamp && (
                      <span className="chat-time">
                        {new Date(m.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                      </span>
                    )}
                  </div>
                  <div className="chat-content">{m.content}</div>
                  {m.toolCalls.length > 0 && (
                    <div className="chat-tools">
                      {m.toolCalls.map((t, j) => <span key={j} className="chat-tool-tag">{t}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="chat-empty">选择一个对话查看</div>
        )}
      </div>
    </div>
  );
}
