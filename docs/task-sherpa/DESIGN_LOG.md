# Design Log — Thought Process

**Author:** Hamilton
**Assignment:** Sherpa Digital — chatbot with React, Python, Azure OpenAI

`ARCHITECTURE.md` describes the system. `DIAGRAMS_AND_DECISIONS.md` shows its structure and the decisions taken. This document is the reasoning that produced both — including the forks where I hesitated, the things I chose not to build, and the questions still open.

---

## 1. How I read the brief

The literal requirements are modest: an input, a Send button, a response area, a Python endpoint, a call to Azure OpenAI, and a guard for empty input. A working version of that is an afternoon's work.

But the instruction that came with it reframes the exercise:

> *"Focus on thinking along lines of design, data/control flow and try to show thought process even if you don't reach the end goal."*

So I read the brief as having two layers:

| Layer | What is asked | How it is judged |
|---|---|---|
| Surface | A chatbot that returns an answer | Does it run? |
| Actual | Evidence of engineering judgement | Would I want this person designing our services? |

The second layer is the one worth optimising for. A polished chatbot with no visible reasoning answers the wrong question; a well-reasoned system with a rough edge answers the right one. Where the two competed, I spent the time on reasoning.

**One consequence:** I did not chase features. A file-upload, voice input, or model selector would have added surface without adding evidence of thinking.

---

## 2. What I assumed, and what I would ask

The brief leaves gaps. Rather than invent answers silently, here is what I assumed and what I would put to a product owner on day one — this is the habit the role description calls "translate user stories into technical specifications."

| Open question | My assumption | Why it matters |
|---|---|---|
| Single-user demo, or something facing real users? | Demo, single user | Determines whether auth, persistence, and quotas are in scope |
| Should conversations survive a refresh? | No | Decides whether a session store and a database exist at all |
| Is the assistant general-purpose, or domain-scoped? | General for the base version | A scoped assistant needs grounding, which changes the pipeline shape |
| Expected answer length? | Short — a few sentences | Drives the streaming decision (ADR-006) |
| Who pays for tokens, and what is the ceiling? | Unbounded for a demo | Drives the input cap and history trimming; rate limiting was considered here but never built — see §5 |
| Which languages? | English | Multilingual changes prompt design and evaluation |

Every one of these would change the architecture. Stating them makes the design falsifiable: if an assumption is wrong, the reader knows exactly which decision to revisit.

---

## 3. Framing the problem

Stripped of framework names, the system does four things:

1. Take untrusted text from a human
2. Move it across a trust boundary
3. Hand it to a slow, non-deterministic, metered external service
4. Return the result without ever leaving the interface stuck

Framing it this way made the priorities obvious before I chose any library. Points 2 and 4 are where the engineering lives. Point 3 is the one I do not control — the model may be slow, may fail, may return something unexpected — and a design that only works when the third party behaves is not a design.

That framing produced the two rules I applied consistently: **the key never crosses the boundary**, and **every path returns the UI to a usable state**.

---

## 4. The forks

Where I actually hesitated, and how I resolved it.

### Fork 1 — Does the backend earn its place?

The browser can call Azure OpenAI directly. That is one less service to run.

I dismissed it in about thirty seconds, but the reasoning is worth stating: the API key would sit in the client bundle, readable by anyone who opens devtools. This is not a subtle risk, it is the first thing an attacker looks for. The backend is a trust boundary.

The part that took longer to appreciate: the boundary keeps paying off after security. The system prompt and the history trimming both now change without a frontend release. What began as a security requirement turned out to be the right seam anyway.

### Fork 2 — Flask or FastAPI

My first instinct was FastAPI: validation and generated docs come free, and async fits an I/O-bound call to a model.

Then I read the role description again. Sherpa builds Flask services — it says so three times. Submitting FastAPI would mean handing the team something in a stack they did not ask for, on an exercise about fitting into how they work.

So: Flask, and then add back the two things FastAPI would have given me. Pydantic v2 works standalone, so validation stays declarative and the contract lives in one file. The generated docs I traded away consciously; for a single endpoint, the README covers it.

I want to be clear that this is not "Flask is better." It is that framework choice is a team decision before it is a technical one, and the technical gap was closable.

### Fork 3 — Where does conversation history live?

Two options. The server keeps a session per user, or the client sends the history with every request.

Server-side sessions feel more "correct" at first — the server owns the truth. But it introduces state, which introduces sticky sessions or a shared store, which introduces infrastructure that this system has no other reason to need.

Client-sends-history keeps the server stateless and horizontally scalable. The cost is real: a refresh loses the conversation, and the client can send whatever it likes. The second problem is the more serious one, so history is **trimmed and validated server-side** — the client proposes context, the server decides what to forward. That way statelessness does not become "the client controls token spend."

### Fork 4 — What to build beyond the brief

The brief is small enough that finishing it leaves room. The temptation is to add features. I asked instead: what single addition would produce *evidence of the thing being evaluated*?

The answer was the trace panel — each stage of the request, with live status and real timings. It makes the data flow observable in the running application rather than only described in a document. It is also genuinely useful: when an answer is slow, you can see whether the time went to the network or the model.

I considered and rejected: conversation export (no evidence value), model temperature controls (settings, not architecture), and markdown rendering (polish, and it invites an XSS conversation I would rather have deliberately than accidentally).

---

## 5. What I deliberately did not build

Listing these is part of the design, not an apology.

| Not built | Why | When it becomes necessary |
|---|---|---|
| Database | Nothing in scope needs to persist | Conversations must survive a refresh, or answers must be grounded on documents |
| Authentication | Single-user demo | Anything reachable from the internet |
| Streaming | Simpler contract; answers are short | Answers routinely exceed a few sentences |
| Retry with backoff | Hides upstream problems during a demo | Production, where transient 429s from Azure are normal |
| State management library | One `useChat` hook owns all state; the atomic component tree below it is pure and reads it as props | The state itself, not just the tree, needs to be shared outside the hook's lifetime |
| Token-aware history summarisation | Last-N trimming is enough for short sessions | Long conversations begin hitting the context window |
| Rate limiting | Out of scope for a single-user demo; would need real infrastructure (a shared store, not a per-process counter) to mean anything | Anything reachable from the internet |

The pattern: each of these is a real requirement in some other version of this system. None is a requirement in this one.

---

## 6. How I used AI tooling

The brief invites it, and given what Sherpa builds, being precise about *how* seems more useful than being quiet about it.

**Where it helped:** boilerplate I have written before and do not need to write again — the Azure OpenAI client wrapper, Pydantic model definitions, Mermaid syntax. Also as a reviewer: asking it to attack my own error handling surfaced the double-submit case in §4, which I had not guarded.

**Where I did not take the output:** the first suggestions for the backend were a single `app.py` with the Azure call inline and the key read at module scope. That works and it is what most examples look like. It also makes the endpoint untestable without a live Azure call, which is why `azure_client.py` is a separate module.

Similarly, generated error handling defaulted to returning the exception message to the client. That is an information leak. The detail goes to the log; the client gets a generic message.

**What I verified myself:** anything touching the trust boundary, the error paths, and the API contract. A generated snippet that is 90% right is a liability at exactly the 10% where a key leaks.

**The honest summary:** it made me faster at the parts I already understood and was actively unhelpful at the parts requiring judgement about *this* system's constraints. Which is roughly what I would expect, and the reason the reasoning in this document is mine rather than prompted.

---

## 7. Risks and open questions

Things I am not certain about, stated rather than hidden:

- **Latency is unknown to me.** I have not benchmarked the deployment under load. If p95 sits above two seconds, ADR-006 flips and streaming stops being optional.
- **History trimming is naive.** Last-N turns is a proxy for token budget, not a measurement. A long turn can still overflow the window. The client also sends the entire transcript on every request — only the server-side trim bounds it, so payload size grows unbounded on long conversations.
- **No evaluation of answer quality.** The system returns whatever the model produces. For a general assistant that is acceptable; for anything domain-specific it is not, which is the real argument for grounding.
- **There is no rate limiting**, and CORS is not a substitute for one — it stops a browser, not a `curl` request. This is a real gap for anything internet-facing, stated rather than hidden.
- **CORS is configured for a known frontend origin.** If the frontend is deployed somewhere I have not anticipated, this is the first thing that breaks — deliberately, but noisily.
- **The deployment is labelled `gpt-3` but Azure reports back `gpt-4.1-mini-2025-04-14`.** The label was never accurate; the app now surfaces both the label and the reported model rather than trusting the name (ADR-008).

---

## 8. Requirements traceability

Mapping each stated requirement and evaluation criterion to where it is satisfied.

| Requirement | Where |
|---|---|
| Input box for questions | `Composer` (molecule), driven by `useChat` |
| Send button | `Composer` |
| Response area | `MessageList` (organism) + `MessageBubble` (molecule) |
| React state for input and responses | `useState` inside the `useChat` hook |
| Python API with `/query` | `app.py` |
| Azure OpenAI connection | `azure_client.py` |
| Keys via environment variables | `.env` + `.env.example`, §6 of `ARCHITECTURE.md` |
| Empty input returns "Please ask a question!" | Guarded client-side and server-side (§3 control flow) |
| End-to-end test from frontend to Azure | README, with recording |
| README documenting the code | `README.md` |
| **Bonus:** clear conversation history | `Clear` button in `ChatHeader`, wired to `useChat.clear` |
| **Bonus:** "Thinking..." while loading | `isThinking` state in `useChat`, rendered by `ThinkingBubble` |

| Evaluation criterion | Evidence |
|---|---|
| Basic functionality | Working end-to-end flow |
| React basics | State ownership, controlled input, conditional rendering, component split |
| Python basics | Endpoint, validation at the boundary, isolated Azure client, error handling |
| Instructions | README with setup, run, and test steps |
| **Design / data flow / control flow** | `ARCHITECTURE.md` §2–3, sequence diagram and state machine, this log |

---

## 9. What testing actually got built

This was originally listed under "with another week" as future work. It happened during the build instead: `backend/check_schemas.py`, `check_azure_client.py` and `check_app.py` are hand-rolled, network-free self-check scripts — no pytest or unittest, a small `check()` helper that prints `OK`/`FAIL` and exits non-zero on failure — covering roughly 48 assertions: Pydantic validation (including rejecting an injected `system` role), message assembly and history trimming against a fake Azure client, and every `/query` and `/health` behaviour, including both success paths, all four 400 rejections, malformed JSON, the 502 with an explicit assertion that upstream error text never leaks, and CORS headers for both an allowed and a foreign origin. `check_azure.py` is a separate live smoke test against real Azure, run manually because it spends quota. None of these are wired into CI — there is no `.github/workflows` — so "tested" here means "runnable on demand," not "gated."

## 10. With another week

In priority order, and the reason for the order:

1. **Streaming** — the largest perceived-quality gain per hour spent
2. **Grounding on real documents** — turns a chatbot into something that can be trusted about a specific subject; this is where the ERD in §6 of the diagrams document starts to exist
3. **CI for the check\_\*.py suite** — the assertions exist; nothing runs them automatically yet
4. **Managed Identity instead of a key** — removes the credential from the application entirely
5. **Telemetry** — latency and failure rates in App Insights, because the timings I show in the UI should also be queryable

Notably, none of these is a feature. All five are about the system being correct, trustworthy, or observable — which is where I would spend the time.
