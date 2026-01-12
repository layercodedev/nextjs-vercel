# Layercode — Add Voice AI to Your Next.js App

A Vercel-native reference implementation for integrating voice AI into any Next.js application using Layercode.

## What You'll Learn

This repository teaches five core patterns:

1. **Voice session startup** — How the browser initiates a voice connection via `/api/authorize`
2. **Serverless event handling** — How voice events flow through `/api/agent` on Vercel
3. **AI logic boundaries** — Where AI calls happen and how to extend them (`lib/ai.ts`)
4. **Knowledge grounding** — How static content grounds AI responses (`lib/knowledge.ts`)
5. **Extension points** — Where to add persistence, analytics, moderation, and more

This is a **learning reference**, not a production template. Understand the patterns, then adapt them to your needs.

## Architecture

```
Browser (microphone)
    ↓
Layercode Web SDK
    ↓
Next.js API Routes (Vercel)
    ├── /api/authorize   → Start voice session
    ├── /api/agent       → Receive voice events
    └── lib/ai.ts        → Generate AI responses
```

Voice input is captured in the browser, processed by Layercode, and routed to your serverless API routes. The agent route handles transcribed speech and generates responses using the AI module.

## Quick Start

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/layercodedev/nextjs-vercel)

### 2. Configure Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LAYERCODE_API_KEY` | Yes | Your Layercode API key |
| `NEXT_PUBLIC_LAYERCODE_AGENT_ID` | Yes | Agent ID (safe to expose) |
| `LAYERCODE_WEBHOOK_SECRET` | Yes | Webhook verification secret |
| `OPENAI_API_KEY` | Yes | For AI text generation |

Optional variables for persistence:

| Variable | Description |
|----------|-------------|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel KV for message history |

### 3. Disable Deployment Protection

Layercode webhooks need to reach `/api/agent`:

1. Go to Vercel → Settings → Deployment Protection
2. Turn off **Vercel Authentication**
3. Save

### 4. Start Voice Chat

Open your deployed app and click **Connect** to start a voice session.

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in your API keys
npm run dev
```

Open http://localhost:3000. Message history falls back to in-memory storage when KV is not configured.

## Why Static Knowledge?

This repository uses a static knowledge base (`lib/knowledge.ts`) instead of RAG or database queries. This is intentional:

- **Zero external dependencies** — No vector DB or ingestion pipeline to configure
- **Instant understanding** — Read one file to see exactly what the AI knows
- **Clear extension point** — Comments explain where to plug in your own data source

See the comments in `lib/knowledge.ts` for guidance on adding CMS, database, or vector search integration.

## Project Structure

```
app/
  api/
    authorize/route.ts  — Session authorization endpoint
    agent/route.ts      — Voice event handler
  page.tsx              — Voice UI
lib/
  ai.ts                 — AI logic boundary
  knowledge.ts          — Static knowledge base
```

## Next Steps

Once you understand the patterns here, consider:

- **Telephony** — Add phone number support via Layercode's telephony features
- **RAG** — Replace static knowledge with vector search (Pinecone, Weaviate)
- **Vercel AI SDK** — Use `useChat` hooks and streaming for richer UX
- **Production hardening** — Add rate limiting, error tracking, and monitoring

## Resources

- [Layercode Documentation](https://docs.layercode.com)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Next.js Documentation](https://nextjs.org/docs)
