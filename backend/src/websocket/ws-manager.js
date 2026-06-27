// src/websocket/ws-manager.js
// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET MANAGER
// Manages the lifecycle of WebSocket connections used for:
//   1. Real-time chat streaming (Server-Sent Events alternative)
//   2. Voice audio streaming with Vapi/Twilio (Phase 2)
//
// Architecture note:
//   Each client connection is stored in `sessions` keyed by sessionId.
//   When the Voice Agent initiates a call, it registers a wsToken here.
//   The frontend then connects to /ws/voice/:token to begin audio streaming.
//   Vapi/Twilio webhooks write audio frames into the session's audio queue,
//   which the WebSocket forwards to the browser in real time.
// ─────────────────────────────────────────────────────────────────────────────

// In-memory session registry.
// Production: replace with Redis for multi-instance deployments.
const sessions = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// registerVoiceSession — called by Voice Agent when a call is initiated
// ─────────────────────────────────────────────────────────────────────────────
export function registerVoiceSession(wsToken, meta = {}) {
  sessions.set(wsToken, {
    type:      'voice',
    wsToken,
    socket:    null,          // populated when the frontend connects
    audioQueue: [],           // audio chunks buffered before WS connects
    createdAt: Date.now(),
    ...meta,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// attachSocket — called when the frontend WebSocket connection arrives
// ─────────────────────────────────────────────────────────────────────────────
export function attachSocket(wsToken, socket) {
  const session = sessions.get(wsToken);
  if (!session) return false;

  session.socket = socket;

  // Drain any audio that arrived before the WS connection was established
  while (session.audioQueue.length > 0) {
    socket.send(session.audioQueue.shift());
  }

  // Clean up when the client disconnects
  socket.on('close', () => {
    if (sessions.has(wsToken)) {
      sessions.get(wsToken).socket = null;
    }
  });

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// pushAudioChunk — called by Vapi/Twilio webhooks (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
export function pushAudioChunk(wsToken, chunk) {
  const session = sessions.get(wsToken);
  if (!session) return;

  if (session.socket?.readyState === 1 /* OPEN */) {
    session.socket.send(chunk);
  } else {
    // Buffer for late-connecting clients (max 50 chunks ~= ~1s of audio at 20ms frames)
    if (session.audioQueue.length < 50) session.audioQueue.push(chunk);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// broadcastToChat — sends a text event to the chat WebSocket connection
// Used for streaming LLM tokens word-by-word in the future
// ─────────────────────────────────────────────────────────────────────────────
export function broadcastToChat(sessionId, event) {
  const session = sessions.get(`chat_${sessionId}`);
  if (session?.socket?.readyState === 1) {
    session.socket.send(JSON.stringify(event));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// registerChatSession — called when a chat WebSocket connection opens
// ─────────────────────────────────────────────────────────────────────────────
export function registerChatSession(sessionId, socket) {
  const key = `chat_${sessionId}`;
  sessions.set(key, { type: 'chat', socket, sessionId, createdAt: Date.now() });

  socket.on('close', () => sessions.delete(key));

  // Acknowledge the connection
  socket.send(JSON.stringify({ event: 'connected', sessionId }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Periodic cleanup: remove sessions older than 30 minutes with no socket
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, session] of sessions.entries()) {
    if (session.createdAt < cutoff && !session.socket) {
      sessions.delete(key);
    }
  }
}, 5 * 60 * 1000); // run every 5 minutes
