// src/agents/news-agent.js
// ─────────────────────────────────────────────────────────────────────────────
// LIVE DAILY UPDATES / NEWS AGENT
// Handles requests for current events and real-time information.
// Phase 1: LLM with a strong recency-aware prompt.
// Phase 2: Wire up a live news API (NewsAPI / GNews / Perplexity Sonar)
//          before passing context to the LLM.
// ─────────────────────────────────────────────────────────────────────────────

import { callLLM } from '../utils/llm-caller.js';

const NEWS_SYSTEM_PROMPT = `You are a real-time news analyst and briefing specialist.
Today's date is ${new Date().toDateString()}.
Your job is to:
1. Summarise what you know about the requested topic.
2. Clearly state that your knowledge has a cutoff date when relevant.
3. Suggest specific search terms the user can use for the very latest updates.
4. Format your response as a clean briefing with sections: SUMMARY | KEY POINTS | SOURCE SUGGESTIONS.
Be concise, factual, and neutral on political topics.`;

export async function handleNewsIntent({ messages, sessionId, logger }) {
  logger.info({ sessionId, agent: 'news' }, 'Agent › news handler invoked');

  // TODO Phase 2: fetch live articles from NewsAPI and prepend as context:
  // const articles = await newsApiClient.getTopHeadlines({ q: extractedTopic });
  // inject article summaries into the system prompt before the LLM call.

  const llmResponse = await callLLM({
    logger,
    systemPrompt: NEWS_SYSTEM_PROMPT,
    messages,
    maxTokens: 1024,
  });

  return {
    agent:    'news',
    text:     llmResponse.text,
    provider: llmResponse.provider,
    meta:     { liveDataInjected: false }, // flip to true in Phase 2
  };
}

// ─────────────────────────────────────────────────────────────────────────────

// src/agents/chat-agent.js
// ─────────────────────────────────────────────────────────────────────────────
// ROUTINE CHAT AGENT (default handler)
// General-purpose conversational AI. Handles anything not claimed by the
// specialised agents: creative tasks, Q&A, brainstorming, calculations, etc.
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are a highly capable AI assistant.
You help with a wide range of tasks: answering questions, writing, coding,
brainstorming, analysis, and general conversation.
Be helpful, concise, and direct. Use markdown formatting where it aids clarity.`;

export async function handleChatIntent({ messages, sessionId, logger }) {
  logger.info({ sessionId, agent: 'chat' }, 'Agent › chat handler invoked');

  const llmResponse = await callLLM({
    logger,
    systemPrompt: CHAT_SYSTEM_PROMPT,
    messages,
    maxTokens: 2048,
  });

  return {
    agent:    'chat',
    text:     llmResponse.text,
    provider: llmResponse.provider,
    meta:     {},
  };
}
