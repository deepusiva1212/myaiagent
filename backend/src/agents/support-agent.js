// src/agents/support-agent.js
// ─────────────────────────────────────────────────────────────────────────────
// HELP DESK / SUPPORT AGENT
// Handles bug reports, complaints, refund requests, and how-to questions.
// In Phase 2: integrate with Zendesk / Freshdesk / your ticketing system.
// ─────────────────────────────────────────────────────────────────────────────

import { callLLM } from '../utils/llm-caller.js';

const SUPPORT_SYSTEM_PROMPT = `You are a senior support specialist. Your role is to:
1. Empathise with the user's issue immediately.
2. Categorise it (Bug / Account / Billing / How-To / Other).
3. Provide a clear, step-by-step resolution or escalation path.
4. Always end with a ticket reference placeholder: [TICKET: AUTO-GENERATED].
Be professional, calm, and solutions-focused.`;

export async function handleSupportIntent({ messages, sessionId, logger }) {
  logger.info({ sessionId, agent: 'support' }, 'Agent › support handler invoked');

  const llmResponse = await callLLM({
    logger,
    systemPrompt: SUPPORT_SYSTEM_PROMPT,
    messages,
    maxTokens: 1024,
  });

  // TODO Phase 2: auto-create ticket in Zendesk using REST API
  // const ticket = await zendeskClient.tickets.create({ subject, comment });

  return {
    agent:    'support',
    text:     llmResponse.text,
    provider: llmResponse.provider,
    meta: {
      ticketId:  `TKT-${Date.now()}`,   // placeholder — replace with real ID
      escalated: false,
    },
  };
}
