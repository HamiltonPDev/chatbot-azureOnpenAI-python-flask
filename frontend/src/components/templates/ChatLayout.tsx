/**
 * ChatLayout — page structure, no content.
 *
 * @level Template
 *
 * Takes organisms as slots. It knows the grid; it knows nothing about
 * conversations, so the same layout would hold any header/main/aside trio.
 */
import type { ReactNode } from "react";

import { colors, fonts, layout } from "@/quarks";

export interface ChatLayoutProps {
  header: ReactNode;
  conversation: ReactNode;
  composer: ReactNode;
  aside: ReactNode;
}

export function ChatLayout({
  header,
  conversation,
  composer,
  aside,
}: ChatLayoutProps) {
  return (
    <div
      style={{
        background: colors.paper,
        minHeight: "100%",
        fontFamily: fonts.sans,
      }}
    >
      {header}
      <div className="ca-wrap" style={{ background: colors.rule }}>
        <section
          style={{
            background: colors.paper,
            display: "flex",
            flexDirection: "column",
            minHeight: layout.conversationMinHeight,
          }}
        >
          {conversation}
          {composer}
        </section>
        {aside}
      </div>
    </div>
  );
}
