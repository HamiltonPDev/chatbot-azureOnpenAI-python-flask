/**
 * Badge — a bordered monospace chip for a small piece of status.
 *
 * @level Atom
 *
 * `pulseKey` bumps the chip whenever the value it reports changes, so an
 * incrementing counter is felt rather than merely re-rendered.
 */
import { useEffect, useRef, useState } from "react";

import { colors, fonts, fontSizes } from "@/quarks";

export interface BadgeProps {
  children: React.ReactNode;
  /** Change this to replay the bump animation. */
  pulseKey?: string | number;
}

export function Badge({ children, pulseKey }: BadgeProps) {
  const [bumping, setBumping] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setBumping(true);
    const timer = setTimeout(() => setBumping(false), 220);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  return (
    <span
      className={bumping ? "ca-bump" : undefined}
      style={{
        display: "inline-block",
        fontFamily: fonts.mono,
        fontSize: fontSizes.tiny,
        color: colors.muted,
        border: `1px solid ${colors.rule}`,
        padding: "4px 8px",
        background: colors.panel,
      }}
    >
      {children}
    </span>
  );
}
