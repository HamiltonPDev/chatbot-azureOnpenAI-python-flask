# Weekend Plan — Friday 19:20 → Monday

> **Historical planning artifact.** This document was written before the build weekend, to schedule it. Its deadlines have passed, and it describes the pre-refactor frontend (a single `ChatApp.jsx` split into `ChatWindow` / `Message` / `Composer` / `TracePanel`) — the shipped app is a full TypeScript rewrite organised by Atomic Design instead. Kept below as a record of the working process, not as current documentation. For what the system actually is today, see `ARCHITECTURE.md` and `CODE_WALKTHROUGH.md`.

## Reality check

What is left is smaller than it feels:

| Piece | Status | Remaining |
|---|---|---|
| Architecture docs | ✅ Done | — |
| Diagrams + ADRs | ✅ Done | — |
| Design log | ✅ Done | — |
| Frontend prototype | ✅ Working (mocked) | Refactor + wire to real API |
| Backend | ❌ Not started | ~120 lines across 3 files |
| README | ❌ Not started | ~1 hour |
| Recording | ❌ Not started | ~30 min |
| Being able to explain it | ⚠️ In progress | The real work |

The backend is genuinely small. The danger this weekend is not running out of time — it is scope creep, over-polishing, or starting phase two.

**Target: finished Sunday evening. Monday is buffer, not build time.**

---

## Course strategy — surgical, not sequential

You have roughly 20 productive hours across Saturday and Sunday. The four Platzi courses you listed total well over 40 hours. Attempting them means finishing neither the learning nor the project.

Courses teach *broadly and in order*. This weekend needs *narrow and just-in-time*. So: watch only the classes whose concepts appear literally in your code, at 1.5× speed, and skip everything else without guilt.

### Saturday morning — Python, only these 10 classes (~90 min at 1.5×)

From **Curso de Fundamentos de Python**:

| # | Class | Why you need it |
|---|---|---|
| 5 | Sintaxis e indentación | Indentation is syntax in Python, not style |
| 7 | Variables: reglas y convenciones | `UPPER_CASE` constants, `_private` convention |
| 9 | Tipos de datos | Foundation for the Pydantic models |
| 12 | Slicing, replace y split | **`history[-10:]` in `azure_client.py` is a slice** |
| 14 | `None` no es cero ni vacío | `os.getenv()` returns `None` — the reason we use `os.environ[...]` |
| 22 | Métodos de listas | Building the `messages` list |
| 25 | Diccionarios | **Every message is a dict — the core data structure of the whole app** |
| 26 | Funciones | Every endpoint is a function |
| 28 | Cómo usar módulos | How your three backend files import each other |
| 29 | try, except, finally | **The entire error-handling strategy** |

**Skip:** Windows installation, comments, multiple assignment, arithmetic and logical operators, conditionals, `match`, `while`, `for`, tuples, sets, lambdas, file reading, and the coffee-machine project. You either know them from TypeScript or they do not appear in this codebase.

### Skip entirely this weekend

- **Curso de Flask** — see below; you learn Flask by building it, then optionally reinforce
- **Curso de Backend** — conceptual and broad; your own `ARCHITECTURE.md` covers this system better than a general course
- **Ruta de React** — a full route is days of content. Use the seven-concept active review instead (Saturday afternoon)

### Sunday evening — Flask course, only if you are ahead

If the app works end to end by Sunday afternoon, the Flask course becomes *reinforcement rather than prerequisite* — and concepts land far better after you have built with them. Watch the routing and request/response sections only. If you are behind, skip it; nothing in your submission depends on it.

### After Monday

This is when the full courses pay off. If the internship starts 1 October, you have September: the React route, the Flask course in full, and the backend course. Do them properly then, not compressed now.

---

## Friday night (now → ~22:00)

Low-stakes setup. Do not start writing application code tired.

- [ ] Create the repo, `backend/` and `frontend/` folders
- [ ] Python virtual environment created and **activated** — confirm `which python` points inside `venv/`
- [ ] `pip install flask flask-cors pydantic openai python-dotenv`
- [ ] `.env` created with the Azure values, `.gitignore` containing `.env` and `venv/`
- [ ] Confirm the Azure key works — a five-line throwaway script that calls the deployment and prints the answer. **Do this tonight.** If the key or endpoint is wrong, you want to know now, not Sunday.
- [ ] Paste `ORCHESTRATOR_BRIEF.md` plus all documents into Claude Code, let it read everything and summarise its understanding

Stop there. Sleep.

---

## Saturday — backend day

**06:00–07:30 · Python, the ten classes**
The surgical list above, at 1.5×. Two pomodoros with a break between. Do not take notes on syntax you already know from TypeScript — note only what surprises you.

**07:30–09:00 · Read your own walkthrough**
`CODE_WALKTHROUGH.md` Part 1 (the TypeScript→Python mapping) and Part 2 completely. This is where the course concepts get attached to *your* code. Do not write anything yet — you are building the mental model you will follow along with.

**10:30–13:00 · Backend, file by file**
With Claude Code, following the protocol — explain, write, walk back, comprehension check.

1. `schemas.py` — the contract
2. `azure_client.py` — the isolated Azure wrapper
3. `app.py` — the endpoint

Budget roughly 45 minutes per file including the explanation. If a file takes more than an hour, something is over-engineered — simplify.

**13:00–14:00 · Break, away from the screen**

**14:00–15:00 · Verify the backend alone**
Three `curl` calls before the frontend exists:
- Valid question → 200 with an answer
- `{"question":""}` → 400 "Please ask a question!"
- Malformed JSON → 400

Then stop the app and confirm it fails cleanly. **Testing the backend independently is a habit worth mentioning in the interview.**

**15:00–17:00 · React review — active, not passive**
Only these seven things, all present in your app:

| Concept | Where it lives in ChatApp |
|---|---|
| Controlled input | `value={input}` + `onChange` |
| Immutable state updates | `setMessages(m => [...m, x])` |
| Lifting state up | Why state sits in `App`, not children |
| Props | What each child component receives |
| `useEffect` + dependencies | Autoscroll on `[messages, isThinking]` |
| `useRef` | Scroll container and input element |
| async in handlers | `try / catch / finally` around the fetch |

For each: find it in the code, change it, break it deliberately, watch what happens. Twenty minutes each beats any video.

**17:00–19:00 · Split the prototype into components**
`ChatWindow`, `Message`, `Composer`, `TracePanel`, plus `api.js`. This refactor *is* the React lesson — you cannot do it without understanding props and state ownership.

**Evening · Optional, low energy**
Read `PRESENTATION_PREP.md` once. No action needed yet.

---

## Sunday — integration and ownership

**09:00–11:00 · Wire frontend to backend**
- Replace `mockQuery` with the real fetch in `api.js`
- `AbortController` with a 30-second timeout
- Trace panel driven by real timings
- First end-to-end message working

**11:00–12:00 · Break every error path deliberately**
Not "write the handler" — actually trigger it and watch:
- Stop the backend mid-session → error surfaces, spinner stops, UI still usable
- Send empty input → no network call
- Temporarily corrupt the key → 502, generic message, full detail in the terminal

**This hour produces your best demo moment.** Do not skip it.

**12:00–13:00 · README**
Setup, run, test. Assume a stranger on a clean machine. Link the four documents.

**13:00–14:00 · Break**

**14:00–15:00 · Buffer**
Whatever slipped. If nothing slipped, tidy the code you will be showing on screen — the reviewer reads it, and so will you on Thursday.

**15:00–16:00 · First pass at the self-test**
`CODE_WALKTHROUGH.md` Part 4 — go through the eighteen questions once, out loud. You are not aiming to nail all of them tonight; you are finding out which ones are shaky so you know what to work on Tuesday. The deep pass happens 1–3 September, not now.

**16:00–17:00 · Recording or screenshots**
Five minutes of screen capture, or four to five well-chosen screenshots: normal question with the trace, empty input, backend stopped, Clear. Follow the demo script in `PRESENTATION_PREP.md` §4. The assignment accepts either.

**17:00–18:00 · Package**
- [ ] Zip: code, README, the four documents, the recording
- [ ] **`.env` is not in the zip.** `.env.example` is.
- [ ] `git log` clean, no secrets in history
- [ ] Clone the zip to a fresh folder and follow your own README. If it does not run, fix the README, not your memory of it.

---

## Monday 31 — submit

Buffer only. Reread the docs once, send it. Do not add anything.

**The three required deliverables** (from the assignment, section 4):
- [ ] Short README documenting the code and how to set up and test it
- [ ] Snippets or video of the app running — screenshots are explicitly acceptable
- [ ] Code files in a zip folder

Your four architecture documents are *extra*. They are the differentiator, but keep the README itself short and practical, and link out to them.

---

## 1–3 September — own it

The presentation is **4 September**, which means the weekend only has to produce a finished, understood project — not a rehearsed one. Three evenings is plenty for the rest.

**Monday evening**
Read `CODE_WALKTHROUGH.md` end to end, now that the code exists and you have written it. It reads differently once every file is real.

**Tuesday**
- The eighteen self-test questions, out loud, in English, no notes
- Anything shaky: reread that section, try again the next day
- Say the thirty-second data flow three times

**Wednesday**
- Read `PRESENTATION_PREP.md` fully
- Rehearse the demo script — all five moments, including stopping the backend
- Work through the question drill in `PRESENTATION_PREP.md` §8, answering out loud in English
- Prepare the two questions you will ask them

**Thursday morning, before the session**
- Backend running, terminal visible
- Azure key confirmed working that morning
- Diagrams open in a second tab
- Say the data flow once more

Everything is in English: the documents, the README, the presentation, and the practice. Rehearsing out loud in English matters more than rereading — the interview tests whether you can explain, not whether you know.

---

## If you fall behind — cut in this order

1. **Phase two (Casa Brunelli RAG)** — already out of scope, keep it there
2. **The trace panel timings** — fall back to simpler stage indicators
3. **Component splitting** — a single `ChatApp.jsx` is acceptable if you can explain why you would split it
4. **The recording** — a few screenshots satisfy the brief

**Never cut:** the backend working, the error paths, the README, or the self-test.

Anneke wrote *"even if you don't reach the end goal."* A slightly rough app with airtight reasoning beats a polished app you cannot explain. If Sunday afternoon arrives and something is unfinished, write two honest paragraphs about what you would have done and why — that is a stronger answer than a rushed feature.

---

## Rules for the weekend

- **One thing at a time.** No refactoring while debugging, no reading docs while coding.
- **Timebox the comprehension checks to five minutes each.** If a concept is not landing, note it and move on — return in the Sunday self-test rather than stalling Saturday.
- **When Claude Code offers an improvement that is not in the plan, say no.** Every "quick addition" costs an hour you do not have.
- **Say the data flow out loud once per day.** Thirty seconds, Saturday and Sunday. By Monday it is automatic.
- **Sleep both nights.** The interview is a conversation, not a code review — being sharp on 3 September matters more than one extra feature.

---

## Tell the orchestrator this on Saturday morning

> Timeline note: I have from Saturday morning to Sunday evening. Keep the teaching protocol, but timebox each comprehension check to about five minutes — if I do not understand something, note it for later review rather than stopping progress. Priority order: working backend, then error paths, then integration, then README. Phase two is out of scope. If I propose something not in the build order, remind me of the deadline.
