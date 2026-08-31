/**
 * TextInput — a single-line field.
 *
 * @level Atom
 *
 * Controlled by whoever renders it; it holds no state of its own.
 */
import type { InputHTMLAttributes, Ref } from "react";

import { colors, fonts, fontSizes, radius } from "@/quarks";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({ ref, ...rest }: TextInputProps) {
  return (
    <input
      ref={ref}
      className="ca-input"
      style={{
        flex: 1,
        border: `1px solid ${colors.rule}`,
        background: colors.paper,
        padding: "11px 13px",
        fontFamily: fonts.sans,
        fontSize: fontSizes.body,
        color: colors.ink,
        borderRadius: radius.sharp,
      }}
      {...rest}
    />
  );
}
