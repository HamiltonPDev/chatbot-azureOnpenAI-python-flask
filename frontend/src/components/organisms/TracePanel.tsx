/**
 * TracePanel — the request pipeline with live status and measured timings.
 *
 * @level Organism
 * @composition Eyebrow, TraceStage, LatencyTotal
 *
 * Implements ADR-007: surfacing the request trace in the interface. Every
 * number shown here is measured, never simulated.
 */
import { Eyebrow } from "@/components/atoms";
import { LatencyTotal, TraceStage } from "@/components/molecules";
import { colors } from "@/quarks";
import type { StageId, Trace } from "@/types/chat";

interface StageDefinition {
  id: StageId;
  label: string;
  where: string;
}

/** Mirrors the control flow in ARCHITECTURE.md §3. */
const STAGES: StageDefinition[] = [
  { id: "validate", label: "validate input", where: "client" },
  { id: "post", label: "POST /query", where: "flask" },
  { id: "model", label: "chat completion", where: "azure" },
  { id: "render", label: "render", where: "client" },
];

export interface TracePanelProps {
  trace: Trace;
  latencyMs: number | null;
}

export function TracePanel({ trace, latencyMs }: TracePanelProps) {
  return (
    <aside style={{ background: colors.panel, padding: "24px 18px" }}>
      <Eyebrow style={{ marginBottom: 18 }}>request trace</Eyebrow>

      {STAGES.map((stage, index) => (
        <TraceStage
          key={stage.id}
          label={stage.label}
          where={stage.where}
          state={trace[stage.id]}
          showConnector={index < STAGES.length - 1}
        />
      ))}

      <LatencyTotal latencyMs={latencyMs} />
    </aside>
  );
}
