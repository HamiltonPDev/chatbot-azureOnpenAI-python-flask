/**
 * ThemeToggle — switches between light and dark.
 *
 * @level Atom
 *
 * The icon rotates on hover (arc) and swaps on change (secondary action:
 * the glyph responds to the state its parent control owns).
 */
import { colors, fonts, fontSizes } from "@/quarks";

export interface ThemeToggleProps {
  resolved: "light" | "dark";
  onToggle: () => void;
}

export function ThemeToggle({ resolved, onToggle }: ThemeToggleProps) {
  const goingDark = resolved === "light";

  return (
    <button
      className="ca-btn ca-ghost"
      onClick={onToggle}
      aria-label={goingDark ? "Switch to dark theme" : "Switch to light theme"}
      title={goingDark ? "Dark theme" : "Light theme"}
      style={{
        fontFamily: fonts.mono,
        fontSize: fontSizes.tiny,
        color: colors.muted,
        background: "transparent",
        border: `1px solid ${colors.rule}`,
        padding: "5px 10px",
        cursor: "pointer",
        lineHeight: 1.6,
      }}
    >
      <span className="ca-theme-icon" aria-hidden="true">
        {goingDark ? "◐" : "◑"}
      </span>
    </button>
  );
}
