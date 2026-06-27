// src/utils/llm-caller.js
// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK MECHANISM
// Wraps every LLM call in a two-stage try/catch with a configurable timeout.
//
// Stage 1 → Primary model (Claude or Gemini, set via PRIMARY_LLM env var)
// Stage 2 → OpenAI (ChatGPT) as universal fallback — guarantees zero downtime
//
// Each stage fires a timeout race so a hanging upstream never blocks the server.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic  from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../config/index.js';

// ── SDK singletons (initialised once, reused across all requests) ─────────────
const anthropic = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
const genai     = new GoogleGenerativeAI(config.llm.gemini.apiKey);
const openai    = new OpenAI({ apiKey: config.llm.openai.apiKey });

// ─────────────────────────────────────────────────────────────────────────────
// Helper: wraps a promise in a timeout race.
// Rejects with a typed error so the catch block can distinguish it.
// ─────────────────────────────────────────────────────────────────────────────
function withTimeout(promise, ms, label) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude (Anthropic) call
// ─────────────────────────────────────────────────────────────────────────────
async function callClaude({ messages, systemPrompt, maxTokens = 1024 }) {
  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system:     systemPrompt ?? 'You are a helpful assistant.',
    messages,                         // [{ role, content }]
  });

  return {
    text:     response.content[0].text,
    provider: 'claude',
    model:    response.model,
    usage:    response.usage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini (Google) call
// ─────────────────────────────────────────────────────────────────────────────
async function callGemini({ messages, systemPrompt, maxTokens = 1024 }) {
  const model = genai.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt ?? 'You are a helpful assistant.',
    generationConfig: { maxOutputTokens: maxTokens },
  });

  // Gemini uses "parts" format — map from OpenAI-style messages
  const history = messages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const lastMsg = messages.at(-1).content;
  const result  = await chat.sendMessage(lastMsg);
  const text    = result.response.text();

  return { text, provider: 'gemini', model: 'gemini-1.5-flash', usage: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI (ChatGPT) call — always used as fallback
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAI({ messages, systemPrompt, maxTokens = 1024 }) {
  const response = await openai.chat.completions.create({
    model:      'gpt-4o-mini',        // cost-efficient fallback model
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt ?? 'You are a helpful assistant.' },
      ...messages,
    ],
  });

  return {
    text:     response.choices[0].message.content,
    provider: 'openai',
    model:    response.model,
    usage:    response.usage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY DISPATCHER
// Maps the PRIMARY_LLM config to the correct call function.
// ─────────────────────────────────────────────────────────────────────────────
const primaryCallers = { claude: callClaude, gemini: callGemini };

// ─────────────────────────────────────────────────────────────────────────────
// callLLM — the single exported function used by every agent.
//
// @param {object} payload
//   messages:     [{ role: 'user'|'assistant', content: string }]
//   systemPrompt: string   — agent-specific instruction
//   maxTokens:    number   — optional token cap
//   logger:       pino     — passed in from the route handler for request-scoped logging
//
// @returns { text, provider, model, usage, fallbackUsed }
// ─────────────────────────────────────────────────────────────────────────────
export async function callLLM(payload) {
  const { logger, ...llmPayload } = payload;
  const primaryName = config.llm.primary;                     // "claude" | "gemini"
  const primaryFn   = primaryCallers[primaryName] ?? callClaude;

  // ── Stage 1: Primary model ────────────────────────────────────────────────
  try {
    logger?.info({ provider: primaryName }, 'LLM › attempting primary');

    const result = await withTimeout(
      primaryFn(llmPayload),
      config.llm.primaryTimeout,
      `Primary (${primaryName})`
    );

    logger?.info({ provider: result.provider }, 'LLM › primary succeeded');
    return { ...result, fallbackUsed: false };

  } catch (primaryErr) {
    // Log the failure but do NOT surface it to the user yet — try fallback first.
    logger?.warn(
      { err: primaryErr.message, provider: primaryName },
      'LLM › primary failed, escalating to OpenAI fallback'
    );
  }

  // ── Stage 2: OpenAI fallback ──────────────────────────────────────────────
  try {
    const result = await withTimeout(
      callOpenAI(llmPayload),
      config.llm.fallbackTimeout,
      'Fallback (openai)'
    );

    logger?.info({ provider: 'openai' }, 'LLM › fallback succeeded');
    return { ...result, fallbackUsed: true };

  } catch (fallbackErr) {
    // Both providers failed — surface a structured error upstream.
    logger?.error({ err: fallbackErr.message }, 'LLM › ALL providers failed');
    throw new Error('All LLM providers are currently unavailable. Please try again shortly.');
  }
}
