/**
 * Spacing, radius and layout tokens.
 *
 * @level Quark
 */
export const space = {
  xs: 2,
  sm: 5,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

export const radius = {
  sharp: 2,
  round: "50%",
} as const;

export const layout = {
  tracePanelWidth: 260,
  conversationMinHeight: 520,
  scrollMaxHeight: 460,
  mobileBreakpoint: 760,
} as const;
