/**
 * The only module that knows the backend endpoint exists.
 *
 * Mirrors azure_client.py on the server: one file owns the outbound call,
 * so the base URL, the timeout and the error contract change in one place.
 */
import type { Message, QueryResponse } from "@/types/chat";

/**
 * Absolute, not relative: Vite serves the app on 5173 while Flask listens on
 * 5001, so a relative "/query" would hit the dev server. The backend's CORS
 * allowlist is what permits this cross-origin call.
 */
const API_BASE = import.meta.env["VITE_API_BASE"] ?? "http://127.0.0.1:5001";

/** Matches the AzureClient timeout on the server, from the other side. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Thrown for any non-2xx or transport failure. Carries a safe message. */
export class ChatApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
  }
}

interface ErrorBody {
  /** Flask returns {"error": "..."} — not FastAPI's {"detail": "..."}. */
  error?: string;
}

/**
 * POST /query. Rejects with ChatApiError on failure, never with a raw
 * fetch error, so callers have exactly one error type to handle.
 */
export async function postQuery(
  question: string,
  history: Message[],
  signal?: AbortSignal,
): Promise<QueryResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new ChatApiError("The request timed out. Try again.");
    }
    throw new ChatApiError(
      "Could not reach the server. Is the backend running?",
    );
  }

  if (!response.ok) {
    const body: ErrorBody = await response.json().catch(() => ({}));
    throw new ChatApiError(
      body.error ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return (await response.json()) as QueryResponse;
}
