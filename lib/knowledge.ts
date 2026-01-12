/**
 * Static Knowledge Base Module
 *
 * This module provides a static knowledge base used by the voice AI agent to
 * generate grounded, contextual responses. The content is hardcoded intentionally
 * to reduce complexity and make the integration pattern easy to understand.
 *
 * WHY STATIC KNOWLEDGE?
 * ---------------------
 * For a reference implementation, static content ensures:
 * - Zero external dependencies
 * - Instant setup (no database, no API keys beyond Layercode)
 * - Clear demonstration of where knowledge enters the AI system
 * - Easy modification for developers learning the pattern
 *
 * REPLACING THIS WITH YOUR OWN DATA
 * ----------------------------------
 * In a production application, you would replace getKnowledgeBase() with one of:
 *
 * 1. CMS FETCH
 *    - Fetch content from a headless CMS (Contentful, Sanity, Strapi, etc.)
 *    - Example: const content = await sanityClient.fetch('*[_type == "faq"]')
 *    - Benefits: Non-technical team members can update content
 *
 * 2. DATABASE QUERY
 *    - Query from Vercel Postgres, PlanetScale, Supabase, etc.
 *    - Example: const docs = await db.select().from(knowledge).where(...)
 *    - Benefits: Structured data, easy updates, transactional consistency
 *
 * 3. VECTOR SEARCH / RAG (Retrieval-Augmented Generation)
 *    - Use embeddings to find semantically relevant content
 *    - Services: Pinecone, Weaviate, Vercel's AI SDK with embeddings
 *    - Flow: embed user query -> search vector DB -> return top-k results
 *    - Benefits: Handles large knowledge bases, finds contextually relevant info
 *
 * 4. DOCUMENTATION SITE / STATIC FILES
 *    - Parse markdown files from /docs directory
 *    - Fetch from a documentation API (ReadMe, GitBook, etc.)
 *    - Example: const docs = await fetch('https://docs.example.com/api/search')
 *    - Benefits: Keep knowledge in sync with public documentation
 *
 * The function signature remains the same regardless of the data source.
 * This makes it easy to swap implementations without changing the AI logic.
 */

export interface KnowledgeBase {
  companyName: string;
  companyDescription: string;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  productInfo: string;
  supportInfo: string;
}

/**
 * Returns the static knowledge base content.
 *
 * This function is called by the AI logic to provide context for generating
 * responses. The content returned here directly influences what the voice
 * agent knows and can discuss.
 *
 * To customize for your use case:
 * 1. Replace the content below with your own FAQs, product info, etc.
 * 2. Or replace the entire function body with a fetch/query (see comments above)
 */
export function getKnowledgeBase(): KnowledgeBase {
  return {
    companyName: "Layercode",

    companyDescription: `Layercode is a voice AI platform that makes it easy to add conversational
voice interfaces to any application. We handle the complex infrastructure of real-time audio
processing, speech recognition, and voice synthesis so developers can focus on building
great experiences.`,

    faqs: [
      {
        question: "What is Layercode?",
        answer: `Layercode is a voice AI platform that enables developers to add voice interfaces
to their applications. It provides SDKs for web and mobile, handles real-time audio streaming,
and integrates with popular AI models for natural conversations.`,
      },
      {
        question: "How do I get started with Layercode?",
        answer: `Getting started is simple: 1) Sign up at layercode.com and get your API key,
2) Install the Layercode SDK in your project, 3) Add the voice component to your UI,
4) Configure your webhook endpoint to receive voice events. The entire setup takes about
15 minutes for a basic integration.`,
      },
      {
        question: "What platforms does Layercode support?",
        answer: `Layercode supports web applications (React, Next.js, Vue, vanilla JS),
React Native for mobile, and server-side integrations via REST APIs. We also support
telephony for phone-based voice applications.`,
      },
      {
        question: "How does billing work?",
        answer: `Layercode offers a free tier for development and testing. Production usage
is billed based on voice minutes processed. There are no per-seat licenses or minimum
commitments. You can view detailed usage in your dashboard.`,
      },
      {
        question: "Can I use my own AI model?",
        answer: `Yes! Layercode is model-agnostic. You can use OpenAI, Anthropic, Google,
or any other AI provider. You control the AI logic in your own backend, and Layercode
handles the voice layer. This gives you full flexibility over the conversation logic.`,
      },
      {
        question: "Is Layercode secure?",
        answer: `Security is a top priority. All audio is encrypted in transit, we don't
store conversation audio by default, and you can configure data retention policies.
We're SOC 2 compliant and offer enterprise security features for larger deployments.`,
      },
      {
        question: "What's the latency like?",
        answer: `Layercode is optimized for real-time conversations. Typical end-to-end
latency (from user speech to AI response audio) is under 500ms, depending on your AI
model's response time. We use edge infrastructure to minimize network latency.`,
      },
    ],

    productInfo: `Layercode provides:
- Web SDK: Drop-in voice components for any web application
- Real-time streaming: Sub-second latency for natural conversations
- Webhooks: Receive voice events in your serverless functions
- Transcription: Automatic speech-to-text with high accuracy
- Voice synthesis: Natural-sounding AI voices in multiple languages
- Session management: Track conversations across multiple turns
- Analytics: Monitor usage, latency, and conversation quality`,

    supportInfo: `For support:
- Documentation: docs.layercode.com
- Email: support@layercode.com
- Discord community: discord.gg/layercode
- Enterprise support: Available on Business and Enterprise plans
- Status page: status.layercode.com`,
  };
}

/**
 * Formats the knowledge base into a string suitable for AI system prompts.
 *
 * This helper converts the structured knowledge into a format that can be
 * injected into an AI prompt. Customize this format based on your AI model's
 * preferences and your specific use case.
 */
export function formatKnowledgeForPrompt(knowledge: KnowledgeBase): string {
  const faqSection = knowledge.faqs
    .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join("\n\n");

  return `
=== KNOWLEDGE BASE ===

COMPANY: ${knowledge.companyName}

ABOUT:
${knowledge.companyDescription}

FREQUENTLY ASKED QUESTIONS:
${faqSection}

PRODUCT INFORMATION:
${knowledge.productInfo}

SUPPORT:
${knowledge.supportInfo}

=== END KNOWLEDGE BASE ===
`.trim();
}
