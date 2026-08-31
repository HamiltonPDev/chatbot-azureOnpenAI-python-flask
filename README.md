# Chatbot — React · Flask · Azure OpenAI

A small chatbot: type a question, it is validated in the browser, posted to a
Python service, forwarded to an Azure OpenAI deployment, and rendered with the
real timings of every stage it passed through.

![stack](https://img.shields.io/badge/react-19-informational) ![stack](https://img.shields.io/badge/flask-3.1-informational) ![stack](https://img.shields.io/badge/python-3.12-informational) ![stack](https://img.shields.io/badge/typescript-strict-informational)

---

## Demo

> `docs/demo.mp4` — the app answering a question, refusing an empty one,
> clearing the conversation, and switching theme.

---

## Quick start

Two processes must run at once, in two terminals.

### 1. Backend

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env          # then fill in the Azure values
./venv/bin/python app.py
```

Serves on **http://127.0.0.1:5001**.

> **Not port 5000.** On macOS, AirPlay Receiver (Control Center) listens on
> `*:5000` and answers `403`, silently shadowing a Flask server bound to
> `127.0.0.1`. Set `PORT` in `.env` to override.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

> Use `localhost`, not `127.0.0.1` — Vite binds IPv6 `[::1]` only, and the
> backend's CORS allowlist expects the `localhost` origin.

### Environment

`backend/.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `AZURE_OPENAI_KEY` | API key. Never leaves the server. |
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://<resource>.openai.azure.com/` |
| `AZURE_OPENAI_DEPLOYMENT` | The deployment name, e.g. `gpt-3` |
| `AZURE_OPENAI_API_VERSION` | e.g. `2024-02-01` |
| `PORT` | Backend port. Defaults to `5001`. |
| `FRONTEND_ORIGIN` | CORS allowlist entry. Defaults to `http://localhost:5173`. |

---

## Testing it

### From the browser

Open http://localhost:5173, type a question, press **Send** or **Enter**.
The right-hand panel traces the request and reports measured timings.

Try these:

| Action | Expected |
|---|---|
| Ask "What is a trust boundary?" | An answer, with per-stage timings |
| Press Send with an empty box | `Please ask a question!` — no request is sent |
| Ask a follow-up like "what did I just ask?" | It remembers — history travels with each request |
| Press **Clear** | Transcript and trace reset |
| Toggle the ◐ icon | Light / dark theme, remembered across reloads |

### From the terminal

```bash
# liveness
curl http://127.0.0.1:5001/health

# a real question
curl -X POST http://127.0.0.1:5001/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"In one sentence, what is a trust boundary?"}'

# the empty-input rule
curl -X POST http://127.0.0.1:5001/query \
  -H 'Content-Type: application/json' -d '{"question":""}'
```

### Automated checks

No test framework required — each backend module ships a self-check script
that stubs the network, so none of these spend an Azure call.

```bash
cd backend
./venv/bin/python check_schemas.py        # 10 assertions — the request contract
./venv/bin/python check_azure_client.py   # 17 assertions — message assembly, trimming, errors
./venv/bin/python check_app.py            # 21 assertions — routes, status codes, CORS
```

```bash
cd frontend
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint
npm run build
```

---

## How a request travels

```
browser ──POST /query──► Flask ──chat.completions──► Azure OpenAI
   ▲         {question,      │                            │
   │          history}       │                            │
   └────────────────────── {answer, latency_ms, model} ◄──┘
```

There is deliberately **no arrow from the browser to Azure**. That absence is
the reason the middle tier exists: the API key never reaches the client.

1. **Validate (client)** — empty input never reaches the network.
2. **POST /query (Flask)** — Pydantic validates the payload or returns `400`.
3. **Chat completion (Azure)** — history is trimmed, the system prompt is
   prepended, the model answers. Failures become a generic `502`.
4. **Render (client)** — the answer is appended and the trace updated.

---

## Project structure

```
backend/
  app.py               HTTP layer: routes, CORS, error mapping
  azure_client.py      the ONLY module that talks to Azure
  schemas.py           the request contract (Pydantic v2)
  check_*.py           self-check scripts, no network
frontend/src/
  quarks/              design tokens — import nothing
  types/chat.ts        the wire contract, mirroring schemas.py
  services/chatApi.ts  the ONLY module that knows the endpoint
  hooks/               useChat (state + orchestration), useTheme
  components/
    atoms/             Button TextInput Eyebrow Badge StageDot Notice ThemeToggle
    molecules/         MessageBubble ThinkingBubble Composer TraceStage …
    organisms/         ChatHeader MessageList TracePanel
    templates/         ChatLayout — structure, no content
  pages/ChatPage.tsx   composition only
```

The frontend follows **Atomic Design**: quarks → atoms → molecules →
organisms → templates → pages, with imports only ever flowing upward. State
lives in `useChat`, so every component below it is pure and testable.

---

## API

### `GET /health`

```json
{ "status": "ok" }
```

Liveness only — it touches nothing downstream, so it can be polled freely.

### `POST /query`

Request:

```json
{
  "question": "What is a trust boundary?",
  "history": [{ "role": "user", "content": "hi" }]
}
```

`200`:

```json
{
  "answer": "…",
  "latency_ms": 1493,
  "model": "gpt-4.1-mini-2025-04-14",
  "deployment": "gpt-3"
}
```

`400` — the question is missing, empty, over 1000 characters, not a string, the
body is malformed JSON, or a history entry carries a role other than `user` or
`assistant`:

```json
{ "error": "Please ask a question!" }
```

`502` — the upstream call failed. The detail goes to the server log; the
browser gets one sentence:

```json
{ "error": "The model is unavailable. Try again." }
```

---

## Design decisions

**The backend is a trust boundary, not a proxy.** The browser could call Azure
directly, but the API key would then be readable in devtools by any visitor.
Routing every call through Flask costs one network hop and keeps the key, the
system prompt, the history policy, and the error surface on the server.

**The server is stateless; the client carries the history.** The model has no
memory, so context must be supplied on every call. Sending it from the browser
means no session store and no sticky sessions. The server trims to the last 10
messages before forwarding — the client proposes context, the server decides
what to spend.

**`role` is a closed set.** `Literal["user", "assistant"]` rejects a client
trying to inject a `system` turn, which would otherwise land in the message
array and override the system prompt. Three words of type annotation close a
prompt-injection hole.

**Validation is duplicated on purpose.** The browser blocks empty input for
responsiveness; `schemas.py` blocks it because anyone can `curl` the API. The
client check is UX, the server check is the rule.

**One generic `400`.** Every rejection returns the same message so a caller
probing the API learns nothing about which rule it tripped.

**Timings are measured, never simulated.** The client times validation and
render; the server reports how long Azure took; the difference is network plus
Flask. Nothing in the trace panel is invented.

**Whole responses, not streaming.** Simpler contract and error handling, at the
cost of perceived latency on long answers. The "Thinking…" state and the live
trace mitigate it. Streaming is the first improvement I would make.

### A note on the model

The deployment is **named** `gpt-3`, and the brief describes it as
`gpt-35-turbo`. Azure reports something else:

```
AZURE_OPENAI_DEPLOYMENT (env) : gpt-3
response.model (what ran)     : gpt-4.1-mini-2025-04-14
```

A deployment name is an arbitrary label, not the model behind it. The UI shows
what Azure reports actually ran, and keeps the label alongside it.

---

## Requirements covered

| Requirement | Where |
|---|---|
| Input box, Send button, response area | `Composer`, `MessageList` |
| React state for input and responses | `useChat` |
| Python API with a `/query` endpoint | `app.py` |
| Azure OpenAI connection | `azure_client.py` |
| Keys via environment variables | `.env`, read in `AzureClient.__init__` |
| Empty input → "Please ask a question!" | `useChat` (client) + `schemas.py` (server) |
| *Bonus:* clear the conversation | `ChatHeader` → `useChat.clear` |
| *Bonus:* "Thinking…" while loading | `ThinkingBubble` |

Beyond the brief: request tracing with measured timings, a light/dark theme,
prompt-injection defence at the schema boundary, a 30s `AbortController`
timeout, 48 backend assertions, and strict TypeScript throughout.
