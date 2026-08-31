/**
 * All conversation state and orchestration.
 *
 * Container/presentational split: this hook holds every piece of state and
 * every side effect, so each component below it is pure and testable. The
 * page composes; the hook decides.
 */
import { useCallback, useRef, useState } from "react";

import {
  ChatApiError,
  REQUEST_TIMEOUT_MS,
  postQuery,
} from "@/services/chatApi";
import type { ChatMessage, Message, StageId, Trace } from "@/types/chat";

export const EMPTY_QUESTION_NOTICE = "Please ask a question!";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [notice, setNotice] = useState("");
  const [trace, setTrace] = useState<Trace>({});
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [lastDeployment, setLastDeployment] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const markStage = useCallback(
    (id: StageId, status: "active" | "done", ms?: number) => {
      setTrace((current) => ({
        ...current,
        [id]: ms === undefined ? { status } : { status, ms },
      }));
    },
    [],
  );

  const send = useCallback(async () => {
    // Guard: a request already in flight. Two concurrent calls would resolve
    // out of order and corrupt the transcript.
    if (isThinking) return;

    const question = input.trim();

    // Guard: empty input never reaches the network. The server enforces the
    // same rule in schemas.py, because anyone can curl the API — this half is
    // UX, that half is the rule.
    if (!question) {
      setNotice(EMPTY_QUESTION_NOTICE);
      inputRef.current?.focus();
      return;
    }

    setNotice("");
    setTrace({});
    setLastLatencyMs(null);

    const history: Message[] = messages.map(({ role, content }) => ({
      role,
      content,
    }));

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", content: question },
    ]);
    setInput("");
    setIsThinking(true);

    // Every timing below is MEASURED. Nothing here is simulated.
    const validateStart = performance.now();
    markStage("validate", "active");
    markStage(
      "validate",
      "done",
      Math.round(performance.now() - validateStart),
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    markStage("post", "active");
    const requestStart = performance.now();

    try {
      const data = await postQuery(question, history, controller.signal);
      const roundTripMs = performance.now() - requestStart;

      // The server reports how long Azure itself took. Whatever is left is
      // network plus Flask, so both numbers are real rather than guessed.
      markStage(
        "post",
        "done",
        Math.max(0, Math.round(roundTripMs - data.latency_ms)),
      );
      markStage("model", "done", data.latency_ms);

      const renderStart = performance.now();
      markStage("render", "active");

      setLastLatencyMs(Math.round(roundTripMs));
      setLastModel(data.model);
      setLastDeployment(data.deployment);
      setRuns((n) => n + 1);
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: data.answer },
      ]);

      markStage("render", "done", Math.round(performance.now() - renderStart));
    } catch (error) {
      const message =
        error instanceof ChatApiError
          ? error.message
          : "The model is unavailable. Try again.";

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: message,
          error: true,
        },
      ]);
    } finally {
      // Every branch returns the UI to a usable state.
      clearTimeout(timeout);
      setIsThinking(false);
    }
  }, [input, isThinking, markStage, messages]);

  const clear = useCallback(() => {
    setMessages([]);
    setTrace({});
    setNotice("");
    setLastLatencyMs(null);
    setLastModel(null);
    setLastDeployment(null);
    inputRef.current?.focus();
  }, []);

  const changeInput = useCallback(
    (value: string) => {
      setInput(value);
      if (notice) setNotice("");
    },
    [notice],
  );

  return {
    messages,
    input,
    isThinking,
    notice,
    trace,
    lastLatencyMs,
    lastModel,
    lastDeployment,
    runs,
    inputRef,
    send,
    clear,
    changeInput,
  };
}
