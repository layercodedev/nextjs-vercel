// app/api/agent/route.ts
//
// Purpose
// -------
// Voice event webhook. Receives all voice session events from Layercode and
// generates AI responses that are streamed back as speech.
//
// Responsibilities
// ----------------
// • Verify webhook signatures for security.
// • Handle session lifecycle events (start, end, update).
// • Process transcribed user speech and generate AI responses.
// • Stream responses back to Layercode for text-to-speech.
// • Manage conversation history in Vercel KV (or in-memory fallback).
//
// Voice Event Lifecycle
// ---------------------
// 1. session.start  → Voice session begins, reset conversation state.
// 2. message        → User speech transcribed, generate AI response.
// 3. session.update → Session state changes (mute/unmute).
// 4. session.end    → Session terminated, cleanup opportunity.
//
// Extension Points
// ----------------
// • Persist transcripts: Save full conversation in session.end.
// • Trigger summarization: Call LLM to summarize after session.end.
// • Add analytics: Log latency, message count, session duration.
// • Add moderation: Filter user input before LLM, filter output before TTS.
//
export const dynamic = 'force-dynamic';

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, AssistantModelMessage } from 'ai';
import { streamResponse, verifySignature } from '@layercode/node-server-sdk';
import { kv } from '@vercel/kv';
import config from '@/layercode.config.json';
import { getKnowledgeBase, formatKnowledgeForPrompt } from '@/lib/knowledge';

type LayercodeMetadata = {
  conversation_id: string;
};

type LayercodePart = {
  content: string;
};

type LayercodeUIMessage = UIMessage<LayercodeMetadata, LayercodePart>;

type WebhookRequest = {
  conversation_id: string;
  text: string;
  turn_id: string;
  type: 'message' | 'session.start' | 'session.end' | 'session.update';
};

const knowledgeBase = formatKnowledgeForPrompt(getKnowledgeBase());
const SYSTEM_PROMPT = `${config.prompt}\n\n${knowledgeBase}`;
const WELCOME_MESSAGE = config.welcome_message;

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return createOpenAI({ apiKey });
};

const CONVERSATION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const isKvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const inMemoryConversations = new Map<string, LayercodeUIMessage[]>();
let kvWarningShown = false;

const conversationKey = (conversationId: string) => `layercode:conversation:${conversationId}`;

const warnAboutKvFallback = () => {
  if (isKvConfigured || kvWarningShown) return;
  kvWarningShown = true;
  console.warn('Vercel KV environment variables are missing; falling back to in-memory message storage.');
};

const getConversationMessages = async (conversationId: string): Promise<LayercodeUIMessage[]> => {
  if (!isKvConfigured) {
    warnAboutKvFallback();
    return inMemoryConversations.get(conversationId) ?? [];
  }
  const key = conversationKey(conversationId);
  const stored = await kv.lrange<string>(key, 0, -1);
  if (!stored?.length) return [];
  return stored.map((entry) => JSON.parse(entry) as LayercodeUIMessage);
};

const appendConversationMessages = async (conversationId: string, messages: LayercodeUIMessage[]) => {
  if (!messages.length) return;
  if (!isKvConfigured) {
    warnAboutKvFallback();
    const existing = inMemoryConversations.get(conversationId) ?? [];
    inMemoryConversations.set(conversationId, [...existing, ...messages]);
    return;
  }
  const key = conversationKey(conversationId);
  await kv.rpush(key, ...messages.map((message) => JSON.stringify(message)));
  await kv.expire(key, CONVERSATION_TTL_SECONDS);
};

const resetConversationMessages = async (conversationId: string) => {
  if (!isKvConfigured) {
    warnAboutKvFallback();
    inMemoryConversations.delete(conversationId);
    return;
  }
  await kv.del(conversationKey(conversationId));
};

export const POST = async (request: Request) => {
  const requestBody = (await request.json()) as WebhookRequest;
  console.log('Webhook received from Layercode', JSON.stringify({
    type: requestBody.type,
    conversation_id: requestBody.conversation_id,
    turn_id: requestBody.turn_id,
    timestamp: new Date().toISOString()
  }));

  // Verify webhook signature
  const signature = request.headers.get('layercode-signature') || '';
  const secret = process.env.LAYERCODE_WEBHOOK_SECRET || '';
  const isValid = verifySignature({
    payload: JSON.stringify(requestBody),
    signature,
    secret
  });
  if (!isValid) return new Response('Invalid layercode-signature', { status: 401 });

  const { conversation_id, text: userText, turn_id, type } = requestBody;

  // SESSION START: Reset conversation state for a fresh session
  // EXTENSION POINT: Initialize analytics tracking, log session start time
  if (type === 'session.start') {
    await resetConversationMessages(conversation_id);
  }

  const existingMessages = await getConversationMessages(conversation_id);

  const userMessage: LayercodeUIMessage = {
    id: turn_id,
    role: 'user',
    metadata: { conversation_id },
    parts: [{ type: 'text', text: userText }]
  };
  await appendConversationMessages(conversation_id, [userMessage]);

  switch (type) {
    // VOICE EVENT: session.start - User has connected to voice session
    // Delivers welcome message via TTS
    case 'session.start':
      const message: LayercodeUIMessage = {
        id: turn_id,
        role: 'assistant',
        metadata: { conversation_id },
        parts: [{ type: 'text', text: WELCOME_MESSAGE }]
      };

      return streamResponse(requestBody, async ({ stream }) => {
        await appendConversationMessages(conversation_id, [message]);
        stream.tts(WELCOME_MESSAGE);
        stream.end();
      });

    // VOICE EVENT: message - User speech has been transcribed
    // This is where the main conversation logic happens
    // EXTENSION POINT: Add content moderation on userText before LLM call
    case 'message':
      return streamResponse(requestBody, async ({ stream }) => {
        const conversationForModel = [...existingMessages, userMessage];
        // EXTENSION POINT: Log user message for analytics or moderation review

        const { textStream } = streamText({
          model: getOpenAIClient()('gpt-4.1-mini-2025-04-14'),
          system: SYSTEM_PROMPT,
          messages: convertToModelMessages(conversationForModel),
          onFinish: async ({ response }) => {
            const generatedMessages: LayercodeUIMessage[] = response.messages
              .filter((message): message is AssistantModelMessage => message.role === 'assistant')
              .map((message) => ({
                id: crypto.randomUUID(),
                role: 'assistant', // now the type matches your UI message union
                metadata: { conversation_id },
                parts: Array.isArray(message.content)
                  ? message.content.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map((part) => ({ type: 'text', text: part.text }))
                  : [{ type: 'text', text: message.content }]
              }));

            await appendConversationMessages(conversation_id, generatedMessages);
            // EXTENSION POINT: Filter/moderate assistant response before TTS
            // EXTENSION POINT: Log assistant response for analytics
            stream.end();
          }
        });

        await stream.ttsTextStream(textStream);
      });

    // VOICE EVENT: session.end - User has disconnected from voice session
    // EXTENSION POINT: Persist full transcript to database here
    // EXTENSION POINT: Trigger async summarization of the conversation
    // EXTENSION POINT: Log session duration, message count, and other metrics
    case 'session.end':
    // VOICE EVENT: session.update - Session state changed (e.g., mute/unmute)
    case 'session.update':
      return new Response('OK', { status: 200 });

    default:
      return new Response('Unknown event type', { status: 400 });
  }
};
