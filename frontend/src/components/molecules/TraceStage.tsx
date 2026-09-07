/**
 * TraceStage — one row of the request trace: dot, connector, labels.
 *
 * @level Molecule
 * @composition StageDot
 */
import { StageDot } from "@/components/atoms";
import { colors, fonts, fontSizes, tracking } from "@/quarks";
import type { StageState } from "@/types/chat";

export interface TraceStageProps {
  label: string;
  where: string;
  state?: StageState;
  /** False on the final stage, which needs no connector below it. */
  showConnector: boolean;
}

export function TraceStage({
  label,
  where,
  state,
  showConnector,
}: TraceStageProps) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 2 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <StageDot status={state?.status} />
        {showConnector && (
          <span
            style={{
              width: 1,
              flex: 1,
              minHeight: 26,
              background: colors.rule,
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: 12, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.mono,
            fontSize: fontSizes.small,
            color: state ? colors.ink : colors.faint,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "1px 0 0",
            fontFamily: fonts.mono,
            fontSize: fontSizes.micro,
            letterSpacing: tracking.wide,
            color: colors.faint,
          }}
        >
          {where}
          {state?.ms != null && ` · ${state.ms}ms`}
        </p>
      </div>
    </div>
  );
}
