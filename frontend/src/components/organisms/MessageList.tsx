/**
 * MessageList — the scrolling transcript.
 *
 * @level Organism
 * @composition EmptyState, MessageBubble, ThinkingBubble
 *
 * Owns one piece of local state only: keeping the view pinned to the newest
 * message. That is presentation, not business logic, so it belongs here.
 */
import { useEffect, useRef } from "react";

import { EmptyState, MessageBubble, ThinkingBubble } from "@/components/molecules";
import { layout } from "@/quarks";
import type { ChatMessage } from "@/types/chat";

export interface MessageListProps {
  messages: ChatMessage[];
  isThinking: boolean;
}

export function MessageList({ messages, isThinking }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isThinking]);

  return (
    <div
      ref={scrollRef}
      className="ca-scroll"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 20px",
        maxHeight: layout.scrollMaxHeight,
      }}
    >
      {messages.length === 0 && !isThinking && <EmptyState />}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isThinking && <ThinkingBubble />}
    </div>
  );
}
