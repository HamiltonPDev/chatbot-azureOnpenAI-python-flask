"""The only module that knows Azure OpenAI exists.

Every model call in this service goes through here. Route handlers ask for
an answer and never learn where it came from, so the model, the system
prompt, and the history policy can all change without touching app.py.

Implements ADR-002 (the backend is a trust boundary, not a proxy) and the
server half of ADR-003 (the client carries history; the server trims it).
"""

import os
from dataclasses import dataclass

from openai import AzureOpenAI, OpenAIError

SYSTEM_PROMPT = "You are a helpful assistant. Answer concisely and accurately."

# The client may send an unbounded history; this is the cap that protects
# the token budget. Ten messages is five exchanges of memory.
MAX_HISTORY_TURNS = 10


@dataclass(frozen=True)
class Completion:
    """One answer, plus which model actually produced it.

    The deployment NAME and the MODEL behind it are different things: this
    deployment is named "gpt-3" but Azure reports gpt-4.1-mini. Returning
    the reported model means the UI can show what really ran.
    """

    answer: str
    model: str


class AzureClientError(Exception):
    """Raised when the upstream model call fails, for any reason.

    Deliberately opaque. The caller maps this to a generic 502 so that
    upstream error text — which can leak deployment names, quota details,
    or key state — never reaches the browser.
    """


class AzureClient:
    """A thin, reusable wrapper around one Azure OpenAI deployment."""

    def __init__(self):
        self.model_name = os.environ["AZURE_OPENAI_DEPLOYMENT"]
        self._client = AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        )

    def complete(self, question: str, history: list) -> Completion:
        """Answer one question, given the conversation so far.

        Raises AzureClientError if the upstream call fails.
        """
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Only the most recent turns, oldest kept turn first. The SDK wants
        # plain dicts, so each Message is dumped on the way through.
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
            # What Azure says ran, not what the deployment is called.
            model=response.model,
        )
