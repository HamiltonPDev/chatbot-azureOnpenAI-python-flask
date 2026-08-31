/**
 * The wire contract, mirrored from the backend.
 *
 * These types are the TypeScript half of what backend/schemas.py enforces
 * with Pydantic. One contract, checked at both ends: the browser cannot
 * send a shape the server would reject without the compiler noticing first.
 */

/** Mirrors backend Message: role is a closed set, exactly as Literal[...]. */
export interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Mirrors backend QueryRequest. */
export interface QueryRequest {
  question: string;
  history: Message[];
}

/** A 200 from POST /query. */
export interface QueryResponse {
  answer: string;
  latency_ms: number;
  /** What Azure reports actually ran, e.g. "gpt-4.1-mini-2025-04-14". */
  model: string;
  /** The deployment label it hides behind, e.g. "gpt-3". */
  deployment: string;
}

/** One rendered turn. Extends the wire shape with client-only concerns. */
export interface ChatMessage extends Message {
  id: number;
  /** True when this assistant turn is reporting a failure, not an answer. */
  error?: boolean;
}

/** The stages a single request passes through, for the trace panel. */
export type StageId = "validate" | "post" | "model" | "render";

export type StageStatus = "active" | "done";

export interface StageState {
  status: StageStatus;
  ms?: number;
}

/** Partial: a stage has no entry until the request reaches it. */
export type Trace = Partial<Record<StageId, StageState>>;
