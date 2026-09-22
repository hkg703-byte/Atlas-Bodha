"use client";

import { MemoryOffer } from "@/components/memory/MemoryOffer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationComposer } from
  "@/components/conversation/ConversationComposer";

type DisplayMessage = {
  id: string;
  sequenceNumber: string;
  role: "person" | "assistant";
  content: string;
  safetyTier: number | null;
};

type ConversationExperienceProps = {
  conversationId: string;
  messages: DisplayMessage[];
};

type StreamEvent =
  | { type: "start" }
  | { type: "delta"; text: string }
  | { type: "safety"; tier: number; resources: string | null }
  | { type: "complete" }
  | { type: "error"; message: string };

const DEFAULT_RESOURCES =
  "If you'd like to talk to someone right now: call or text 988 (Suicide & Crisis Lifeline), or text HOME to 741741 (Crisis Text Line). In an emergency call 911.";

function ResourceCard({ prominent = false, text }: {
  prominent?: boolean;
  text: string;
}) {
  return (
    <aside
      role="status"
      className={`rounded-xl border p-4 text-sm ${prominent ? "mb-5 shadow-sm" : "mt-5"}`}
      style={{
        borderColor: prominent
          ? "var(--atlas-color-accent)"
          : "var(--atlas-color-border)",
        background: "white",
        color: "var(--atlas-color-text-primary)",
      }}
    >
      {prominent ? <p className="mb-2 font-semibold">Support is available now</p> : null}
      {text}
    </aside>
  );
}

export function ConversationExperience({
  conversationId,
  messages,
}: ConversationExperienceProps) {
  const router = useRouter();
  const [streamedText, setStreamedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [streamSafety, setStreamSafety] = useState<{
    tier: number;
    resources: string | null;
  } | null>(null);
  const [awaitingCanonical, setAwaitingCanonical] = useState(false);
  const generationStartedRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateAssistantResponse = useCallback(async () => {
    if (generationStartedRef.current) return;

    generationStartedRef.current = true;
    setIsGenerating(true);
    setStreamedText("");
    setStreamSafety(null);
    setGenerationError(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(
        `/api/v1/conversations/${conversationId}/generate`,
        { method: "POST", signal: abortController.signal },
      );
      if (!response.ok || !response.body) {
        throw new Error("Atlas could not begin the response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawComplete = false;

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "delta") {
            setStreamedText((current) => current + event.text);
          } else if (event.type === "safety") {
            setStreamSafety({ tier: event.tier, resources: event.resources });
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "complete") {
            sawComplete = true;
            setAwaitingCanonical(true);
            router.refresh();
          }
        }
        if (done) break;
      }
      if (!sawComplete) {
        throw new Error("Atlas could not complete the response.");
      }
    } catch (error) {
      setStreamedText("");
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Atlas could not complete the response.",
      );
      generationStartedRef.current = false;
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  }, [conversationId, router]);

  const lastMessage = messages.at(-1);

  useEffect(() => {
    if (lastMessage?.role === "person" && !generationStartedRef.current) {
      void generateAssistantResponse();
    }
  }, [generateAssistantResponse, lastMessage?.id, lastMessage?.role]);

  useEffect(() => {
    if (awaitingCanonical && lastMessage?.role === "assistant") {
      generationStartedRef.current = false;
      const timeout = window.setTimeout(() => {
        setAwaitingCanonical(false);
        setStreamedText("");
        setStreamSafety(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [awaitingCanonical, lastMessage?.id, lastMessage?.role]);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages, streamedText, streamSafety]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto">
        <section
          aria-label="Conversation"
          aria-live="polite"
          className="space-y-8 py-8"
        >
          {messages.map((message, index) => (
            <article
              key={message.id}
              className={message.role === "person"
                ? "ml-auto max-w-[85%]"
                : "mr-auto max-w-[85%]"}
            >
              {message.role === "assistant" && message.safetyTier === 3 ? (
                <ResourceCard prominent text={DEFAULT_RESOURCES} />
              ) : null}
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {message.content}
              </p>
              {message.role === "assistant" && message.safetyTier === 2 ? (
                <ResourceCard text={DEFAULT_RESOURCES} />
              ) : null}
              {message.role === "assistant" && message.id === lastMessage?.id && message.safetyTier !== null && message.safetyTier < 2 && messages[index-1]?.role === "person" ? <MemoryOffer key={messages[index-1].id} sourceMessageId={messages[index-1].id} /> : null}
            </article>
          ))}

          {streamSafety?.tier === 3 && !(
            awaitingCanonical && lastMessage?.role === "assistant"
          ) ? (
            <ResourceCard
              prominent
              text={streamSafety.resources ?? DEFAULT_RESOURCES}
            />
          ) : null}
          {streamedText && !(
            awaitingCanonical && lastMessage?.role === "assistant"
          ) ? (
            <article className="mr-auto max-w-[85%]" aria-label="Atlas response">
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {streamedText}
              </p>
              {streamSafety?.tier === 2 ? (
                <ResourceCard text={streamSafety.resources ?? DEFAULT_RESOURCES} />
              ) : null}
            </article>
          ) : null}
          {isGenerating && !streamedText ? (
            <p className="text-sm" style={{ color: "var(--atlas-color-text-secondary)" }}>
              Responding…
            </p>
          ) : null}
          {generationError ? (
            <div role="alert" className="space-y-3 text-sm">
              {streamSafety?.tier === 2 ? (
                <ResourceCard text={streamSafety.resources ?? DEFAULT_RESOURCES} />
              ) : null}
              <p style={{ color: "var(--atlas-color-text-secondary)" }}>
                {generationError}
              </p>
              <button
                type="button"
                onClick={() => void generateAssistantResponse()}
                className="rounded-lg border px-4 py-2"
                style={{ borderColor: "var(--atlas-color-border)" }}
              >
                Try again
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <div className="shrink-0 bg-[var(--atlas-color-background)] pb-2 pt-4">
        <ConversationComposer
          conversationId={conversationId}
          disabled={isGenerating || awaitingCanonical}
          onMessageSaved={generateAssistantResponse}
        />
        <p
          className="mt-2 whitespace-nowrap text-center text-xs"
          style={{ color: "var(--atlas-color-text-secondary)" }}
        >
          Atlas is an AI, not a person or a therapist.
        </p>
      </div>
    </div>
  );
}
