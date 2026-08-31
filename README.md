# Chatbot — React · Flask · Azure OpenAI

A small chatbot: type a question, it is validated in the browser, posted to a
Python service, forwarded to an Azure OpenAI deployment, and rendered with the
real timings of every stage it passed through.

![stack](https://img.shields.io/badge/react-19-informational) ![stack](https://img.shields.io/badge/flask-3.1-informational) ![stack](https://img.shields.io/badge/python-3.12-informational) ![stack](https://img.shields.io/badge/typescript-strict-informational)

---

## Demo

`docs/demo.mp4` — the app answering a question, refusing an empty one,
clearing the conversation, and switching theme.

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

Serves on **<http://127.0.0.1:5001>**.

> **Not port 5000.** On macOS, AirPlay Receiver (Control Center) listens on
> `*:5000` and answers `403`, silently shadowing a Flask server bound to
> `127.0.0.1`. Set `PORT` in `.env` to override.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **<http://localhost:5173>**.

> Use `localhost`, not `127.0.0.1` — Vite binds IPv6 `[::1]` only, and the
> backend's CORS allowlist expects the `localhost` origin.

### Environment

`backend/.env` (see `.env.example`):

| Variable                   | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `AZURE_OPENAI_KEY`         | API key. Never leaves the server.                          |
| `AZURE_OPENAI_ENDPOINT`    | e.g. `https://<resource>.openai.azure.com/`                |
| `AZURE_OPENAI_DEPLOYMENT`  | The deployment name, e.g. `gpt-3`                          |
| `AZURE_OPENAI_API_VERSION` | e.g. `2024-02-01`                                          |
| `PORT`                     | Backend port. Defaults to `5001`.                          |
| `FRONTEND_ORIGIN`          | CORS allowlist entry. Defaults to `http://localhost:5173`. |

The frontend reads one optional variable, from `frontend/.env`:

| Variable        | Purpose                                                |
| --------------- | ------------------------------------------------------ |
| `VITE_API_BASE` | Backend base URL. Defaults to `http://127.0.0.1:5001`. |

---

## Testing it

### From the browser

Open <http://localhost:5173>, type a question, press **Send** or **Enter**.
The right-hand panel traces the request and reports measured timings.

Try these:

| Action                                      | Expected                                         |
| ------------------------------------------- | ------------------------------------------------ |
| Ask "What is a trust boundary?"             | An answer, with per-stage timings                |
| Press Send with an empty box                | `Please ask a question!` — no request is sent    |
| Ask a follow-up like "what did I just ask?" | It remembers — history travels with each request |
| Press **Clear**                             | Transcript and trace reset                       |
| Toggle the ◐ icon                           | Light / dark theme, remembered across reloads    |

### From the terminal

```bash
# liveness
curl http://127.0.0.1:5001/health

# a real question
curl -X POST http://127.0.0.1:5001/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"In one sentence, what is a trust boundary?"}'
```

### Automated checks

No test framework required. These three stub the network, so none of them
spend an Azure call:

```bash
cd backend
./venv/bin/python check_schemas.py        # 10 assertions — the request contract
./venv/bin/python check_azure_client.py   # 17 assertions — message assembly, trimming, errors
./venv/bin/python check_app.py            # 21 assertions — routes, status codes, CORS
```

`check_azure.py` is different: it is a connectivity smoke test that makes a
**real** call to Azure. Run it to confirm credentials, not as part of a suite.

```bash
./venv/bin/python check_azure.py
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

Input is validated in the browser, validated again by Pydantic, trimmed and
forwarded to the model, and rendered with the timing of each stage. Validation
failures return `400`; upstream failures return a generic `502`.

---

## Project structure

```
backend/
  app.py               HTTP layer: routes, CORS, error mapping
  azure_client.py      the only module the app uses to reach Azure
  schemas.py           the request contract (Pydantic v2)
  check_schemas.py     \
  check_azure_client.py > self-checks, network stubbed
  check_app.py         /
  check_azure.py       connectivity smoke test — real Azure call
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

`400` — the question is missing, empty, over 1000 characters or not a string;
the body is malformed JSON; or a history entry is missing `content` or carries
a role other than `user` or `assistant`:

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

Recorded as numbered ADRs in **[docs/ADR.md](docs/ADR.md)**, referenced by
number from the source files.

|         |                                                                                  |
| ------- | -------------------------------------------------------------------------------- |
| ADR-001 | Flask over FastAPI                                                               |
| ADR-002 | The backend is a trust boundary, not a proxy — the key never reaches the browser |
| ADR-003 | Stateless server; the client carries history, the server trims it                |
| ADR-004 | Pydantic at the boundary; `Literal` on `role` closes a prompt-injection hole     |
| ADR-005 | No database                                                                      |
| ADR-006 | Whole responses, not streaming                                                   |
| ADR-007 | Request trace in the UI, with measured timings only                              |
| ADR-008 | Report the model Azure returns, not the deployment label                         |
| ADR-009 | Atomic Design in strict TypeScript                                               |
| ADR-010 | Theming through CSS custom properties                                            |

---

## Requirements covered

| Requirement                            | Where                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| Input box, Send button, response area  | `Composer`, `MessageList`                                    |
| React state for input and responses    | `useChat`                                                    |
| Python API with a `/query` endpoint    | `app.py`                                                     |
| Azure OpenAI connection                | `azure_client.py`                                            |
| Keys via environment variables         | `.env`, read in `AzureClient.__init__`                       |
| Empty input → "Please ask a question!" | `useChat` (client) + `schemas.py` rule, returned by `app.py` |
| *Bonus:* clear the conversation                 | `ChatHeader` → `useChat.clear`                               |
| *Bonus:* "Thinking…" while loading              | `ThinkingBubble`                                             |

Beyond the brief: request tracing with measured timings, a light/dark theme,
prompt-injection defence at the schema boundary, a 30s `AbortController`
timeout, 48 backend assertions, and strict TypeScript throughout.
