// components/VoiceAgentDemo.tsx
//
// Purpose
// -------
// Main voice UI component. Provides the user interface for connecting to
// a Layercode voice agent, controlling the microphone, and viewing transcripts.
//
// Responsibilities
// ----------------
// • Render connect/disconnect and mute/unmute controls.
// • Display speaking indicators for user and agent.
// • Show real-time streaming transcripts with partial updates.
// • Handle microphone device selection via MicrophoneSelect component.
// • Manage voice session state and error display.
//
// Notes
// -----
// • Uses 'use client' directive for browser-only features (microphone, WebSocket).
// • Transcript chunks are aggregated by turn_id for proper ordering.
//

'use client';

import { Activity, Mic, MicOff, PhoneCall, PhoneOff, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useLayercodeAgent, MicrophoneSelect } from '@layercode/react-sdk';

type Role = 'user' | 'assistant' | 'system';

type TranscriptChunk = {
  counter: number;
  text: string;
};

type TurnChunkMap = Map<string, Map<number, string>>;

type Message = {
  role: Role;
  text: string;
  turnId?: string;
  chunks?: TranscriptChunk[];
};

type AgentEvent = {
  type?: string;
  turn_id?: string | number;
  delta_counter?: number | string;
  content?: string;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{children}</span>
);

const SpeakingIndicator = ({ label, isActive, icon: Icon }: { label: string; isActive: boolean; icon: ComponentType<{ className?: string }> }) => (
  <div
    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
      isActive
        ? 'border-[#34c759] bg-[#34c759]/10 text-[#1d1d1f]'
        : 'border-[#d1d1d6] bg-white text-[#1d1d1f]'
    }`}
  >
    <Icon className={`h-4 w-4 ${isActive ? 'text-[#34c759]' : 'text-[#86868b]'}`} />
    <span>{label}</span>
    <span className={`ml-auto inline-flex h-2.5 w-2.5 rounded-full ${isActive ? 'animate-pulse bg-[#34c759]' : 'bg-[#d1d1d6]'}`} aria-hidden />
  </div>
);

const MessageBubble = ({ message }: { message: Message }) => {
  const content = message.role === 'user' && message.chunks?.length
    ? message.chunks.map((chunk) => <span key={chunk.counter}>{chunk.text}</span>)
    : message.text;

  if (message.role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-400">{message.text}</span>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl bg-[#e5e5ea] px-4 py-2.5 text-[#1d1d1f]">
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-[#007aff] px-4 py-2.5 text-white">
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
    </div>
  );
};

export default function VoiceAgentDemo() {
  const agentId = process.env.NEXT_PUBLIC_LAYERCODE_AGENT_ID ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userChunksByTurn = useRef<TurnChunkMap>(new Map());
  const listRef = useRef<HTMLDivElement | null>(null);

  const appendSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'system', text }]);
  }, []);

  const upsertMessage = useCallback((next: Message, opts: { replace?: boolean } = {}) => {
    setMessages((prev) => {
      if (!next.turnId) return [...prev, next];

      const index = prev.findIndex((msg) => msg.turnId === next.turnId && msg.role === next.role);
      if (index === -1) return [...prev, next];

      const copy = prev.slice();
      const current = copy[index];
      copy[index] = {
        ...current,
        text: opts.replace ? next.text : current.text + next.text,
        chunks: next.chunks ?? current.chunks
      };
      return copy;
    });
  }, []);

  const clearTurn = useCallback((turnId: string) => {
    userChunksByTurn.current.delete(turnId);
  }, []);

  const updateUserTranscript = useCallback(
    (event: AgentEvent) => {
      const turnId = event.turn_id != null ? String(event.turn_id) : undefined;
      const rawCounter = event.delta_counter;
      const content = typeof event.content === 'string' ? event.content : '';

      const counter = typeof rawCounter === 'number' ? rawCounter : rawCounter != null ? Number(rawCounter) : undefined;

      if (!turnId || counter === undefined) {
        if (turnId) clearTurn(turnId);
        upsertMessage(
          {
            role: 'user',
            turnId,
            text: content,
            chunks: []
          },
          { replace: true }
        );
        return;
      }

      const turnMap = userChunksByTurn.current.get(turnId) ?? new Map<number, string>();
      turnMap.set(counter, content);
      userChunksByTurn.current.set(turnId, turnMap);

      const chunks: TranscriptChunk[] = [...turnMap.entries()].sort(([a], [b]) => a - b).map(([c, text]) => ({ counter: c, text }));
      const aggregatedText = chunks.map((chunk) => chunk.text).join('');

      upsertMessage(
        {
          role: 'user',
          turnId,
          text: aggregatedText,
          chunks
        },
        { replace: true }
      );
    },
    [clearTurn, upsertMessage]
  );

  const appendAssistantMessage = useCallback(
    (event: AgentEvent) => {
      const text = typeof event.content === 'string' ? event.content : '';
      upsertMessage({
        role: 'assistant',
        turnId: event.turn_id != null ? String(event.turn_id) : undefined,
        text
      });
    },
    [upsertMessage]
  );

  const handleAgentMessage = useCallback(
    (evt: AgentEvent) => {
      const type = evt.type;
      if (!type) return;

      if (type === 'turn.end' && evt.turn_id != null) {
        clearTurn(String(evt.turn_id));
        return;
      }

      if (type === 'user.transcript.delta' || type === 'user.transcript.interim_delta') {
        updateUserTranscript(evt);
        return;
      }

      if (type === 'response.text') {
        appendAssistantMessage(evt);
      }
    },
    [appendAssistantMessage, clearTurn, updateUserTranscript]
  );

  const agent = useLayercodeAgent({
    agentId,
    authorizeSessionEndpoint: '/api/authorize',
    enableAmplitudeMonitoring: false,
    onConnect: () => {
      setIsSessionActive(true);
      appendSystemMessage('Connected');
    },
    onDisconnect: () => {
      setIsSessionActive(false);
      userChunksByTurn.current.clear();
      appendSystemMessage('Disconnected');
    },
    onError: (err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('insufficient_balance') || errorMessage.includes('402')) {
        setError('Your organization has insufficient funds. Please add funds to your Layercode account to continue.');
      } else {
        setMessages((prev) => [...prev, { role: 'system', text: `Error: ${errorMessage}` }]);
      }
    },
    onMessage: handleAgentMessage
  });

  const { status, connect, disconnect, mute, unmute, isMuted, agentSpeaking, userSpeaking } = agent;

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('[Layercode Debug] State changed - status:', status, 'isMuted:', isMuted, 'isSessionActive:', isSessionActive);
  }, [status, isMuted, isSessionActive]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  const isConnecting = status === 'connecting';
  const canConnect = !isSessionActive && !isConnecting;
  const connectLabel = isConnecting ? 'Connecting…' : 'Connect';

  const handleConnectClick = async () => {
    if (!canConnect) return;
    userChunksByTurn.current.clear();
    setMessages([]);
    setError(null);
    console.log('[Layercode Debug] connect() called, current status:', status);
    try {
      await connect();
      console.log('[Layercode Debug] connect() completed, new status:', status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Layercode Debug] connect() error:', errorMessage);
      setMessages([{ role: 'system', text: `Failed to connect: ${errorMessage}` }]);
    }
  };

  const handleDisconnect = async () => {
    console.log('[Layercode Debug] disconnect() called, current status:', status, 'isMuted:', isMuted);
    try {
      await disconnect();
      console.log('[Layercode Debug] disconnect() completed, status after:', status);
    } catch (error) {
      console.error('[Layercode Debug] disconnect() error:', error);
    }
  };

  const handleMicClick = () => {
    if (!isSessionActive) {
      console.log('[Layercode Debug] mute/unmute ignored - not connected');
      return;
    }
    if (isMuted) {
      console.log('[Layercode Debug] unmute() called, isMuted before:', isMuted);
      unmute();
      console.log('[Layercode Debug] unmute() completed, isMuted after:', isMuted);
    } else {
      console.log('[Layercode Debug] mute() called, isMuted before:', isMuted);
      mute();
      console.log('[Layercode Debug] mute() completed, isMuted after:', isMuted);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-sm text-[#ff3b30]">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-4 text-[#ff3b30] hover:opacity-70"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Controls Card */}
      <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        {/* Call controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={isSessionActive ? handleDisconnect : handleConnectClick}
            disabled={isConnecting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold transition-all disabled:opacity-50 ${
              isSessionActive
                ? 'bg-[#ff3b30] text-white hover:bg-[#ff3b30]/90'
                : 'bg-[#34c759] text-white hover:bg-[#34c759]/90'
            }`}
          >
            {isSessionActive ? (
              <>
                <PhoneOff className="h-5 w-5" />
                <span>End Call</span>
              </>
            ) : (
              <>
                <PhoneCall className="h-5 w-5" />
                <span>{connectLabel}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleMicClick}
            disabled={!isSessionActive}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f5f5f7] px-5 py-3.5 text-[15px] font-semibold text-[#1d1d1f] transition-all hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            {isMuted ? (
              <>
                <MicOff className="h-5 w-5 text-[#ff3b30]" />
                <span>Unmute</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 text-[#34c759]" />
                <span>Mute</span>
              </>
            )}
          </button>
        </div>

        {/* Microphone selection */}
        <div className="mic-select-wrapper space-y-2">
          <MicrophoneSelect
            agent={agent}
            className="w-full rounded-xl bg-[#f5f5f7] px-4 py-3 text-[15px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            containerClassName=""
          />
        </div>
      </section>

      {/* Conversation Card */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4">
          <SectionLabel>Conversation</SectionLabel>
        </div>

        {/* Speaking indicators */}
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <SpeakingIndicator label="You" isActive={userSpeaking} icon={User} />
          <SpeakingIndicator label="Agent" isActive={agentSpeaking} icon={Activity} />
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex h-[500px] w-full flex-col gap-2.5 overflow-y-auto rounded-xl border border-[#d1d1d6] bg-white p-4 text-[15px]">
          {messages.length === 0 && !isConnecting ? (
            <div className="text-gray-400">No messages yet. Start a call to begin.</div>
          ) : messages.length === 0 && isConnecting ? (
            <div className="flex justify-center py-1">
              <span className="text-xs text-gray-400 animate-pulse">Connecting...</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble key={`${message.turnId ?? message.role}-${index}`} message={message} />
            ))
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex justify-center gap-4 py-4 text-xs text-[#86868b]">
        <a href="https://docs.layercode.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition-colors">
          Docs
        </a>
        <span>·</span>
        <a href="https://layercode.com/dashboard" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition-colors">
          Dashboard
        </a>
        <span>·</span>
        <a href="https://github.com/layercodedev" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition-colors">
          GitHub
        </a>
      </footer>
    </div>
  );
}
