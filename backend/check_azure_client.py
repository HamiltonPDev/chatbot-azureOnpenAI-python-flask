"""Self-check for azure_client.py — no network, no Azure calls, no cost.

    ./venv/bin/python check_azure_client.py

It replaces the Azure SDK with a fake that records the messages it was
handed, so we can assert what WOULD have been sent.
"""

import os

os.environ.setdefault("AZURE_OPENAI_DEPLOYMENT", "fake-deployment")
os.environ.setdefault("AZURE_OPENAI_KEY", "fake-key")
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://fake.openai.azure.com/")
os.environ.setdefault("AZURE_OPENAI_API_VERSION", "2024-02-01")

import azure_client as mod
from schemas import Message

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


class _FakeCompletions:
    def __init__(self, recorder):
        self._recorder = recorder

    def create(self, model, messages, timeout):
        self._recorder["messages"] = messages
        self._recorder["model"] = model
        self._recorder["timeout"] = timeout

        class _Msg:
            content = "fake answer"

        class _Choice:
            message = _Msg()

        class _Response:
            choices = [_Choice()]
            model = "gpt-4.1-mini-2025-04-14"

        return _Response()


def build_client():
    recorder = {}
    client = mod.AzureClient.__new__(mod.AzureClient)
    client.model_name = "fake-deployment"
    client._client = type(
        "FakeSDK", (), {"chat": type("Chat", (), {"completions": _FakeCompletions(recorder)})()}
    )()
    return client, recorder


# --- the cap itself -------------------------------------------------------
cap = mod.MAX_HISTORY_TURNS
check("MAX_HISTORY_TURNS is a number, not a placeholder", isinstance(cap, int), repr(cap))

if not isinstance(cap, int):
    print(f"\n{PASSED} passed, {FAILED} failed")
    raise SystemExit(1)

check("MAX_HISTORY_TURNS is positive", cap > 0, repr(cap))
check("MAX_HISTORY_TURNS is a sane cap (2..50)", 2 <= cap <= 50, repr(cap))

# --- message assembly -----------------------------------------------------
client, rec = build_client()
answer = client.complete("what now?", [])

check("returns the model's answer text", answer.answer == "fake answer", repr(answer))
check(
    "reports the model Azure actually ran, not the deployment name",
    answer.model == "gpt-4.1-mini-2025-04-14",
    repr(answer.model),
)
check("first message is the system prompt", rec["messages"][0]["role"] == "system")
check(
    "system prompt content matches SYSTEM_PROMPT",
    rec["messages"][0]["content"] == mod.SYSTEM_PROMPT,
)
check("no history means exactly system + question", len(rec["messages"]) == 2)
check("last message is the user's question", rec["messages"][-1] == {"role": "user", "content": "what now?"})
check("timeout is passed to the SDK", rec["timeout"] == 30)

# --- history is forwarded, as plain dicts ---------------------------------
client, rec = build_client()
history = [Message(role="user", content="hi"), Message(role="assistant", content="hey")]
client.complete("and then?", history)

check("history is forwarded", len(rec["messages"]) == 4, f'got {len(rec["messages"])}')
check(
    "history items became plain dicts",
    all(isinstance(m, dict) for m in rec["messages"]),
    str([type(m).__name__ for m in rec["messages"]]),
)
check(
    "history sits between system prompt and question",
    [m["role"] for m in rec["messages"]] == ["system", "user", "assistant", "user"],
    str([m["role"] for m in rec["messages"]]),
)

# --- the cap is actually enforced -----------------------------------------
client, rec = build_client()
long_history = [
    Message(role="user" if i % 2 == 0 else "assistant", content=f"turn {i}")
    for i in range(cap + 10)
]
client.complete("final", long_history)

check(
    f"history longer than the cap is trimmed to {cap}",
    len(rec["messages"]) == cap + 2,
    f'got {len(rec["messages"])} messages for a {len(long_history)}-turn history',
)
check(
    "the turns kept are the MOST RECENT ones",
    rec["messages"][1]["content"] == f"turn {len(long_history) - cap}",
    f'oldest kept is {rec["messages"][1]["content"]!r}',
)
check(
    "kept turns stay in chronological order",
    [m["content"] for m in rec["messages"][1:-1]]
    == [f"turn {i}" for i in range(len(long_history) - cap, len(long_history))],
)

# --- upstream failure is wrapped ------------------------------------------
from openai import OpenAIError

client, rec = build_client()


def _boom(model, messages, timeout):
    raise OpenAIError("upstream exploded: deployment gpt-3 quota exceeded")


client._client.chat.completions.create = _boom

try:
    client.complete("x", [])
    check("upstream failure raises AzureClientError", False, "nothing was raised")
except mod.AzureClientError:
    check("upstream failure raises AzureClientError", True)
except OpenAIError:
    check("upstream failure raises AzureClientError", False, "raw OpenAIError leaked out")

print(f"\n{PASSED} passed, {FAILED} failed")
raise SystemExit(1 if FAILED else 0)
