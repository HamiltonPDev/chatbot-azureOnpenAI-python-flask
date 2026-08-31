/**
 * StageDot — the status bullet for one pipeline stage.
 *
 * @level Atom
 *
 * Three visual states: pending (hollow), active (pulsing), done (settles
 * with a short overshoot — pose-to-pose, so completion is unmistakable).
 */
import { colors, radius } from "@/quarks";
import type { StageStatus } from "@/types/chat";

export interface StageDotProps {
  status?: StageStatus;
}

export function StageDot({ status }: StageDotProps) {
  const color =
    status === "done" ? colors.done : status === "active" ? colors.signal : colors.faint;

  return (
    <span
      className={
        status === "active" ? "ca-live" : status === "done" ? "ca-dot-done" : undefined
      }
      style={{
        width: 7,
        height: 7,
        borderRadius: radius.round,
        background: status ? color : "transparent",
        border: status ? "none" : `1px solid ${colors.rule}`,
        marginTop: 5,
        flexShrink: 0,
        transition: "background 150ms ease-out",
      }}
    />
  );
}
