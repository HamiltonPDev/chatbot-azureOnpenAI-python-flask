/**
 * Notice — an inline validation message.
 *
 * @level Atom
 *
 * Shakes once on appearance: 4px, enough to notice and not enough to
 * distract. role="alert" so screen readers announce it.
 */
import { colors, fonts, fontSizes } from "@/quarks";

export interface NoticeProps {
  children: string;
}

export function Notice({ children }: NoticeProps) {
  return (
    <p
      role="alert"
      className="ca-shake"
      style={{
        margin: "0 0 10px",
        fontFamily: fonts.mono,
        fontSize: fontSizes.small,
        color: colors.warn,
      }}
    >
      {children}
    </p>
  );
}
