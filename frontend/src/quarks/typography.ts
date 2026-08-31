/**
 * Typography tokens.
 *
 * @level Quark
 *
 * Monospace is reserved for anything the machine reports — timings, stage
 * names, status. Sans carries human language.
 */
export const fonts = {
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  sans: "'Archivo', system-ui, sans-serif",
} as const;

export const fontSizes = {
  micro: 9.5,
  tiny: 10.5,
  small: 11.5,
  body: 14.5,
  lead: 20,
  display: 22,
} as const;

export const tracking = {
  tight: "-0.01em",
  wide: ".1em",
  wider: ".14em",
  widest: ".18em",
} as const;
