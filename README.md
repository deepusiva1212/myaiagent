# Multi-Agent AI System — Phase 1

## Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill in your API keys
npm install
npm run dev                   # starts on :3001

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # starts on :5173 with Vite proxy
```

## Phase 1 Architecture

```
User Message
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                 FASTIFY SERVER (:3001)               │
│  POST /api/chat  ·  WS /ws/chat  ·  WS /ws/voice   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
           ┌─────────────────┐
           │   SUPERVISOR    │  ← core/supervisor.js
           │  (Router Brain) │
           └────────┬────────┘
                    │ classifyIntent()
          ┌─────────┼──────────┬──────────┐
          │         │          │          │
          ▼         ▼          ▼          ▼
      [VOICE]   [SUPPORT]   [NEWS]    [CHAT]
      agent      agent      agent     agent
          │
          └── wsToken → WS /ws/voice/:token
                            (audio streaming: Phase 2)

LLM Fallback Chain (per agent):
  Claude / Gemini  →(fail)→  OpenAI (GPT-4o-mini)
```

## File Structure

```
multi-agent-system/
├── backend/
│   ├── src/
│   │   ├── server.js               # Fastify entry, all routes
│   │   ├── config/index.js         # Env config, validated on boot
│   │   ├── core/
│   │   │   ├── supervisor.js       # Intent → Agent router
│   │   │   └── intent-classifier.js# Keyword + LLM classification
│   │   ├── agents/
│   │   │   ├── voice-agent.js      # Vapi/Twilio handler
│   │   │   └── index.js            # Support, News, Chat agents
│   │   ├── utils/
│   │   │   └── llm-caller.js       # Primary + OpenAI fallback
│   │   └── websocket/
│   │       └── ws-manager.js       # WS session registry
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── ChatWindow.jsx      # Main UI
    │   │   └── AgentBadge.jsx      # Intent/provider pill
    │   ├── hooks/
    │   │   └── useChat.js          # All chat state + WS lifecycle
    │   └── services/
    │       └── api.js              # fetch + WebSocket wrappers
    ├── index.html
    ├── vite.config.js              # Proxy /api → :3001, /ws → ws://:3001
    └── package.json
```

## Phase 2 Checklist

- [ ] Wire Vapi SDK in `voice-agent.js` (`initiateVoiceCall`)
- [ ] Wire Twilio fallback in `voice-agent.js`
- [ ] Handle Vapi webhook events in `/webhooks/vapi`
- [ ] Push binary audio frames via `ws-manager.pushAudioChunk()`
- [ ] Stream LLM tokens via `broadcastToChat()` + frontend token renderer
- [ ] Inject live NewsAPI data in `news-agent.js`
- [ ] Zendesk ticket creation in `support-agent.js`
- [ ] Replace in-memory WS sessions with Redis for multi-instance scale
