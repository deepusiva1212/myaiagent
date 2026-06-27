// src/core/intent-classifier.js
// ─────────────────────────────────────────────────────────────────────────────
// INTENT CLASSIFIER
// The Supervisor's first pass: determines which sub-agent should handle the
// incoming message. Uses a lightweight keyword/pattern check first (free, fast)
// and falls back to an LLM-based classification only when ambiguous.
// ─────────────────────────────────────────────────────────────────────────────

// Intent enum — keeps strings consistent across the codebase
export const INTENT = Object.freeze({
  VOICE:   'voice',     // → Voice Agent  (Vapi / Twilio)
  SUPPORT: 'support',   // → Help Desk Agent
  NEWS:    'news',      // → Live Daily Updates Agent
  CHAT:    'chat',      // → Routine Chat Agent (default)
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyword-based fast-path classifier
// Cost: zero tokens, <1ms. Handles ~80% of clear-cut cases.
// ─────────────────────────────────────────────────────────────────────────────
const KEYWORD_MAP = [
  {
    intent: INTENT.VOICE,
    patterns: [/\bcall\b/i, /\bphone\b/i, /\bvoice\b/i, /\bdial\b/i, /\btwilio\b/i, /\bvapi\b/i, /\bspeak (with|to)\b/i],
  },
  {
    intent: INTENT.SUPPORT,
    patterns: [/\bhelp\b/i, /\bsupport\b/i, /\bticket\b/i, /\bissue\b/i, /\bbug\b/i, /\bproblem\b/i, /\bcan('t| not)\b/i, /\bnot work/i, /\berror\b/i, /\brefund\b/i],
  },
  {
    intent: INTENT.NEWS,
    patterns: [/\bnews\b/i, /\blatest\b/i, /\bupdate(s)?\b/i, /\btoday\b/i, /\bbreaking\b/i, /\bheadline/i, /\bcurrent event/i, /\bwhat('s| is) happening/i],
  },
];

function keywordClassify(prompt) {
  for (const { intent, patterns } of KEYWORD_MAP) {
    if (patterns.some(re => re.test(prompt))) return intent;
  }
  return null; // ambiguous — caller will do LLM classification
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM-based classification (used only when keyword pass is inconclusive)
// ─────────────────────────────────────────────────────────────────────────────
async function llmClassify(prompt, callLLM, logger) {
  const { text } = await callLLM({
    logger,
    systemPrompt: `You are an intent classifier for a multi-agent AI system.
Classify the user's message into EXACTLY ONE of these intents and reply with only that word:
- voice    (user wants to make/receive a phone call or talk via voice)
- support  (user has a problem, needs help, or is reporting an issue)
- news     (user wants current events, daily updates, or recent news)
- chat     (anything else — general conversation, Q&A, creative tasks)

Reply with one lowercase word only.`,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 10,
  });

  const classified = text.trim().toLowerCase();
  return Object.values(INTENT).includes(classified) ? classified : INTENT.CHAT;
}

// ─────────────────────────────────────────────────────────────────────────────
// classifyIntent — exported function used by the Supervisor
// ─────────────────────────────────────────────────────────────────────────────
export async function classifyIntent(prompt, callLLM, logger) {
  // Fast path first
  const fast = keywordClassify(prompt);
  if (fast) {
    logger?.debug({ intent: fast, method: 'keyword' }, 'Supervisor › intent classified');
    return fast;
  }

  // Slow path: spend tokens only when needed
  logger?.debug({ method: 'llm' }, 'Supervisor › ambiguous prompt, using LLM classifier');
  const intent = await llmClassify(prompt, callLLM, logger);
  logger?.debug({ intent, method: 'llm' }, 'Supervisor › intent classified');
  return intent;
}
