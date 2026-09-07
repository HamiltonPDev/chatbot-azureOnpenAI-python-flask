# Chatbot Application — Architecture & Data Flow

**Author:** Hamilton
**Assignment:** Sherpa Digital — React frontend, Python backend, Azure OpenAI
**Deployment:** labelled `gpt-3` in Azure, but the deployment actually serves `gpt-4.1-mini-2025-04-14`. The API reports both — see ADR-008.

---

## 1. System overview

Three tiers, one responsibility each. The browser never talks to Azure directly — the Python service is the only holder of the API key and the only place where model behaviour is defined.

```
┌────────────────┐   POST /query    ┌────────────────┐  chat.completions  ┌────────────────┐
│   React (UI)   │ ───────────────► │     Flask      │ ─────────────────► │  Azure OpenAI  │
│                │                  │   (backend)    │                    │ deployment:gpt-3│
│  useChat hook  │ ◄─────────────── │                │ ◄───────────────── │ (gpt-4.1-mini)  │
│  owns state    │ {answer, model,  │  key + prompt  │    completion      │                │
│                │  deployment, ms} │                │                    │                │
└────────────────┘                  └────────────────┘                    └────────────────┘
      public                          private / .env                        Azure tenant
```

**Why a backend at all**, when the browser could call Azure itself: the key would be readable in devtools by any visitor. The backend is a trust boundary, not a formality. It is also where the system prompt, context assembly, and logging live — all of which change without touching the client.

**Why Flask.** Two reasons, in this order. It is the framework Sherpa builds its web services in, so the submission should be readable by the team that would maintain it. And for a service with a single endpoint and no persistence layer, Flask's smaller surface is the right fit — the parts of FastAPI I would miss (request validation, generated docs) are addable to Flask deliberately rather than inherited by default. Django was never a candidate: its value is the ORM, migrations, and admin, none of which this service has any use for.

What Flask does not give for free is schema validation, so I add **Pydantic v2 as a standalone dependency** and validate at the boundary explicitly. That keeps the contract in one place and makes the validation a visible decision instead of an invisible default.

---

## 2. Data flow — happy path

A single request, end to end:

| # | Stage | Where | What happens |
|---|-------|-------|--------------|
| 1 | Capture | React | `input` state updates on each keystroke |
| 2 | Validate | React | Trim; block empty submit before it costs a request |
| 3 | Optimistic render | React | User message appended to `messages`, `isThinking = true` |
| 4 | Transport | React → API | `POST /query` with `{ question, history }` |
| 5 | Validate | Flask | Pydantic model; reject empty or over-length input |
| 6 | Compose | Flask | System prompt + trimmed history + new question |
| 7 | Inference | Azure | `chat.completions.create(model=deployment_name)` — `deployment_name` is the configured label (`gpt-3`) |
| 8 | Normalise | Flask | Extract text; attach `latency_ms`, the `model` Azure reports it actually ran (`gpt-4.1-mini-2025-04-14`), and the `deployment` label (ADR-008) |
| 9 | Render | React | Append assistant message, `isThinking = false` |

**History is sent from the client and trimmed on the server.** The model is stateless — each call must carry its own context. Trimming server-side (last N turns) keeps token cost bounded regardless of what the client sends.

---

## 3. Control flow — the branches that matter

The happy path is the easy half. These are the decisions:

```
submit
  │
  ├─ input empty? ──────────► return "Please ask a question!"   (no network call)
  │
  ├─ request in flight? ────► ignore submit                      (prevents double-send)
  │
  └─ POST /query
       │
       ├─ 400  validation ──► show the server's message inline
       ├─ 502  upstream ────► "The model is unavailable. Try again."
       ├─ timeout (>30s) ───► abort via AbortController, offer retry
       └─ 200 ──────────────► append answer
  │
  finally ─────────────────► isThinking = false     (always, on every branch)
```

Two rules applied deliberately:

- **The empty-input check lives in both tiers.** Client-side for instant feedback, server-side because a client check is a convenience, not a guarantee.
- **`isThinking` resets in a `finally`.** Every error path must return the UI to a usable state; a spinner that never stops is worse than an error message.

---

## 4. API contract

```http
POST /query
Content-Type: application/json

{
  "question": "What can you help me with?",
  "history":  [{ "role": "user", "content": "..." },
               { "role": "assistant", "content": "..." }]
}
```

**200**
```json
{
  "answer": "…",
  "latency_ms": 812,
  "model": "gpt-4.1-mini-2025-04-14",
  "deployment": "gpt-3"
}
```

`model` is what Azure reports actually ran; `deployment` is the configured label. The app deliberately surfaces both (ADR-008) rather than trusting the label.

**400** — `{ "error": "Please ask a question!" }` (every validation failure — empty input, over-length input, a malformed body, an injected `system` role — returns this same message)
**502** — upstream Azure error (never leak the raw exception)

There is no rate limiting. No `flask-limiter` dependency exists and `/query` has no 429 path — an earlier draft of this document described one, but it was never built.

`GET /health` returns `{ "status": "ok" }` — trivial to add, and it is what a deployment probe on Azure App Service would call.

Returning `latency_ms` is not decoration: it makes the cost of each call visible during development and drives the trace panel in the UI.

---

## 5. Backend shape

```python
# backend/app.py  (abridged — shows the boundary, not the whole file)

@app.post("/query")
def query():
    try:
        payload = QueryRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify(error="Please ask a question!"), 400

    started = time.perf_counter()
    try:
        completion = client.complete(payload.question, payload.history)
    except AzureClientError:
        app.logger.exception("Azure call failed")        # detail stays in the log
        return jsonify(error="The model is unavailable. Try again."), 502

    return jsonify(
        answer=completion.answer,
        latency_ms=round((time.perf_counter() - started) * 1000),
        model=completion.model,        # what Azure actually reports
        deployment=client.model_name,  # the configured label, e.g. "gpt-3"
    )
```

The pattern worth noting: **the exception detail is logged, the client gets a generic message.** Stack traces in an HTTP response are an information leak.

`client.complete()` does not return a bare string — it returns a `Completion` dataclass (`answer`, `model`) defined in `azure_client.py`, precisely so the route handler can report both what ran and what it was configured as (ADR-008).

---

## 6. Security

The key is the whole ballgame in this assignment. Choices:

- `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` in `.env`, loaded with `python-dotenv`
- `.env` in `.gitignore`; `.env.example` committed with empty values so the reviewer can run it
- CORS restricted to the frontend origin via `flask-cors` — not `*`
- Max input length (1000 chars) to cap token spend and reject abuse
- Upstream errors caught and replaced with a generic message; detail stays in server logs
- **No rate limiting exists.** There is no `flask-limiter` dependency and no 429 path on `/query`. This is a known gap, not a hidden one — see §11.

In a real Azure deployment the next step is removing the key entirely: **Managed Identity** on App Service, with the secret in Key Vault, so no credential exists in the application at all. That deployment target — Static Web App, App Service, Key Vault, App Insights — is not built; it is described in `DIAGRAMS_AND_DECISIONS.md` §5 as a target, not a claim about what runs today.

---

## 7. Project structure

```
chatbot-azureOpenAI-python-flask/
├── backend/
│   ├── app.py                  # Flask app, /query, /health — HTTP + trust boundary only
│   ├── azure_client.py         # the only module that talks to Azure; isolated for testing
│   ├── schemas.py              # Pydantic v2 request models
│   ├── check_schemas.py        # self-check: validation rules
│   ├── check_azure_client.py   # self-check: message assembly, history trimming, errors (network-free)
│   ├── check_app.py            # self-check: endpoints via Flask test_client (stubbed Azure)
│   ├── check_azure.py          # live smoke test against real Azure — run manually, spends quota
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── quarks/              # design tokens — colors, space, typography (var(--ca-*))
│   │   ├── components/
│   │   │   ├── atoms/           # Badge, Button, Eyebrow, Notice, StageDot, TextInput, ThemeToggle
│   │   │   ├── molecules/       # Composer, EmptyState, LatencyTotal, MessageBubble, ThinkingBubble, TraceStage
│   │   │   ├── organisms/       # ChatHeader, MessageList, TracePanel
│   │   │   └── templates/       # ChatLayout
│   │   ├── pages/
│   │   │   └── ChatPage.tsx     # composition only
│   │   ├── hooks/
│   │   │   ├── useChat.ts       # all conversation state and side effects
│   │   │   └── useTheme.ts      # light/dark/system, persisted to localStorage
│   │   ├── services/
│   │   │   └── chatApi.ts       # the only module that knows the backend URL
│   │   └── types/
│   │       └── chat.ts          # wire contract, mirrors schemas.py
│   └── package.json
└── docs/
    └── ADR.md
```

The project is 100% TypeScript on the frontend — there are no `.jsx` files (`ChatApp.jsx` at the repo root is the original assignment prototype, kept as a record, not part of the built app). The structure follows Atomic Design (ADR-009): imports flow only upward, and `useChat` is the single owner of state so every component below it is pure and easy to reason about.

`azure_client.py` is separated so the endpoint can be tested with a stub — the API surface should not depend on a live Azure call to be verifiable. That separation is exactly what `check_app.py` exercises.

---

## 8. Interface decision

The assignment asks for an input, a send button, and a response area. I added one thing beyond that: a **trace panel** showing each request moving through the pipeline — validation, transport, inference, render — with real timings.

The reasoning: the brief asks to demonstrate thinking about data and control flow. Rather than only describing it in this document, the interface makes it observable. It also earns its place as a debugging tool — when a response is slow, you can see whether the time went to the network or to the model.

Both bonus items are included: **Clear** resets the conversation, and a **Thinking…** state renders while the request is in flight.

---

## 9. Phase 2 — applying this to a real use case

The same architecture becomes a booking assistant for **Casa Brunelli**, a private estate near Volterra, Tuscany, by adding one step between validation and inference:

```
question → embed → retrieve top-k passages from property docs → inject as context → Azure → answer
```

What changes:

- A small corpus (property description, location, capacity, pool, directions) is chunked and embedded once
- Each question retrieves the most relevant passages and injects them into the system prompt
- The model answers from the property's own facts instead of general knowledge — no invented bedroom counts
- Multilingual by default: guests write in English, Italian, Dutch, or Spanish and get the same grounded answer
- When intent shifts to booking, the assistant hands off to the availability flow rather than guessing at dates

This is the difference between a chatbot and a product: the same three tiers, plus grounding.

---

## 10. Plan to submission (Monday 31 August)

| Day | Work |
|-----|------|
| Tue–Wed | Backend: Flask skeleton, `/query`, Azure client, error handling |
| Wed–Thu | Frontend: chat state, composer, message rendering, error states |
| Thu | Wire end to end, trace panel, Clear + Thinking |
| Fri | Edge cases, README, screen recording |
| Sat | Phase 2 if time allows — RAG grounding on Casa Brunelli docs |
| Sun | Buffer, final pass, zip and send |

---

## 11. Known limitations

Stated deliberately rather than hidden:

- No streaming — responses arrive whole. Streaming would improve perceived latency and is a deliberate tradeoff (ADR-006), not an oversight.
- Conversation lives in memory; a refresh clears it. Persistence would need a session store.
- No authentication and **no rate limiting** on `/query` — appropriate for a demo, not for anything public. CORS is not a security boundary either; it stops a browser, not a `curl` request.
- History trimming is naive (last N turns) rather than token-aware summarisation, and the client sends the entire transcript every request — only the server-side trim bounds it, so payload size grows unbounded on long conversations.
- `response.usage` (token counts) is available from Azure but discarded — there is no cost tracking on `/query`.
- The two 30-second timeouts (`chatApi.ts` client-side, `azure_client.py` server-side) are declared independently and kept in sync by hand.
- `chatApi.ts` casts the 200 response body to `QueryResponse` with no runtime validation.
- Flask's development server is used locally (`app.run(debug=True)`); a real deployment runs behind Gunicorn on Azure App Service.
