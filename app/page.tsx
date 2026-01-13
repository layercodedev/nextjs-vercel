// app/page.tsx
//
// Purpose
// -------
// Entry point for the voice agent demo page.
// Dynamically imports VoiceAgentDemo to avoid SSR issues with browser-only APIs.
//

'use client';

import dynamic from 'next/dynamic';

const VoiceAgentDemo = dynamic(() => import('@/components/VoiceAgentDemo'), { ssr: false });

export default function Page() {
  return <VoiceAgentDemo />;
}
