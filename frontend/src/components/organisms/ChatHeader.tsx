/**
 * ChatHeader — title, provenance, request counter and the clear control.
 *
 * @level Organism
 * @composition Badge, Button
 */
import { Badge, Button, ThemeToggle } from "@/components/atoms";
import { colors, fonts, fontSizes, tracking } from "@/quarks";

export interface ChatHeaderProps {
  runs: number;
  /** What Azure reports actually ran, once it has answered. */
  model: string | null;
  /** The deployment label configured on the server. */
  deployment: string | null;
  canClear: boolean;
  onClear: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function ChatHeader({
  runs,
  model,
  deployment,
  canClear,
  onClear,
  theme,
  onToggleTheme,
}: ChatHeaderProps) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${colors.rule}`,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: tracking.tight,
            color: colors.ink,
          }}
        >
          Assistant
        </h1>
        <p
          style={{
            margin: "2px 0 0",
            fontFamily: fonts.mono,
            fontSize: fontSizes.tiny,
            color: colors.faint,
          }}
          /* The deployment is LABELLED gpt-3; Azure reports what really ran.
             Showing the reported model keeps the UI honest about itself. */
          title={
            deployment
              ? `deployment "${deployment}" reports model ${model}`
              : undefined
          }
        >
          react · flask · {model ?? "azure openai"}
          {deployment && model && !model.startsWith(deployment) && (
            <span style={{ color: colors.rule }}> · deployed as {deployment}</span>
          )}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge pulseKey={runs}>
          {runs} {runs === 1 ? "request" : "requests"}
        </Badge>
        <Button variant="ghost" onClick={onClear} disabled={!canClear}>
          Clear
        </Button>
        <ThemeToggle resolved={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
