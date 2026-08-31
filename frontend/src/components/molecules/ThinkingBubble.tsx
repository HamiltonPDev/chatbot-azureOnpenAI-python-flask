/**
 * ThinkingBubble — the pending-response placeholder.
 *
 * @level Molecule
 * @composition Eyebrow
 *
 * The PDF's bonus "loading message". Separate from MessageBubble because it
 * represents an absence of a message, not a message.
 */
import { Eyebrow } from "@/components/atoms";
import { colors, fonts, radius } from "@/quarks";

export function ThinkingBubble() {
  return (
    <div className="ca-msg" style={{ display: "flex", marginBottom: 16 }}>
      <div>
        <Eyebrow style={{ marginBottom: 5 }}>assistant</Eyebrow>
        <div
          className="ca-live"
          aria-live="polite"
          style={{
            background: colors.panel,
            border: `1px solid ${colors.rule}`,
            borderLeft: `2px solid ${colors.signal}`,
            padding: "12px 14px",
            fontFamily: fonts.mono,
            fontSize: 13,
            color: colors.muted,
            borderRadius: radius.sharp,
          }}
        >
          Thinking…
        </div>
      </div>
    </div>
  );
}
