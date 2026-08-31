/**
 * Button — the only clickable primitive.
 *
 * @level Atom
 *
 * Send and Clear are variants of one atom, not two components. Splitting
 * them would add a file and no behaviour.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { colors, fonts, fontSizes, radius, tracking } from "@/quarks";

type Variant = "primary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <button
      className={`ca-btn ${isPrimary ? "ca-send" : "ca-ghost"}`}
      disabled={disabled}
      style={{
        fontFamily: fonts.mono,
        fontSize: isPrimary ? fontSizes.small : fontSizes.tiny,
        letterSpacing: isPrimary ? tracking.wide : ".08em",
        textTransform: "uppercase",
        borderRadius: radius.sharp,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .15s, color .15s, border-color .15s",
        ...(isPrimary
          ? {
              background: disabled ? colors.faint : colors.signal,
              color: "#fff",
              border: "none",
              padding: "0 22px",
            }
          : {
              background: "transparent",
              color: disabled ? colors.faint : colors.muted,
              border: `1px solid ${colors.rule}`,
              padding: "5px 12px",
            }),
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
