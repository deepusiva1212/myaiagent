// src/core/supervisor.js
// ─────────────────────────────────────────────────────────────────────────────
// THE SUPERVISOR
// Central routing brain. Every incoming message flows through here:
//   1. Classify intent (keyword fast-path, then LLM if ambiguous)
//   2. Route to the appropriate sub-agent
//   3. Return a standardised response envelope
//
// This maps to a LangGraph "supervisor node" pattern — each agent is a node,
// the Supervisor is the conditional edge that decides which node runs next.
// ─────────────────────────────────────────────────────────────────────────────

import { classifyIntent, INTENT } from './intent-classifier.js';
import { callLLM }                from '../utils/llm-caller.js';
import { handleVoiceIntent }      from '../agents/voice-agent.js';
import {
  handleSupportIntent,
  handleNewsIntent,
  handleChatIntent,
} from '../agents/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// route — the single entry point for all agent routing
//
// @param {object} options
//   prompt:    string   — the latest user message
//   messages:  array    — full conversation history [{ role, content }]
//   sessionId: string   — unique ID per browser tab / session
//   logger:    pino     — request-scoped logger from Fastify
//
// @returns AgentResponse { agent, intent, text, provider, fallbackUsed, meta, latencyMs }
// ─────────────────────────────────────────────────────────────────────────────
export async function route({ prompt, messages, sessionId, logger }) {
  const t0 = Date.now();

  // ── Step 1: Classify intent ───────────────────────────────────────────────
  const intent = await classifyIntent(prompt, callLLM.bind(null), logger);
  logger.info({ intent, sessionId }, 'Supervisor › routing to agent');

  // ── Step 2: Dispatch to the matching sub-agent ────────────────────────────
  const agentCtx = { prompt, messages, sessionId, logger };
  let agentResponse;

  switch (intent) {
    case INTENT.VOICE:
      agentResponse = await handleVoiceIntent(agentCtx);
      break;
    case INTENT.SUPPORT:
      agentResponse = await handleSupportIntent(agentCtx);
      break;
    case INTENT.NEWS:
      agentResponse = await handleNewsIntent(agentCtx);
      break;
    case INTENT.CHAT:
    default:
      agentResponse = await handleChatIntent(agentCtx);
      break;
  }

  // ── Step 3: Standardised response envelope ────────────────────────────────
  return {
    intent,
    latencyMs: Date.now() - t0,
    ...agentResponse,
  };
}
