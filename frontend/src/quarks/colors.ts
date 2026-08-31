/**
 * Colour tokens.
 *
 * @level Quark
 *
 * Each token resolves to a CSS custom property defined in index.css, so a
 * theme change swaps the value underneath every atom without any component
 * knowing a theme exists. Quarks import nothing — they are the bottom of
 * the hierarchy.
 */
export const colors = {
  paper: "var(--ca-paper)",
  panel: "var(--ca-panel)",
  ink: "var(--ca-ink)",
  inkInverse: "var(--ca-ink-inverse)",
  muted: "var(--ca-muted)",
  faint: "var(--ca-faint)",
  rule: "var(--ca-rule)",
  signal: "var(--ca-signal)",
  signalHover: "var(--ca-signal-hover)",
  done: "var(--ca-done)",
  warn: "var(--ca-warn)",
} as const;
