/**
 * EmptyState — what the conversation shows before the first question.
 *
 * @level Molecule
 */
import { colors, fontSizes, tracking } from "@/quarks";

export function EmptyState() {
  return (
    <div style={{ maxWidth: 380, marginTop: 40 }}>
      <p
        style={{
          margin: 0,
          fontSize: fontSizes.lead,
          lineHeight: 1.35,
          color: colors.ink,
          letterSpacing: tracking.tight,
        }}
      >
        Ask a question to start.
      </p>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.65, color: colors.muted }}>
        Each request is traced end to end — you&apos;ll see it validated, sent to the Python
        service, answered by the model, and rendered.
      </p>
    </div>
  );
}
