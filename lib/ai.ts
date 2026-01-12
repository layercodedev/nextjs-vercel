/**
 * Centralized AI module
 *
 * This module provides a clean boundary between voice/application logic and AI interactions.
 * All AI-related calls should flow through this module to ensure consistent configuration,
 * error handling, and future extensibility.
 */

import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { generateText, CoreMessage } from 'ai';

// --- Configuration ---

const DEFAULT_MODEL = 'gpt-4o-mini';

let openaiInstance: OpenAIProvider | null = null;

/**
 * Get or create the OpenAI provider instance.
 * Lazily initialized to avoid issues during module loading.
 */
function getOpenAI(): OpenAIProvider {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    // WHERE AI Gateway routing could be added:
    // The createOpenAI configuration could accept a custom baseURL parameter
    // to route requests through an AI Gateway (e.g., for rate limiting,
    // caching, analytics, or provider abstraction).
    openaiInstance = createOpenAI({ apiKey });
  }
  return openaiInstance;
}

// --- Types ---

/**
 * Input for AI completion requests.
 * This is the "voice -> AI" boundary - voice transcriptions come in here.
 */
export type AIRequest = {
  /** The user's message (typically from voice transcription) */
  userMessage: string;
  /** System prompt defining AI behavior */
  systemPrompt: string;
  /** Optional conversation history for context */
  conversationHistory?: CoreMessage[];
  /** Optional model override (defaults to gpt-4o-mini) */
  model?: string;
};

/**
 * Output from AI completion requests.
 * This is the "AI -> voice" boundary - AI responses go out from here.
 */
export type AIResponse = {
  /** The generated text response */
  text: string;
  /** Token usage information if available */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

// --- Core AI Function ---

/**
 * Generate a completion from the AI model.
 *
 * This is the primary entry point for AI interactions. It provides a simple
 * request/response interface that abstracts away the underlying AI SDK details.
 *
 * @param request - The AI request containing the user message and configuration
 * @returns The AI response with generated text
 *
 * @example
 * ```ts
 * const response = await generateCompletion({
 *   userMessage: "Hello, how are you?",
 *   systemPrompt: "You are a helpful assistant.",
 * });
 * console.log(response.text);
 * ```
 */
export async function generateCompletion(request: AIRequest): Promise<AIResponse> {
  const { userMessage, systemPrompt, conversationHistory = [], model = DEFAULT_MODEL } = request;

  const openai = getOpenAI();

  // Build messages array with conversation history
  const messages: CoreMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // WHERE the Vercel AI SDK could be used:
  // The generateText function below is already from the Vercel AI SDK ('ai' package).
  // Additional Vercel AI SDK features like useChat, useCompletion hooks, or
  // AI RSC (React Server Components) integration would be added here for
  // client-side streaming or server component rendering.

  // WHERE tool calling could be added:
  // The generateText call below could include a `tools` parameter with
  // tool definitions, and `toolChoice` to control tool selection behavior.
  // Tool results would be processed and potentially trigger follow-up calls.

  const result = await generateText({
    model: openai(model),
    system: systemPrompt,
    messages,
  });

  return {
    text: result.text,
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
        }
      : undefined,
  };
}

// --- Streaming Extension Point ---

// WHERE streaming responses could be added:
// A `generateCompletionStream` function would be defined here that returns
// an AsyncIterable<string> or ReadableStream for incremental text delivery.
// This would use streamText from the AI SDK instead of generateText,
// enabling real-time text-to-speech synthesis as tokens arrive.

// --- Exports ---

export { DEFAULT_MODEL };
