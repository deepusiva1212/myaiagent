// src/components/ChatWindow.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CHAT WINDOW COMPONENT
// Primary frontend interface. Purely presentational — all logic lives in useChat.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { useChat }     from '../hooks/useChat.js';
import { AgentBadge }  from './AgentBadge.jsx';

// ── Simple markdown-lite renderer (bold, inline code, line breaks) ────────────
function renderText(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <span key={i}>
      {line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={j} style={{ background: '#1e1e2e', color: '#cba6f7', padding: '1px 5px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        return part;
      })}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

// ── Suggested prompts to help new users explore the system ───────────────────
const SUGGESTIONS = [
  { label: '📞 Make a call',    text: 'I need to call someone at +91 98765 43210' },
  { label: '🎧 Report issue',   text: 'I cannot log into my account — getting a 403 error' },
  { label: '📰 Latest news',    text: 'What are the latest developments in AI today?' },
  { label: '💬 General chat',   text: 'Explain how WebSockets differ from HTTP polling' },
];

export function ChatWindow() {
  const { messages, isLoading, error, sendUserMessage, clearChat, sessionId } = useChat();
  const [input, setInput]   = useState('');
  const bottomRef           = useRef(null);
  const textareaRef         = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendUserMessage(text);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={styles.shell}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.logo}>🤖</div>
          <div>
            <div style={styles.headerTitle}>Multi-Agent System</div>
            <div style={styles.headerSub}>
              Voice · Support · News · Chat &nbsp;
              <span style={{ opacity: 0.5, fontSize: '10px' }}>sid: {sessionId.slice(-8)}</span>
            </div>
          </div>
        </div>
        <button onClick={clearChat} style={styles.clearBtn} title="New conversation">↺ New</button>
      </header>

      {/* ── Message list ───────────────────────────────────────────── */}
      <div style={styles.messageList}>
        {isEmpty && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🧠</div>
            <h2 style={styles.emptyTitle}>Supervisor ready</h2>
            <p style={styles.emptyDesc}>
              Type anything — the Supervisor classifies your intent and routes it to<br />
              the best sub-agent automatically.
            </p>
            <div style={styles.suggestions}>
              {SUGGESTIONS.map(s => (
                <button key={s.text} style={styles.chip} onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ ...styles.messageRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              {msg.role === 'assistant' && (
                <AgentBadge agent={msg.agent} provider={msg.provider} fallback={msg.fallback} />
              )}
              <div style={styles.bubbleText}>{renderText(msg.text)}</div>

              {/* Voice meta: show WS token if call was initiated */}
              {msg.meta?.callInitiated && (
                <div style={styles.metaBadge}>
                  📞 Call initiated &nbsp;·&nbsp; WS: {msg.meta.wsEndpoint}
                </div>
              )}
              {/* Support meta: show ticket ID */}
              {msg.meta?.ticketId && (
                <div style={styles.metaBadge}>🎫 {msg.meta.ticketId}</div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={{ ...styles.assistantBubble, padding: '14px 18px' }}>
              <div style={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div style={styles.errorToast}>⚠ {error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} style={styles.inputBar}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the Supervisor… (Enter to send, Shift+Enter for newline)"
          rows={1}
          style={styles.textarea}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()} style={styles.sendBtn}>
          {isLoading ? '⏳' : '↑'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — inline for self-contained component; move to CSS modules in Phase 2
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  shell: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    background:    '#0f0f17',
    color:         '#e2e8f0',
    fontFamily:    "'Inter', system-ui, sans-serif",
    fontSize:      '14px',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '14px 20px',
    borderBottom:   '1px solid #1e1e2e',
    background:     '#13131f',
    flexShrink:     0,
  },
  logo: { fontSize: '28px' },
  headerTitle: { fontWeight: 700, fontSize: '16px', color: '#f1f5f9' },
  headerSub:   { fontSize: '11px', color: '#64748b', marginTop: '2px' },
  clearBtn: {
    background:   'transparent',
    border:       '1px solid #2d2d3d',
    color:        '#94a3b8',
    padding:      '6px 14px',
    borderRadius: '8px',
    cursor:       'pointer',
    fontSize:     '12px',
    fontWeight:   500,
  },
  messageList: {
    flex:       1,
    overflowY:  'auto',
    padding:    '24px 20px',
    display:    'flex',
    flexDirection: 'column',
    gap:        '12px',
  },
  messageRow: {
    display:        'flex',
    width:          '100%',
  },
  userBubble: {
    background:   '#4f46e5',
    color:        '#fff',
    borderRadius: '18px 18px 4px 18px',
    padding:      '10px 16px',
    maxWidth:     '70%',
    lineHeight:   1.55,
  },
  assistantBubble: {
    background:   '#1e1e2e',
    color:        '#e2e8f0',
    borderRadius: '18px 18px 18px 4px',
    padding:      '12px 16px',
    maxWidth:     '78%',
    lineHeight:   1.6,
    border:       '1px solid #2d2d3d',
  },
  bubbleText: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  metaBadge: {
    marginTop:    '8px',
    fontSize:     '11px',
    color:        '#64748b',
    background:   '#0f0f17',
    borderRadius: '6px',
    padding:      '4px 8px',
    fontFamily:   'monospace',
  },
  empty: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    textAlign:      'center',
    padding:        '60px 20px',
    opacity:        0.85,
  },
  emptyIcon:  { fontSize: '48px', marginBottom: '16px' },
  emptyTitle: { fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' },
  emptyDesc:  { color: '#64748b', lineHeight: 1.65, margin: '0 0 28px', maxWidth: '480px' },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' },
  chip: {
    background:   '#1e1e2e',
    color:        '#94a3b8',
    border:       '1px solid #2d2d3d',
    borderRadius: '99px',
    padding:      '8px 16px',
    fontSize:     '13px',
    cursor:       'pointer',
    transition:   'all 0.15s',
  },
  inputBar: {
    display:     'flex',
    gap:         '10px',
    padding:     '16px 20px',
    borderTop:   '1px solid #1e1e2e',
    background:  '#13131f',
    flexShrink:  0,
    alignItems:  'flex-end',
  },
  textarea: {
    flex:        1,
    resize:      'none',
    background:  '#1e1e2e',
    color:       '#e2e8f0',
    border:      '1px solid #2d2d3d',
    borderRadius: '12px',
    padding:     '12px 16px',
    fontSize:    '14px',
    fontFamily:  'inherit',
    outline:     'none',
    lineHeight:  1.5,
    maxHeight:   '160px',
    overflowY:   'auto',
  },
  sendBtn: {
    width:        '44px',
    height:       '44px',
    borderRadius: '12px',
    background:   '#4f46e5',
    color:        '#fff',
    border:       'none',
    fontSize:     '20px',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
    opacity:      1,
    transition:   'opacity 0.15s',
  },
  typing: {
    display: 'flex', gap: '4px', alignItems: 'center',
  },
  errorToast: {
    background:   '#450a0a',
    color:        '#fca5a5',
    border:       '1px solid #7f1d1d',
    borderRadius: '10px',
    padding:      '10px 16px',
    fontSize:     '13px',
    margin:       '0 auto',
    maxWidth:     '500px',
  },
};
