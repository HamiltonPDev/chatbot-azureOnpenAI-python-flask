/**
 * Composer — the input row: notice, field and send button.
 *
 * @level Molecule
 * @composition Notice, TextInput, Button
 */
import type { KeyboardEvent, Ref } from "react";

import { Button, Notice, TextInput } from "@/components/atoms";
import { colors } from "@/quarks";

export interface ComposerProps {
  value: string;
  notice: string;
  isThinking: boolean;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function Composer({
  value,
  notice,
  isThinking,
  inputRef,
  onChange,
  onSend,
}: ComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.rule}`,
        background: colors.panel,
        padding: "14px 20px",
      }}
    >
      {notice && <Notice>{notice}</Notice>}
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a question…"
          /* Matches Field(max_length=1000) in schemas.py. */
          maxLength={1000}
          aria-label="Your question"
        />
        <Button onClick={onSend} disabled={isThinking}>
          Send
        </Button>
      </div>
    </div>
  );
}
