/**
 * Eyebrow — a small uppercase monospace label.
 *
 * @level Atom
 *
 * Used for anything the machine says about itself: message authorship,
 * panel titles, stage locations.
 */
import type { CSSProperties, ReactNode } from "react";

import { colors, fonts, fontSizes, tracking } from "@/quarks";

export interface EyebrowProps {
  children: ReactNode;
  align?: CSSProperties["textAlign"];
  style?: CSSProperties;
}

export function Eyebrow({ children, align = "left", style }: EyebrowProps) {
  return (
    <span
      style={{
        display: "block",
        fontFamily: fonts.mono,
        fontSize: fontSizes.micro,
        letterSpacing: tracking.wider,
        textTransform: "uppercase",
        color: colors.faint,
        textAlign: align,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
