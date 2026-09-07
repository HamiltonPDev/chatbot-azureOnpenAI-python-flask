# ORCHESTRATOR BRIEF — Sherpa Digital Assignment

> **Historical planning artifact.** This document was written before the code existed, to steer the build. Its deadlines have passed, and it describes the pre-refactor frontend (a single `ChatApp.jsx` split into `ChatWindow` / `Message` / `Composer` / `TracePanel`) — the shipped app is a full TypeScript rewrite organised by Atomic Design instead. Kept below as a record of the working process, not as current documentation. For what the system actually is today, see `ARCHITECTURE.md` and `CODE_WALKTHROUGH.md`.

## Context

This is a technical assignment for a **Dev Intern position at Sherpa Digital** (Amsterdam, ~24 people, AI agency building Flask services on Azure for Dutch family businesses). Deadline: **Monday 31 August**. A face-to-face presentation follows on **3 or 4 September**.

The recruiter's instruction, verbatim:

> *"Please focus on thinking along lines of design, data/control flow and try to show thought process even if you don't reach the end goal. Feel free to take help from co-pilot/GPT."*

The reasoning is being assessed more than the finished product. Architecture and documentation already exist and were written before any code — they are the primary deliverable, and the code is evidence supporting them.

---

## The constraint that shapes everything

**I do not know Python.** I know TypeScript, React, and Next.js well. I am learning Python *while* building this, and I will have to defend every line of the codebase in a live interview eight days from now.

This means your job is not to produce working code quickly. **Your job is to make sure I understand what gets shipped.** Code I cannot explain is worse than no code — it fails the actual evaluation.

Assume I will be asked, out loud, with no notes: *"Why is the Azure client in a separate file?"* If I cannot answer, we failed regardless of whether the app runs.

---

## Working protocol — follow this strictly

**One file at a time.** Never write two source files in a single turn.

For each file, in this order:

1. **Explain first.** Before writing anything, tell me what this file is responsible for, what it does *not* do, and which architectural decision it implements. Reference the relevant ADR.
2. **Write it,** with comments on the non-obvious lines only. Do not comment the obvious.
3. **Walk it back.** For each meaningful line or block: what it does, and *why it is this way rather than the alternative*. Where Python differs from TypeScript, say so explicitly and map it to what I already know.
4. **Check comprehension.** Ask me two or three questions about what you just wrote. Wait for my answers. If an answer is wrong or vague, re-explain that part differently before moving on.
5. **Only then** proceed to the next file.

If I say "just build it" or try to skip ahead, remind me why we are working this way and continue the protocol. That instruction is deliberate and stands for the whole project.

**Additional rules:**

- Prefer boring, readable code over clever code. I have to explain it.
- No abstraction that is not needed today. No premature helper layers.
- When there is a genuine choice, present the alternative and why it lost. Those become interview answers.
- If something I ask for contradicts the architecture documents, say so rather than silently complying.
- Never modify a file we already agreed on without telling me what changed and why.

---

## Provided materials

| File | Role |
|---|---|
| `InternshipUseCase.pdf` | The assignment as issued. The literal requirements. |
| `ARCHITECTURE.md` | The system as designed — tiers, data flow, control flow, API contract, security. **The code must match this.** |
| `DIAGRAMS_AND_DECISIONS.md` | Container, sequence, state machine, component tree, deployment diagrams, plus seven ADRs. |
| `DESIGN_LOG.md` | The reasoning: how the brief was read, assumptions, forks, what was deliberately not built, how AI tooling was used. |
| `CODE_WALKTHROUGH.md` | My study guide — contains the intended backend code and line-by-line explanations. Use it as the reference implementation and teach against it. |
| `PRESENTATION_PREP.md` | Interview prep. Informs what I must be able to explain. |
| `ChatApp.jsx` | Working frontend prototype with mocked responses. Starting point, needs the changes below. |

**Read all of these before writing any code.** If the code and the documents diverge, the documents are the source of truth — or you flag the conflict and we decide together.

---

## Stack — non-negotiable

```
Backend    Flask + Pydantic v2 + openai (Azure) + python-dotenv + flask-cors
Frontend   React (Vite), plain CSS or inline styles — no UI framework
Model      Azure OpenAI, deployment name "gpt-3" (gpt-35-turbo)
```

**Flask, not FastAPI.** The job posting specifies Flask three times. This is a deliberate decision documented in ADR-001 — the technical merits of FastAPI were considered and the team's stack won. Do not propose switching.

Pydantic v2 is used standalone with Flask to keep request validation declarative.

---

## Build order

**1 · Backend, file by file**
- `schemas.py` — Pydantic models, the API contract
- `azure_client.py` — the only module that talks to Azure; isolated for testability
- `app.py` — Flask app, `/query` and `/health`, validation and error handling
- `requirements.txt`, `.env.example`

Verify with `curl` before touching the frontend: happy path, empty input (expect 400 with "Please ask a question!"), malformed JSON.

**2 · Frontend — adapt the existing prototype**
- Replace the mocked `mockQuery` with a real `fetch` to `/query`
- Split the monolith into `ChatWindow`, `Message`, `Composer`, `TracePanel` per the component tree in the diagrams document
- Isolate the endpoint in `api.js` — the URL appears exactly once in the codebase
- Add `AbortController` with a 30-second timeout
- Drive the trace panel from real timings, not simulated stages
- Keep both bonus features: Clear button, "Thinking…" state

**3 · Integration**
- End-to-end flow working
- Every error path verified by actually triggering it: stop the backend, send an empty message, force a bad key

**4 · README**
- Setup, run, and test instructions someone else can follow on a clean machine
- Links to the four architecture documents

**5 · Phase two — only if time remains**
Do not start this until everything above is finished and documented. RAG grounding on Casa Brunelli property documents (a private estate near Volterra, Tuscany): chunk, embed, retrieve top-k, inject as context. Multilingual — guests write in English, Italian, Dutch, Spanish. This is described in `ARCHITECTURE.md` §9.

---

## Teaching priorities

Where I need the most explanation, in order:

1. **Python syntax and idioms** mapped to TypeScript — decorators, slices, dicts vs objects, `None`, indentation as syntax, virtual environments
2. **How Flask works** — routing, the request object, JSON serialisation, why the app object is module-level
3. **Pydantic** — how it compares to zod, what `model_validate` does, what happens on failure
4. **The Azure OpenAI SDK** — message list construction, why the system prompt comes first, what a completion object contains
5. **Error handling in Python** — try/except/raise, custom exception classes, why we wrap the SDK's exception in our own

Where I need less: React fundamentals, state management, component structure. Still explain anything non-obvious, but do not teach me `useState`.

---

## Security requirements

These are also interview answers, so explain the reasoning as you implement:

- API key in `.env`, loaded with `python-dotenv`, **never** in the frontend
- `.env` in `.gitignore`; `.env.example` committed with empty values
- CORS restricted to the frontend origin — never `*`
- Input capped at 1000 characters
- History trimmed server-side, regardless of what the client sends
- `Literal["user", "assistant"]` on message roles — a client must not be able to inject a `system` role
- Upstream exceptions logged in full, generic message returned to the client — no stack traces in HTTP responses

Before we finish, verify no secret is committed anywhere in the repo or its history.

---

## Definition of done

- [ ] Backend runs, all three `curl` cases behave correctly
- [ ] Frontend talks to the real backend end to end
- [ ] Every error path triggered and observed, not just written
- [ ] Both bonus features working
- [ ] README lets a stranger run it on a clean machine
- [ ] Code matches `ARCHITECTURE.md`, or divergences are documented
- [ ] No secrets in the repository
- [ ] **I can answer all eighteen self-test questions in `CODE_WALKTHROUGH.md` Part 4 without notes**

The last item is the real definition of done. If everything else is green and that one is not, we are not finished.

---

## What not to do

- Do not write the whole backend in one turn
- Do not add features beyond the brief — no file upload, no model selector, no markdown rendering
- Do not refactor working code because a cleaner pattern exists
- Do not switch frameworks or add dependencies without saying why
- Do not skip the comprehension checks, even when I sound impatient

---

## Start here

Read the provided documents. Then, before writing any code:

1. Confirm your understanding of the architecture in a short summary
2. Flag anything in the documents that is unclear or that you would build differently
3. Propose the first file and explain it — then wait for me
