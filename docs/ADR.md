# Architecture Decision Records

Short records, one decision each: the situation, what was chosen, what it
costs, and what was rejected. Referenced by number from the source files.

Format: **Context · Decision · Consequences · Rejected**.

---

## ADR-001 — Flask as the web framework

**Context.** The brief allows Flask or FastAPI.

**Decision.** Flask.

**Consequences.** No automatic request validation and no generated API docs;
validation is added deliberately instead (ADR-004). The service stays readable
by a team that already builds in Flask.

**Rejected.** *FastAPI* — better defaults for exactly this shape, but a
mismatch with the target stack. *Django* — its value is the ORM, migrations
and admin, none of which this service uses.

---

## ADR-002 — The backend is a trust boundary, not a proxy

**Context.** The browser could call Azure OpenAI directly; the SDK runs in
JavaScript.

**Decision.** Every model call routes through Flask.

**Consequences.** One extra network hop. In exchange, four things stay under
server control and can change without a frontend release:

| Controlled server-side | Why the browser cannot hold it |
|---|---|
| `AZURE_OPENAI_KEY` | Anything the browser can read, a visitor can read |
| `SYSTEM_PROMPT` | A client could replace the bot's instructions |
| History forwarded | A client could send 500 turns and drain the budget |
| Error surface | Upstream errors name the deployment and its quota state |

**Rejected.** *Direct browser → Azure* — the key would be visible in devtools
to every visitor.

*Implemented by:* `backend/azure_client.py`, `backend/app.py`

---

## ADR-003 — Stateless server; the client carries the history

**Context.** The model has no memory between calls, so context must be
supplied on every request.

**Decision.** The client sends `history` with each request. The server trims
it to `MAX_HISTORY_TURNS` (10) before forwarding.

**Consequences.** No session store, no sticky sessions, horizontally scalable
by default. A page refresh loses the conversation. The client *proposes*
context; the server *decides* what to spend.

**Rejected.** *Server-side session store* — correct once conversations must
persist, but it introduces infrastructure this scope does not need.

*Implemented by:* `backend/azure_client.py`, `frontend/src/hooks/useChat.ts`

---

## ADR-004 — Pydantic v2 as a standalone dependency

**Context.** Flask has no built-in request validation. `request.get_json()`
returns whatever arrived.

**Decision.** Validate the payload at the boundary with a Pydantic model.

**Consequences.** The API contract lives in one file, in code rather than
prose. Notably, `role: Literal["user", "assistant"]` rejects a client trying
to inject a `system` turn that would otherwise land in the message array and
override the system prompt — a prompt-injection defence expressed as a type.

**Rejected.** *Manual `if` checks* — they drift out of sync with the contract.
*Marshmallow* — equivalent, but Pydantic is the default in the Azure OpenAI
Python ecosystem.

*Implemented by:* `backend/schemas.py`

---

## ADR-005 — No database

**Context.** The scope is question in, answer out.

**Decision.** No persistence layer.

**Consequences.** Nothing to migrate, back up, or secure at rest. No analytics
on past conversations. No ERD, because there are no entities to draw.

**Revisit when.** Conversations must survive a refresh, or answers must be
grounded on stored documents.

---

## ADR-006 — Whole responses, not streaming

**Context.** The deployment supports token streaming.

**Decision.** Return the completed response.

**Consequences.** Simpler contract and error handling. Perceived latency is
worse on long answers; the "Thinking…" state and the live trace mitigate it.

**Revisit when.** Answers routinely exceed a few sentences — streaming is the
first improvement I would make.

---

## ADR-007 — Surfacing the request trace in the interface

**Context.** The brief asks for evidence of thinking about data and control
flow.

**Decision.** Render each stage of the pipeline with live status and real
timings.

**Consequences.** Every number shown is measured, never simulated:

| Stage | Source of its timing |
|---|---|
| validate | `performance.now()` delta, client |
| POST /query | round trip **minus** the server-reported Azure time |
| chat completion | `latency_ms` reported by the backend |
| render | `performance.now()` delta, client |

Showing invented durations in a panel labelled "request trace" would not
survive questioning, so the panel reports only what was measured.

*Implemented by:* `frontend/src/components/organisms/TracePanel.tsx`,
`frontend/src/hooks/useChat.ts`

---

## ADR-008 — Report the model Azure returns, not the deployment name

**Context.** The deployment is named `gpt-3` and the brief describes it as
`gpt-35-turbo`. Azure's own response reports `gpt-4.1-mini-2025-04-14`.

**Decision.** `AzureClient.complete()` returns a `Completion` carrying both
the answer and `response.model`. The API returns `model` (what ran) alongside
`deployment` (the configured label), and the UI shows the former.

**Consequences.** The interface cannot drift from reality as deployments are
repointed. A deployment name is an arbitrary label, not a fact about the model
behind it.

**Rejected.** *Echoing the configured deployment name* — the original
behaviour, which reported `gpt-3` and was simply wrong.

*Implemented by:* `backend/azure_client.py`, `backend/app.py`

---

## ADR-009 — Atomic Design in strict TypeScript on the frontend

**Context.** The prototype was a single 485-line component with inline styles.

**Decision.** Decompose into quarks → atoms → molecules → organisms →
templates → pages, with imports flowing only upward, in strict TypeScript.
All state lives in `useChat`; components below it are pure.

**Consequences.** Types make the level boundaries enforceable rather than a
folder convention, and `types/chat.ts` mirrors `schemas.py` so one contract is
checked at both ends of the wire. More files to navigate. Vite does not
typecheck, so `npm run typecheck` is a separate step.

**Rejected.** *Keeping one component* — faster to ship, but state, layout,
styling and transport would stay entangled and untestable.

---

## ADR-010 — Theming through CSS custom properties

**Context.** The interface needs a light and a dark theme.

**Decision.** Token values live as CSS custom properties in `index.css`; the
quarks export `var(--ca-*)` references.

**Consequences.** A theme swap changes values underneath every atom with no
component aware that a theme exists, and the system preference is honoured
without JavaScript. Token values are no longer visible to TypeScript, so a
typo in a variable name fails silently at runtime rather than at compile time.

**Rejected.** *Branching on a theme object in JS* — every styled component
would need the current theme threaded through it.

*Implemented by:* `frontend/src/index.css`, `frontend/src/quarks/colors.ts`
