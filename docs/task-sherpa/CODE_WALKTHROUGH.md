# Code Walkthrough — Understanding What You Ship

You are building this with AI assistance, which Anneke explicitly allowed. That is not the risk. The risk is being unable to explain a line you shipped. This document exists so that by Monday you can defend every decision in the codebase as your own — because the decisions *are* yours, even where the typing was assisted.

Read this alongside the code. Do not skim it.

---

## Part 1 — Python for someone who knows TypeScript

You already know how programs are structured. Python is mostly new syntax for concepts you have, not new concepts. Start from what maps.

| TypeScript / Node | Python | Note |
|---|---|---|
| `package.json` | `requirements.txt` | List of dependencies |
| `npm install` | `pip install -r requirements.txt` | |
| `node_modules/` | `venv/` (virtual environment) | Isolated per project, must be *activated* |
| `import { x } from "./y"` | `from y import x` | |
| `const`, `let` | plain assignment | No keyword; convention is UPPER_CASE for constants |
| `function f(a: string): number` | `def f(a: str) -> int:` | Type hints are optional and not enforced at runtime |
| `interface` / `type` | `class` + Pydantic `BaseModel` | Pydantic *does* enforce at runtime — that is its point |
| `zod` schema | Pydantic model | Closest mental match you have |
| `try { } catch (e) { }` | `try: ... except SomeError as e:` | |
| `throw new Error()` | `raise SomeError()` | |
| `{ a: 1 }` object | `{"a": 1}` dict | Keys are quoted |
| `null` / `undefined` | `None` | One value, not two |
| `async/await` | `async/await` | Same idea, but Flask here is synchronous |
| Braces `{ }` | Indentation | Indentation is syntax, not style. Four spaces. |

Two things that will trip you up specifically:

**Decorators.** `@app.post("/query")` above a function is a decorator. It is a function that wraps another function — the same idea as a higher-order function in JS. It tells Flask: when a POST arrives at `/query`, call the function below. That is all it does.

**The virtual environment must be activated.** `source venv/bin/activate` before `pip install` and before running. If you skip it, packages install globally and the reviewer's setup will not match yours.

---

## Part 2 — The backend, in execution order

Three files. Read them in the order the code actually runs.

### 2.1 `schemas.py` — the contract

```python
from typing import Literal
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: list[Message] = []
```

**What it does.** Defines the shape of a valid request. `model_validate()` on this class either returns a clean object or raises.

**Why it is here.** Flask gives you `request.get_json()` and nothing else — no guarantee the payload has a `question`, or that it is a string, or that it is not 50,000 characters. Pydantic makes the contract explicit and enforces it in one place.

**The lines that matter:**
- `min_length=1` — an empty question fails validation before any code runs. This is the server-side half of the empty-input guard.
- `max_length=1000` — caps token spend and rejects abuse. A deliberate number, not a default.
- `Literal["user", "assistant"]` — a client cannot inject a `system` role and hijack your prompt. **This is a prompt-injection defence.** Worth knowing, because it is the kind of thing an AI agency notices.
- `history: list[Message] = []` — optional, defaults to empty. The first message in a conversation has no history.

**Likely question:** *"Why Pydantic and not just an `if` statement?"* Because the validation and the contract stay in one place, and every rule is visible at a glance rather than scattered through the endpoint.

---

### 2.2 `azure_client.py` — the only file that talks to Azure

```python
import os
from dataclasses import dataclass

from openai import AzureOpenAI, OpenAIError

SYSTEM_PROMPT = "You are a helpful assistant. Answer concisely and accurately."
MAX_HISTORY_TURNS = 10


class AzureClientError(Exception):
    """Raised when the upstream model call fails, for any reason."""


@dataclass(frozen=True)
class Completion:
    """One answer, plus which model actually produced it."""
    answer: str
    model: str


class AzureClient:
    def __init__(self):
        self.model_name = os.environ["AZURE_OPENAI_DEPLOYMENT"]
        self._client = AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        )

    def complete(self, question: str, history: list) -> Completion:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += [m.model_dump() for m in history[-MAX_HISTORY_TURNS:]]
        messages.append({"role": "user", "content": question})

        try:
            response = self._client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                timeout=30,
            )
        except OpenAIError as exc:
            raise AzureClientError(str(exc)) from exc

        return Completion(
            answer=response.choices[0].message.content,
            model=response.model,   # what Azure actually ran, not the deployment label
        )
```

**What it does.** Builds the message list, calls Azure, returns a `Completion` — not a bare string. `complete()` deliberately returns both the answer text and `response.model`, the model Azure itself reports as having answered. The deployment is labelled `gpt-3` in the Azure portal, but Azure reports back `gpt-4.1-mini-2025-04-14`. `app.py` forwards both to the client as `model` and `deployment` (ADR-008), so the UI never has to trust a label that could be wrong or renamed.

**Why `api_version` reads from an environment variable.** Earlier drafts hardcoded `"2024-02-01"`. It is now `AZURE_OPENAI_API_VERSION`, read the same way as the other three Azure settings, so bumping the API version does not require a code change.

**Why it is a separate file.** This is the design decision most worth being able to defend. If this code lived inside the endpoint, you could not test `/query` without a live Azure call and a valid key. Isolated, it can be swapped for a stub. **Separation for testability, not tidiness.**

**The lines that matter:**
- `os.environ["..."]` with square brackets — fails loudly at startup if the variable is missing. `os.getenv()` would return `None` and fail later with a confusing error. Failing early is the right trade.
- `messages` starts with the system prompt, then history, then the new question. **The order is the conversation.** The model reads it top to bottom.
- `history[-MAX_HISTORY_TURNS:]` — Python slice notation, "the last 10 items." This is the server-side trimming from ADR-003. The client proposes context; the server decides what to forward.
- `m.model_dump()` — converts a Pydantic object into a plain dict, because the OpenAI SDK expects dicts.
- `timeout=30` — without it, a hung upstream call hangs your request forever.
- `raise AzureClientError(...) from exc` — wraps the SDK's exception in your own. The endpoint then catches *your* error type and never needs to know which SDK you used.

**Likely question:** *"What happens if Azure is slow?"* The timeout fires at 30 seconds, `OpenAIError` is raised, wrapped, and the endpoint returns a 502. The frontend's AbortController covers the same case from the other side.

---

### 2.3 `app.py` — the endpoint

```python
import os
import time

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from azure_client import AzureClient, AzureClientError
from schemas import QueryRequest

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")])

client = AzureClient()


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/query")
def query():
    # 1. Validate at the boundary.
    try:
        payload = QueryRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify(error="Please ask a question!"), 400

    # 2. Call the model, timing it.
    started = time.perf_counter()
    try:
        completion = client.complete(payload.question, payload.history)
    except AzureClientError:
        app.logger.exception("Azure call failed")          # detail → log
        return jsonify(error="The model is unavailable. Try again."), 502

    # 3. Return the answer plus what it cost, and what actually ran.
    return jsonify(
        answer=completion.answer,
        latency_ms=round((time.perf_counter() - started) * 1000),
        model=completion.model,
        deployment=client.model_name,
    )
```

**Execution order when a request arrives:** decorator matches the route → `get_json()` parses the body → Pydantic validates → `client.complete()` calls Azure → response serialised to JSON.

**The lines that matter:**
- `load_dotenv()` — reads `.env` into environment variables. Must run before `AzureClient()` is constructed.
- `CORS(app, origins=[...])` — a browser will refuse a cross-origin request without this. **An allowlist, not `*`.** Be ready to say why: `*` means any website can call your API from a visitor's browser.
- `client = AzureClient()` at module level — constructed once at startup, not per request. Rebuilding the HTTP client on every call would be wasteful.
- `request.get_json(silent=True) or {}` — `silent=True` returns `None` instead of raising on malformed JSON; `or {}` turns that into an empty dict, which then fails Pydantic validation and produces your clean 400. **Malformed JSON and empty input take the same path.**
- `app.logger.exception(...)` then a generic message — the full traceback goes to the log, the client gets one sentence. Returning the exception text would leak internals.
- `time.perf_counter()` — a monotonic clock, correct for measuring durations. `time.time()` can move backwards if the system clock adjusts.
- `model=completion.model, deployment=client.model_name` — **four keys, not three.** The response carries what Azure reports it actually ran (`model`) alongside the configured label (`deployment`), because they can differ — this deployment is labelled `gpt-3` but reports `gpt-4.1-mini-2025-04-14` (ADR-008).

There is no rate limiting here and no `flask-limiter` dependency. `/query` has exactly the two failure responses shown: `400` for every validation failure (empty input, over-length input, malformed JSON, an injected `system` role — all share the message `"Please ask a question!"`), and `502` for an upstream failure. If asked about a `429`, be direct: it was never built.

**Likely question:** *"Why return `latency_ms`?"* It makes the cost of each call visible during development, and it drives the trace panel in the UI. Measuring is cheap; guessing is not.

---

### 2.4 Running it

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill in your values
flask --app app run --port 5001
```

Port **5001**, not the Flask default of 5000 — macOS AirPlay Receiver squats on `:5000` and answers with a `403` that looks like a dead server. `app.py` sets this as the default via `PORT` (`app.run(port=int(os.getenv("PORT", 5001)))`), so it stays correct even if you forget the `--port` flag.

`requirements.txt`:
```
flask==3.1.3
flask-cors==6.0.5
openai==3.6.0
pydantic==2.13.5
python-dotenv==1.2.3
```

Verify before touching the frontend:
```bash
curl -X POST http://localhost:5001/query \
  -H "Content-Type: application/json" \
  -d '{"question":"Hello"}'

curl -X POST http://localhost:5001/query \
  -H "Content-Type: application/json" \
  -d '{"question":""}'          # expect 400 "Please ask a question!"
```

Testing the backend independently of the frontend is a habit worth demonstrating — and it went further than manual curl calls. `backend/check_schemas.py`, `check_azure_client.py` and `check_app.py` are hand-rolled, network-free self-check scripts (no pytest, no unittest — a `check()` helper that prints `OK`/`FAIL` and exits non-zero on any failure), roughly 48 assertions total: schema validation, message assembly and history trimming against a fake client, and every endpoint behaviour — including the 400s, the 502 with an explicit assertion that upstream error text does not leak, and CORS headers for allowed and foreign origins. Run each with `./venv/bin/python check_X.py`. `check_azure.py` is separate: a live connectivity smoke test that spends real Azure quota, meant to be run manually, not routinely. None of these are wired into CI — there is no `.github/workflows` in the repo.

---

## Part 3 — The React side

The prototype (`ChatApp.jsx` at the repo root) was one 485-line component with mocked responses — the starting point the brief provided. It is kept as-is, unused, a record of where the build began. The shipped app is a full rewrite: 100% TypeScript, decomposed by Atomic Design (ADR-009), with every piece of state and every side effect pulled into one hook. This section is a refresher on what the *real* code does, not the prototype.

### Where everything lives

```
src/hooks/useChat.ts       ← ALL state and side effects (the container)
src/hooks/useTheme.ts      ← light/dark/system theme, separate concern
src/pages/ChatPage.tsx     ← composition only, no state of its own
src/components/
  templates/ChatLayout.tsx   ← page grid, takes organisms as slots
  organisms/  ChatHeader, MessageList, TracePanel
  molecules/  Composer, EmptyState, LatencyTotal, MessageBubble, ThinkingBubble, TraceStage
  atoms/      Badge, Button, Eyebrow, Notice, StageDot, TextInput, ThemeToggle
src/services/chatApi.ts    ← the only module that knows the backend URL
src/types/chat.ts          ← wire contract, mirrors backend/schemas.py
```

`ChatPage` calls `useChat()` and `useTheme()`, then hands the returned values down as props through `ChatLayout` into the organisms. Nothing below `useChat` holds business state — components read props and call the callbacks they are given. This is the container/presentational split: one container (`useChat`), many pure presentational components.

### The state, and why each piece exists

```ts
// src/hooks/useChat.ts
const [messages, setMessages]         = useState<ChatMessage[]>([]);
const [input, setInput]               = useState("");
const [isThinking, setIsThinking]     = useState(false);
const [notice, setNotice]             = useState("");
const [trace, setTrace]               = useState<Trace>({});
const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
const [lastModel, setLastModel]       = useState<string | null>(null);
const [lastDeployment, setLastDeployment] = useState<string | null>(null);
const [runs, setRuns]                 = useState(0);
```

More pieces of state than the original four-component sketch implied — `notice` (the inline validation message), `lastModel` and `lastDeployment` (what the header displays, per ADR-008) and `runs` (the request counter badge) all earned their place once the UI needed to show them. `useChat` is the single owner; every other file is a consumer.

**Controlled input.** `Composer` receives `value` and `onChange` as props and never holds its own copy of the text — React (via `useChat`) is the single source of truth. Be able to explain this; it is the most common React fundamentals question there is.

**Why state lives in one hook, not in `ChatPage`.** With a component tree this deep (page → template → several organisms → molecules), lifting state into the top component and drilling it down through every layer by hand would be exactly the kind of ceremony a hook avoids. `useChat` is the "nearest common owner" for every piece of chat state, and `ChatPage` reads it once.

### Immutable updates

```ts
// src/hooks/useChat.ts
setMessages((current) => [
  ...current,
  { id: Date.now(), role: "user", content: question },
]);
```

React decides to re-render by comparing references. Mutating the existing array in place would leave the reference identical, so nothing renders. The spread creates a new array.

The callback form `(current) => [...current, x]` rather than `[...messages, x]` guarantees the update is based on the latest state, not a value captured when the closure was created — important here because `send` is itself wrapped in `useCallback`.

### The `finally` block

```ts
// src/hooks/useChat.ts, inside send()
try {
  const data = await postQuery(question, history, controller.signal);
  // ...append assistant message, update trace and latency
} catch (error) {
  const message =
    error instanceof ChatApiError
      ? error.message
      : "The model is unavailable. Try again.";
  setMessages((current) => [
    ...current,
    { id: Date.now() + 1, role: "assistant", content: message, error: true },
  ]);
} finally {
  clearTimeout(timeout);
  setIsThinking(false);   // every path, without exception
}
```

If `setIsThinking(false)` sat only in the success branch, a failed request would leave the spinner running forever and the Send button disabled. `finally` runs on every path. **A stuck interface is worse than a visible error** — that sentence is the answer if asked about error handling.

### The double-submit guard

```ts
// src/hooks/useChat.ts, first line of send()
if (isThinking) return;
```

Two concurrent requests can return out of order and interleave the transcript. Dropping the second submit is simpler and more correct than queuing.

### `useEffect` for autoscroll

```tsx
// src/components/organisms/MessageList.tsx
const scrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const node = scrollRef.current;
  if (node) node.scrollTop = node.scrollHeight;
}, [messages, isThinking]);
```

Autoscroll lives inside `MessageList`, not in a top-level `App` component — there is no top-level `App` component in this codebase at all. Scrolling is a side effect: it touches the DOM directly rather than describing what to render, so `MessageList` owns exactly this one piece of local, presentational state and nothing else. The dependency array says: run this after the transcript changes or the thinking state flips.

### `useRef` versus `useState`

`useRef` holds a value across renders **without causing a re-render**. Used for the scroll container in `MessageList` and for the input element in `useChat` (`inputRef`, refocused after Clear or an empty-submit notice). Rule of thumb: if changing it should update the screen, it is state; if it is a handle to something, it is a ref.

### `chatApi.ts` — the frontend's `azure_client.py`

```ts
// src/services/chatApi.ts
const API_BASE = import.meta.env["VITE_API_BASE"] ?? "http://127.0.0.1:5001";
export const REQUEST_TIMEOUT_MS = 30_000;
```

Same idea as the backend's isolation of Azure into one file: `chatApi.ts` is the only module that knows the backend URL exists, mirroring `azure_client.py` being the only module that knows Azure exists. There is **no Vite dev proxy** — `vite.config.js` only registers the React plugin and an `@` alias — so this really is a cross-origin call from `localhost:5173` to `127.0.0.1:5001`, which is exactly why the backend's CORS allowlist matters and is not just a formality. (One quirk worth knowing: Vite binds `[::1]`, so `http://localhost:5173` satisfies the CORS origin match and `http://127.0.0.1:5173` does not.)

`REQUEST_TIMEOUT_MS = 30_000` mirrors `timeout=30` in `azure_client.py`. The two are declared independently and kept in sync by hand — a known gap, not a hidden one.

---

## Part 4 — Self-test

Close the files. Answer these out loud, in English. Anything you cannot answer, go back and read that section again.

**Python and Flask**
1. What does `@app.post("/query")` do?
2. Why is `azure_client.py` a separate file?
3. What happens if `AZURE_OPENAI_KEY` is missing when the app starts?
4. Where does the API key live, and why not in the frontend?
5. Why is `CORS` restricted to one origin instead of `*`?
6. Walk through what happens when someone POSTs `{"question": ""}`.
7. Why does the client get a generic message when Azure fails, instead of the real error?
8. What does `history[-10:]` do, and why trim on the server?

**React**
9. What makes the `Composer` input "controlled", given the value itself lives in `useChat`?
10. Why `setMessages(current => [...current, x])` instead of `messages.push(x)`?
11. Why does `setIsThinking(false)` sit in a `finally` inside `useChat.send()`?
12. Why does all chat state live in the `useChat` hook rather than in `ChatPage` or spread across components?
13. What does the `useEffect` dependency array in `MessageList` control, and why does autoscroll live there instead of in a top-level component?
14. When would you use `useRef` instead of `useState`? Name one place each is used in this codebase.

**Architecture**
15. Why does the backend exist at all?
16. Why Flask and not FastAPI?
17. Why is there no database?
18. What is the first thing you would add with another week, and why that first?

If you can answer all eighteen without notes, you can defend this codebase.

---

## Part 5 — Trap questions

Three questions that sound simple and are not.

**"Did you write this yourself?"**
Answer honestly and specifically: you used AI assistance for boilerplate — the Azure client wrapper, Pydantic models — and rejected several of its suggestions, including a single-file design that would have made the endpoint untestable and error handling that returned exception text to the client. The architecture and the decisions are yours. Section 6 of the Design Log documents exactly this. Anneke invited the tooling; being precise about *how* you used it is the differentiator.

**"What would you do differently?"**
Have a real answer ready. Streaming, because perceived latency is the weakest part of the current experience. Do not say "nothing" — it reads as no self-assessment.

**"Explain the data flow."**
Do not recite the diagram. Walk one message through: typed → trimmed and guarded → optimistic render → POST → Pydantic → history trimmed → Azure → normalised with timing → rendered. Nine steps, roughly thirty seconds. Practise it out loud.
