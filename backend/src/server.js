// src/server.js
// ─────────────────────────────────────────────────────────────────────────────
// FASTIFY SERVER — Entry Point
// Registers plugins, defines routes, and starts the server.
//
// Routes:
//   POST /api/chat          → Supervisor routing (primary endpoint)
//   GET  /api/health        → Health check with LLM provider status
//   WS   /ws/chat/:id       → WebSocket channel for future token streaming
//   WS   /ws/voice/:token   → WebSocket channel for voice audio streaming
//   POST /webhooks/vapi     → Vapi.ai event webhook (Phase 2 placeholder)
//   POST /webhooks/twilio   → Twilio status callback (Phase 2 placeholder)
// ─────────────────────────────────────────────────────────────────────────────

import Fastify       from 'fastify';
import cors          from '@fastify/cors';
import websocket     from '@fastify/websocket';
import { config }    from './config/index.js';
import { route }     from './core/supervisor.js';
import {
  registerChatSession,
  attachSocket,
  registerVoiceSession,
} from './websocket/ws-manager.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fastify instance with structured Pino logger
// ─────────────────────────────────────────────────────────────────────────────
const app = Fastify({
  logger: {
    level: config.server.logLevel,
    ...(config.server.env === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}
    ),
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: config.server.env === 'production'
    ? ['https://your-frontend-domain.com']   // lock down in production
    : true,                                   // allow all origins in dev
  methods: ['GET', 'POST', 'OPTIONS'],
});

// @fastify/websocket wraps the `ws` library — required for /ws/* routes
await app.register(websocket);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat  — PRIMARY ENDPOINT
// Receives a message, runs it through the Supervisor, returns agent response.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/chat', {
  schema: {
    body: {
      type: 'object',
      required: ['message'],
      properties: {
        message:   { type: 'string', minLength: 1, maxLength: 8000 },
        sessionId: { type: 'string' },
        history:   {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role:    { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  const { message, sessionId = `anon_${Date.now()}`, history = [] } = request.body;
  const logger = request.log;

  // Build full message history for the LLM (include the new user message)
  const messages = [
    ...history,
    { role: 'user', content: message },
  ];

  try {
    // Hand off to the Supervisor for intent classification and agent routing
    const result = await route({ prompt: message, messages, sessionId, logger });

    logger.info(
      { agent: result.agent, intent: result.intent, latencyMs: result.latencyMs, fallback: result.fallbackUsed },
      'Request completed'
    );

    return reply.code(200).send({
      success: true,
      sessionId,
      ...result,
    });

  } catch (err) {
    // All LLM providers failed — return a graceful error (never expose stack traces)
    logger.error({ err: err.message, sessionId }, 'All providers failed');

    return reply.code(503).send({
      success: false,
      error:   err.message,
      sessionId,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health — Health check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', async () => ({
  status:    'ok',
  timestamp: new Date().toISOString(),
  primaryLLM: config.llm.primary,
  env:        config.server.env,
  voice: {
    vapiConfigured:   !!config.voice.vapiApiKey,
    twilioConfigured: !!config.voice.twilioAccountSid,
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// WS /ws/chat/:sessionId — Chat WebSocket
// Currently used for connection tracking; Phase 2 will stream LLM tokens here.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/ws/chat/:sessionId', { websocket: true }, (socket, request) => {
  const { sessionId } = request.params;
  request.log.info({ sessionId }, 'WS › chat connection opened');

  registerChatSession(sessionId, socket);

  socket.on('message', (raw) => {
    // Future: receive partial inputs or control events from the client
    request.log.debug({ sessionId, msg: raw.toString() }, 'WS chat message');
  });

  socket.on('close', () => {
    request.log.info({ sessionId }, 'WS › chat connection closed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WS /ws/voice/:token — Voice audio streaming
// The Voice Agent generates a wsToken and passes it to the frontend.
// The frontend opens this WS to receive real-time audio from Vapi/Twilio.
// Phase 2: this channel will receive binary audio frames from the PSTN bridge.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/ws/voice/:token', { websocket: true }, (socket, request) => {
  const { token } = request.params;
  request.log.info({ token }, 'WS › voice connection opened');

  const attached = attachSocket(token, socket);
  if (!attached) {
    // Token not found — reject immediately
    socket.send(JSON.stringify({ event: 'error', message: 'Invalid or expired voice token' }));
    socket.close();
    return;
  }

  socket.send(JSON.stringify({ event: 'voice_ready', token }));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks/vapi — Vapi.ai event webhook (Phase 2 placeholder)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhooks/vapi', async (request, reply) => {
  const event = request.body;
  request.log.info({ type: event?.type }, 'Webhook › Vapi event received');
  // TODO Phase 2: handle call-start, transcript, call-end, audio events
  return reply.code(200).send({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks/twilio — Twilio status callback (Phase 2 placeholder)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhooks/twilio', async (request, reply) => {
  const event = request.body;
  request.log.info({ status: event?.CallStatus }, 'Webhook › Twilio callback received');
  // TODO Phase 2: update call status, handle recording events
  return reply.code(200).send('<Response/>'); // TwiML empty response
});

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
try {
  await app.listen({ port: config.server.port, host: '0.0.0.0' });
  app.log.info(`🤖 Multi-Agent Supervisor ready on port ${config.server.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
