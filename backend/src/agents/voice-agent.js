// src/agents/voice-agent.js
// ─────────────────────────────────────────────────────────────────────────────
// VOICE AGENT
// Handles all telephony-related requests via Vapi.ai / Twilio.
//
// Current state: Scaffolded with placeholder call initiation logic.
// WebSocket preparation: The `initiateCall` fn returns a wsToken that the
// frontend uses to open a persistent WebSocket channel for real-time audio
// streaming. In production, this token is validated in ws-manager.js.
// ─────────────────────────────────────────────────────────────────────────────

import { callLLM } from '../utils/llm-caller.js';
import { config }  from '../config/index.js';

// ─── System prompt for the voice sub-agent ───────────────────────────────────
const VOICE_SYSTEM_PROMPT = `You are a voice assistant coordinator.
Your job is to:
1. Confirm what type of call the user wants to make or receive.
2. Extract the phone number or contact name if present.
3. Provide a brief, friendly response that will be converted to speech.
Keep responses SHORT (under 50 words) — they will be spoken aloud.`;

// ─────────────────────────────────────────────────────────────────────────────
// handleVoiceIntent — primary entry point called by the Supervisor
// ─────────────────────────────────────────────────────────────────────────────
export async function handleVoiceIntent({ prompt, sessionId, messages, logger }) {
  logger.info({ sessionId, agent: 'voice' }, 'Agent › voice handler invoked');

  // Step 1: Use LLM to understand exactly what voice action is needed
  const llmResponse = await callLLM({
    logger,
    systemPrompt: VOICE_SYSTEM_PROMPT,
    messages,
    maxTokens: 256,
  });

  // Step 2: Extract phone number if the user mentioned one (simple regex)
  const phoneMatch = prompt.match(/\+?[\d\s\-().]{7,15}/);
  const phoneNumber = phoneMatch ? phoneMatch[0].replace(/\s/g, '') : null;

  // Step 3: If we have a number, scaffold the Vapi/Twilio call initiation
  let callMeta = null;
  if (phoneNumber) {
    callMeta = await initiateVoiceCall({ phoneNumber, sessionId, logger });
  }

  return {
    agent:    'voice',
    text:     llmResponse.text,
    provider: llmResponse.provider,
    meta: {
      phoneNumber,
      callInitiated: !!callMeta,
      // wsToken: returned so the frontend knows to open a WebSocket connection
      // for real-time audio. The WS endpoint is /ws/voice/:token
      wsToken: callMeta?.wsToken ?? null,
      wsEndpoint: callMeta ? `/ws/voice/${callMeta.wsToken}` : null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// initiateVoiceCall — scaffolds the Vapi / Twilio call
// TODO: Replace placeholder with real SDK calls in Phase 2
// ─────────────────────────────────────────────────────────────────────────────
async function initiateVoiceCall({ phoneNumber, sessionId, logger }) {
  logger.info({ phoneNumber, sessionId }, 'Voice › initiating call (placeholder)');

  // ── VAPI integration point ──────────────────────────────────────────────
  // In production, uncomment and call the Vapi SDK:
  //
  // import Vapi from '@vapi-ai/server-sdk';
  // const vapi = new Vapi(config.voice.vapiApiKey);
  // const call = await vapi.calls.create({
  //   phoneNumberId: config.voice.vapiPhoneNumberId,
  //   customer: { number: phoneNumber },
  //   assistant: { /* assistant config */ },
  // });
  // ───────────────────────────────────────────────────────────────────────

  // ── TWILIO fallback integration point ──────────────────────────────────
  // const twilio = require('twilio')(config.voice.twilioAccountSid, config.voice.twilioAuthToken);
  // const call = await twilio.calls.create({
  //   to:   phoneNumber,
  //   from: config.voice.twilioPhoneNumber,
  //   url:  'https://your-domain.com/twiml/incoming',  // TwiML webhook
  // });
  // ───────────────────────────────────────────────────────────────────────

  // Generate a unique WebSocket token for this call session.
  // The frontend opens ws://host/ws/voice/<wsToken> for audio streaming.
  const wsToken = `voice_${sessionId}_${Date.now()}`;

  logger.info({ wsToken }, 'Voice › WS token generated (placeholder call)');

  return {
    callId:  `placeholder_call_${Date.now()}`,
    wsToken,
    status:  'initiated',
  };
}
