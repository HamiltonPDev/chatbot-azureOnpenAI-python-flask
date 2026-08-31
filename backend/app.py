"""The HTTP layer.

Owns the route table, the boundary where untrusted JSON becomes a validated
model, and the mapping from internal failure to what the browser is allowed
to see. It knows nothing about Azure beyond "ask the client for an answer".

Implements ADR-001 (Flask) and completes ADR-002 (the trust boundary).
"""

import os
import time

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from azure_client import AzureClient, AzureClientError
from schemas import QueryRequest

# Must run before AzureClient() below, which reads these at construction.
load_dotenv()

app = Flask(__name__)

# An allowlist, never "*". With "*", any site a visitor happens to open could
# call this API from their browser and spend the deployment's budget.
CORS(app, origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")])

# Built once at startup, not per request: rebuilding the HTTP client on every
# call would throw away connection pooling for no reason.
client = AzureClient()


# Liveness only: answers "is this process alive?" without spending an
# Azure call, so an orchestrator can poll it as often as it likes.
@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/query")
def query():
    # 1. Validate at the boundary. Malformed JSON and an empty body take the
    #    same path: silent=True yields None, "or {}" makes it a dict, and
    #    Pydantic rejects it as a missing question.
    try:
        payload = QueryRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify(error="Please ask a question!"), 400

    # 2. Call the model, timing it. perf_counter is monotonic, so a system
    #    clock adjustment mid-request cannot produce a negative duration.
    started = time.perf_counter()
    try:
        completion = client.complete(payload.question, payload.history)
    except AzureClientError:
        # Full traceback to the log; one sentence to the browser. Upstream
        # error text can name the deployment and its quota state.
        app.logger.exception("Azure call failed")
        return jsonify(error="The model is unavailable. Try again."), 502

    # 3. Return the answer plus what it cost. Visible timings drive the trace
    #    panel in the UI (ADR-007).
    return jsonify(
        answer=completion.answer,
        latency_ms=round((time.perf_counter() - started) * 1000),
        # The model Azure reports, and the deployment label it hides behind.
        model=completion.model,
        deployment=client.model_name,
    )


if __name__ == "__main__":
    # Not 5000: macOS AirPlay Receiver (Control Center) squats on *:5000 and
    # answers 403, which silently shadows a Flask server bound to 127.0.0.1.
    app.run(port=int(os.getenv("PORT", 5001)), debug=True)
