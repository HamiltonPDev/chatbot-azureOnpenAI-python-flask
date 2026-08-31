/**
 * MessageBubble — one turn of the conversation.
 *
 * @level Molecule
 * @composition Eyebrow
 */
import { Eyebrow } from "@/components/atoms";
import { colors, fontSizes, radius } from "@/quarks";
import type { ChatMessage } from "@/types/chat";

export interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const author = isUser ? "you" : message.error ? "error" : "assistant";

  return (
    <div
      className="ca-msg"
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
      }}
    >
      <div style={{ maxWidth: "78%" }}>
        <Eyebrow align={isUser ? "right" : "left"} style={{ marginBottom: 5 }}>
          {author}
        </Eyebrow>
        <div
          style={{
            background: isUser ? colors.ink : colors.panel,
            color: isUser ? colors.inkInverse : message.error ? colors.warn : colors.ink,
            border: isUser ? "none" : `1px solid ${colors.rule}`,
            borderLeft: isUser
              ? undefined
              : `2px solid ${message.error ? colors.warn : colors.signal}`,
            padding: "12px 14px",
            fontSize: fontSizes.body,
            lineHeight: 1.65,
            borderRadius: radius.sharp,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
