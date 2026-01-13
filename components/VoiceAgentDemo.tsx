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

const SpeakingIndicator = ({ label, isActive, icon: Icon }: { label: string; isActive: boolean; icon: ComponentType<{ className?: string }> }) => (
  <div
    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
      isActive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'
    }`}
  >
    <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
    <span>{label}</span>
    <span className={`ml-auto inline-flex h-2 w-2 rounded-full ${isActive ? 'animate-pulse bg-emerald-500' : 'bg-gray-300'}`} aria-hidden />
  </div>
);

const MessageBubble = ({ message }: { message: Message }) => {
  const content = message.role === 'user' && message.chunks?.length
    ? message.chunks.map((chunk) => <span key={chunk.counter}>{chunk.text}</span>)
    : message.text;

  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-gray-400 italic">{message.text}</span>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-emerald-500 px-4 py-2 text-white">
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl border border-gray-200 bg-white px-4 py-2 text-gray-800">
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
    try {
      await connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessages([{ role: 'system', text: `Failed to connect: ${errorMessage}` }]);
    }
  };

  const handleMicClick = () => {
    if (!isSessionActive) return;
    isMuted ? unmute() : mute();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}
      <section className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Call controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={isSessionActive ? disconnect : handleConnectClick}
            disabled={isConnecting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition disabled:opacity-50 ${
              isSessionActive
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
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
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {isMuted ? (
              <>
                <MicOff className="h-5 w-5 text-rose-500" />
                <span>Unmute</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 text-emerald-500" />
                <span>Mute</span>
              </>
            )}
          </button>
        </div>

        {/* Speaking indicators */}
        <div className="grid gap-3 sm:grid-cols-2">
          <SpeakingIndicator label="You" isActive={userSpeaking} icon={User} />
          <SpeakingIndicator label="Agent" isActive={agentSpeaking} icon={Activity} />
        </div>

        {/* Microphone selection */}
        <MicrophoneSelect
          agent={agent}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          containerClassName="space-y-1"
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
          <span>Conversation</span>
        </div>

        <div ref={listRef} className="flex h-80 w-full flex-col gap-3 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
          {messages.length === 0 ? (
            <div className="text-gray-400">No messages yet. Start a session to see the live transcript.</div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble key={`${message.turnId ?? message.role}-${index}`} message={message} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
