/**
 * LatencyTotal — the measured round trip for the last request.
 *
 * @level Molecule
 * @composition Eyebrow
 */
import { Eyebrow } from "@/components/atoms";
import { colors, fonts, fontSizes } from "@/quarks";

export interface LatencyTotalProps {
  latencyMs: number | null;
}

export function LatencyTotal({ latencyMs }: LatencyTotalProps) {
  return (
    <div style={{ borderTop: `1px solid ${colors.rule}`, marginTop: 10, paddingTop: 14 }}>
      <Eyebrow>total</Eyebrow>
      <p
        key={latencyMs ?? "idle"}
        className={latencyMs != null ? "ca-count" : undefined}
        style={{
          margin: "4px 0 0",
          fontFamily: fonts.mono,
          fontSize: fontSizes.display,
          color: latencyMs != null ? colors.ink : colors.faint,
        }}
      >
        {latencyMs != null ? latencyMs : "—"}
        {latencyMs != null && (
          <span style={{ fontSize: 12, color: colors.faint }}> ms</span>
        )}
      </p>
    </div>
  );
}
