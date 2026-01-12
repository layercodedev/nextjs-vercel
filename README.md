# Layercode Voice AI Starter

Add voice AI to your Next.js app in minutes.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/layercodedev/nextjs-vercel)

<!-- TODO: Add screenshot or demo GIF here -->

## Features

- **Voice conversations** — Real-time speech-to-text and text-to-speech
- **Microphone selection** — Built-in device picker via `@layercode/react-sdk`
- **Speaking indicators** — Visual feedback when user or agent is speaking
- **Streaming transcripts** — Live display with partial updates
- **Message history** — Persisted via Vercel KV (in-memory fallback for dev)
- **Knowledge grounding** — AI responses based on your content
- **Serverless architecture** — Runs entirely on Vercel Edge/Functions

## Tech Stack

- [Next.js 15](https://nextjs.org) — App Router, React Server Components
- [Layercode](https://layercode.com) — Voice AI infrastructure
- [Vercel AI SDK](https://sdk.vercel.ai) — AI model integration
- [Vercel KV](https://vercel.com/storage/kv) — Redis-based session storage
- [OpenAI](https://openai.com) — GPT-4o-mini for responses

## Demo

Out of the box, this runs a **Layercode support agent**. Try asking:

- "What is Layercode?"
- "How do I get started?"
- "What platforms do you support?"

The agent's knowledge comes from `lib/knowledge.ts` — edit this file to make it your own.

## Getting Started

### Prerequisites

- Node.js 18+
- [Layercode account](https://layercode.com) — for API key and agent setup
- [OpenAI API key](https://platform.openai.com) — for text generation

### 1. Clone and install

```bash
git clone https://github.com/layercodedev/nextjs-vercel
cd nextjs-vercel
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your keys:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_LAYERCODE_AGENT_ID` | Yes | Agent ID from Layercode dashboard |
| `LAYERCODE_API_KEY` | Yes | API key from Layercode dashboard |
| `LAYERCODE_WEBHOOK_SECRET` | Yes | Webhook secret from Layercode dashboard |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `KV_REST_API_URL` | No | Vercel KV URL (optional, for persistence) |
| `KV_REST_API_TOKEN` | No | Vercel KV token (optional) |

### 3. Run locally with the Layercode CLI

The Layercode CLI creates a tunnel and auto-configures your webhook URL:

```bash
npx layercode login        # Authenticate (first time only)
npx layercode tunnel       # Starts dev server + tunnel
```

Or run without webhooks (limited functionality):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Connect** to start a voice session.

## Deploy to Vercel

1. Click the **Deploy** button above
2. Add environment variables in project settings
3. **Disable Vercel Authentication** for webhooks:
   - Settings → Deployment Protection → Turn off Vercel Authentication
4. Configure your Layercode agent's webhook URL to: `https://your-app.vercel.app/api/agent`

![disable-vercel-auth](./disable-vercel-auth.png)

## Architecture

```
Browser (microphone)
    ↓
@layercode/react-sdk
    ↓
Your Vercel App
    ├── /api/authorize   → Get session token (keeps API key server-side)
    ├── /api/agent       → Webhook endpoint for voice events
    ├── lib/ai.ts        → AI completion logic
    └── lib/knowledge.ts → Your content/knowledge base
```

### How voice events flow

1. User clicks **Connect** → Browser requests session token from `/api/authorize`
2. Browser connects to Layercode via WebSocket
3. User speaks → Layercode transcribes → POST to `/api/agent`
4. Your agent generates response → Layercode speaks it back

## Project Structure

```
app/
  page.tsx                — Voice UI
  api/
    authorize/route.ts    — Session authorization
    agent/route.ts        — Voice event webhook
lib/
  ai.ts                   — AI logic (extend for tools, streaming)
  knowledge.ts            — Your knowledge base (edit this!)
```

## Customizing

### Change the knowledge base

Edit `lib/knowledge.ts` to add your own FAQs, product info, and content:

```ts
export function getKnowledgeBase(): KnowledgeBase {
  return {
    companyName: "Your Company",
    faqs: [{ question: "...", answer: "..." }],
    // ...
  };
}
```

### Extend the AI logic

Edit `lib/ai.ts` to add streaming, tool calling, or switch models. See inline comments for extension points.

## Resources

- [Layercode Docs](https://docs.layercode.com)
- [Layercode CLI](https://docs.layercode.com/api-reference/cli)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Next.js Docs](https://nextjs.org/docs)

## License

MIT
