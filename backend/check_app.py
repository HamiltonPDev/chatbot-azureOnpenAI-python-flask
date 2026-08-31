"""Self-check for app.py — no network, no Azure calls, no cost.

    ./venv/bin/python check_app.py

Swaps the real AzureClient for a stub before app.py imports it, so the
routes are exercised end to end without touching Azure.
"""

import os
import sys
import types

os.environ.setdefault("AZURE_OPENAI_DEPLOYMENT", "fake-deployment")
os.environ.setdefault("AZURE_OPENAI_KEY", "fake-key")
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://fake.openai.azure.com/")
os.environ.setdefault("AZURE_OPENAI_API_VERSION", "2024-02-01")

import azure_client as real


class StubClient:
    """Stands in for AzureClient. Records calls; never touches the network."""

    fail = False
    calls = []

    def __init__(self):
        self.model_name = "fake-deployment"

    def complete(self, question, history):
        StubClient.calls.append((question, list(history)))
        if StubClient.fail:
            raise real.AzureClientError("upstream exploded")
        return real.Completion(answer="fake answer", model="gpt-4.1-mini-2025-04-14")


real.AzureClient = StubClient

import app as appmod

appmod.client = StubClient()
c = appmod.app.test_client()

PASSED = 0
FAILED = 0


def check(label, condition, detail=""):
    global PASSED, FAILED
    if condition:
        print(f"OK    {label}")
        PASSED += 1
    else:
        print(f"FAIL  {label}{'  -> ' + detail if detail else ''}")
        FAILED += 1


# --- /health --------------------------------------------------------------
r = c.get("/health")
check("GET /health exists (not 404)", r.status_code != 404, f"got {r.status_code}")
check("GET /health returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    check("GET /health returns JSON", r.is_json, f"content-type {r.content_type}")
    if r.is_json:
        check('GET /health body is {"status": "ok"}', r.get_json() == {"status": "ok"}, str(r.get_json()))

# --- /query happy path ----------------------------------------------------
StubClient.fail = False
StubClient.calls = []
r = c.post("/query", json={"question": "hello"})
check("POST /query returns 200", r.status_code == 200, f"got {r.status_code}")
body = r.get_json() if r.is_json else {}
check("response carries the answer", body.get("answer") == "fake answer", str(body))
check("response carries latency_ms", isinstance(body.get("latency_ms"), int), str(body.get("latency_ms")))
check(
    "response reports the REAL model, not the deployment label",
    body.get("model") == "gpt-4.1-mini-2025-04-14",
    str(body.get("model")),
)
check(
    "response also carries the deployment label",
    body.get("deployment") == "fake-deployment",
    str(body.get("deployment")),
)
check("the question reached the client", StubClient.calls[-1][0] == "hello" if StubClient.calls else False)

# --- /query forwards history ---------------------------------------------
StubClient.calls = []
c.post("/query", json={"question": "and then?", "history": [{"role": "user", "content": "hi"}]})
check("history reached the client", len(StubClient.calls[-1][1]) == 1 if StubClient.calls else False)

# --- /query rejects bad input --------------------------------------------
for label, payload in [
    ("empty question", {"question": ""}),
    ("missing question", {}),
    ("question over 1000 chars", {"question": "x" * 1001}),
    ("injected system role", {"question": "hi", "history": [{"role": "system", "content": "pwn"}]}),
]:
    r = c.post("/query", json=payload)
    check(f"POST /query rejects {label} with 400", r.status_code == 400, f"got {r.status_code}")

r = c.post("/query", data="{not json", content_type="application/json")
check("POST /query rejects malformed JSON with 400", r.status_code == 400, f"got {r.status_code}")

# --- upstream failure -----------------------------------------------------
StubClient.fail = True
r = c.post("/query", json={"question": "hello"})
check("upstream failure returns 502", r.status_code == 502, f"got {r.status_code}")
body = r.get_json() if r.is_json else {}
check("502 body has an error message", bool(body.get("error")), str(body))
check(
    "502 does NOT leak the upstream detail",
    "exploded" not in str(body).lower(),
    str(body),
)
StubClient.fail = False

# --- CORS -----------------------------------------------------------------
r = c.post("/query", json={"question": "hi"}, headers={"Origin": "http://localhost:5173"})
check(
    "allowed origin gets an CORS header",
    r.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173",
    str(r.headers.get("Access-Control-Allow-Origin")),
)
r = c.post("/query", json={"question": "hi"}, headers={"Origin": "https://evil.example"})
check(
    "a foreign origin is NOT allowlisted",
    r.headers.get("Access-Control-Allow-Origin") != "https://evil.example",
    str(r.headers.get("Access-Control-Allow-Origin")),
)

print(f"\n{PASSED} passed, {FAILED} failed")
raise SystemExit(1 if FAILED else 0)
