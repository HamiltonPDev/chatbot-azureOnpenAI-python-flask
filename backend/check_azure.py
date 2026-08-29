"""Connectivity smoke test — does the Azure deployment answer at all?

Run this before building anything else, and again before any demo:
    ./venv/bin/python check_azure.py

No try/except on purpose: if something is wrong, the raw error is the
whole point of running this.
"""

import os

from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

client = AzureOpenAI(
    api_key=os.environ["AZURE_OPENAI_KEY"],
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_version=os.environ["AZURE_OPENAI_API_VERSION"],
)

response = client.chat.completions.create(
    model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
    messages=[{"role": "user", "content": "Reply with exactly: connection ok"}],
    timeout=30,
)

print("answer :", response.choices[0].message.content)
print("model  :", response.model)
print("tokens :", response.usage.total_tokens)
