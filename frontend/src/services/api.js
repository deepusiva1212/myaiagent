// src/services/api.js
// ─────────────────────────────────────────────────────────────────────────────
// API SERVICE LAYER
// Centralises all HTTP and WebSocket calls to the Fastify backend.
// Components import from here — never call fetch() directly.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? '';  // '' = same origin (via Vite proxy)

// ─────────────────────────────────────────────────────────────────────────────
// sendMessage — POST /api/chat
// ─────────────────────────────────────────────────────────────────────────────
export async function sendMessage({ message, sessionId, history = [] }) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, history }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error ${response.status}`);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// createChatWebSocket — opens /ws/chat/:sessionId for real-time events
// Returns an object with { ws, close } for controlled teardown.
// ─────────────────────────────────────────────────────────────────────────────
export function createChatWebSocket(sessionId, { onMessage, onError, onClose } = {}) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host     = window.location.host;
  const ws       = new WebSocket(`${protocol}//${host}/ws/chat/${sessionId}`);

  ws.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data);
      onMessage?.(event);
    } catch {
      onMessage?.({ raw: ev.data });
    }
  };

  ws.onerror = (err) => {
    console.error('[WS] Chat socket error', err);
    onError?.(err);
  };

  ws.onclose = () => onClose?.();

  return {
    ws,
    close: () => ws.readyState === WebSocket.OPEN && ws.close(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// createVoiceWebSocket — opens /ws/voice/:token for audio streaming
// Called after a Voice Agent response that includes a wsToken.
// ─────────────────────────────────────────────────────────────────────────────
export function createVoiceWebSocket(wsToken, { onAudioChunk, onReady, onError } = {}) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws       = new WebSocket(`${protocol}//${window.location.host}/ws/voice/${wsToken}`);

  ws.binaryType = 'arraybuffer'; // audio comes as binary frames

  ws.onmessage = (ev) => {
    if (ev.data instanceof ArrayBuffer) {
      // Binary audio frame — pass to Web Audio API for playback in Phase 2
      onAudioChunk?.(ev.data);
    } else {
      const event = JSON.parse(ev.data);
      if (event.event === 'voice_ready') onReady?.();
      if (event.event === 'error')       onError?.(new Error(event.message));
    }
  };

  ws.onerror = (err) => {
    console.error('[WS] Voice socket error', err);
    onError?.(err);
  };

  return { ws, close: () => ws.readyState === WebSocket.OPEN && ws.close() };
}
