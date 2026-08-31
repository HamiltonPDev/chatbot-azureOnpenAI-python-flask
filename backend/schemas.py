"""The API contract.

Every request that reaches a route handler has already passed through here,
or it never reached the handler at all. Validation lives in one file so the
contract is readable in one place instead of scattered across endpoints.

Implements ADR-004 (Pydantic v2 as a standalone dependency).
"""

from typing import Literal
from pydantic import BaseModel, Field

class Message(BaseModel):
    """One turn of the conversation, as replayed by the client.

    The server keeps no history of its own (ADR-003), so every prior turn
    arrives from the browser on each request.
    """

    role: Literal["user", "assistant"]
    content: str


class QueryRequest(BaseModel):
    """The body of POST /query."""

    question: str = Field(min_length=1, max_length=1000)
    history: list[Message] = []
