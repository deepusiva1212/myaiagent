// src/config/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all environment-driven configuration.
// Validated on startup so the server refuses to boot with missing critical keys.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';

function require_env(key) {
  const val = process.env[key];
  if (!val) throw new Error(`[Config] Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  server: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    env:  process.env.NODE_ENV ?? 'development',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },

  llm: {
    primary: process.env.PRIMARY_LLM ?? 'claude',   // "claude" | "gemini"
    primaryTimeout:  parseInt(process.env.LLM_PRIMARY_TIMEOUT  ?? '12000', 10),
    fallbackTimeout: parseInt(process.env.LLM_FALLBACK_TIMEOUT ?? '15000', 10),

    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY ?? '' },
    gemini:    { apiKey: process.env.GEMINI_API_KEY    ?? '' },
    openai:    { apiKey: require_env('OPENAI_API_KEY') },   // fallback — always required
  },

  voice: {
    vapiApiKey:        process.env.VAPI_API_KEY        ?? '',
    twilioAccountSid:  process.env.TWILIO_ACCOUNT_SID  ?? '',
    twilioAuthToken:   process.env.TWILIO_AUTH_TOKEN   ?? '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
  },
};
