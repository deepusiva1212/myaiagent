// src/hooks/useChat.js
// ─────────────────────────────────────────────────────────────────────────────
// useChat — custom hook that owns all chat state and side-effects.
// Keeps the ChatWindow component clean and purely presentational.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, createChatWebSocket } from '../services/api.js';

// Generate a stable session ID for this browser tab
function makeSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const [messages,  setMessages]  = useState([]);   // { id, role, text, meta }
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);

  const sessionIdRef = useRef(makeSessionId());
  const wsRef        = useRef(null);

  // ── Open WebSocket on mount, close on unmount ─────────────────────────────
  useEffect(() => {
    const { ws, close } = createChatWebSocket(sessionIdRef.current, {
      onMessage: (event) => {
        // Future: handle token-streaming events here
        if (event.event === 'token') {
          // Append streaming token to the last assistant message
        }
      },
    });
    wsRef.current = ws;
    return close;
  }, []);

  // ── sendUserMessage — called by the UI on form submit ─────────────────────
  const sendUserMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    // Build history in the format the backend expects
    const history = messages.map(m => ({ role: m.role, content: m.text }));

    try {
      const result = await sendMessage({
        message:   text,
        sessionId: sessionIdRef.current,
        history,
      });

      const assistantMsg = {
        id:       Date.now() + 1,
        role:     'assistant',
        text:     result.text,
        agent:    result.agent,
        intent:   result.intent,
        provider: result.provider,
        fallback: result.fallbackUsed,
        meta:     result.meta,
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionIdRef.current = makeSessionId();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendUserMessage,
    clearChat,
    sessionId: sessionIdRef.current,
  };
}
