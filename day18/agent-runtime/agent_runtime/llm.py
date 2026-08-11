"""LLM backends.

The runtime talks to the model through one tiny interface: give it a system
prompt, the running message list, and the tool schemas; get back a normalized
list of content blocks and a ``stop_reason``. Two backends implement it:

- ``OpenAILLM``   — the real thing, wrapping the official ``openai`` SDK.
- ``ScriptedLLM`` — a deterministic replay backend used by the tests, so the
  whole loop (tool-calling, memory, termination) can run offline with no key.

Both return the *same* normalized shape — plain JSON-able dicts modeled on
Anthropic's content-block convention (``text`` / ``tool_use`` / ``tool_result``
/ ``thinking``) — so the orchestration loop, tools, and memory never have to
care which provider is on the other end. ``OpenAILLM`` is a **translation
layer**: it converts this internal shape to and from OpenAI's actual wire
format (Chat Completions + function calling) on every call. That translation is
the concrete proof that the "swappable backend" claim in the design note is
real, not aspirational — see the two functions below and ``DESIGN.md``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class LLMResponse:
    """What every backend hands back to the loop.

    ``content`` is a list of content-block dicts (``text``, ``tool_use``,
    ``thinking``, ...) in the runtime's own internal shape — not any one
    provider's wire format. Keeping it provider-neutral means it can be
    appended straight into the message history, logged, and persisted to disk
    without a conversion step, regardless of which backend produced it.
    """

    content: list[dict[str, Any]]
    stop_reason: str

    def text(self) -> str:
        """Concatenate the visible text blocks (ignores thinking/tool_use)."""
        return "".join(b.get("text", "") for b in self.content if b.get("type") == "text")

    def tool_calls(self) -> list[dict[str, Any]]:
        return [b for b in self.content if b.get("type") == "tool_use"]


class LLM(Protocol):
    def create(
        self,
        *,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
    ) -> LLMResponse: ...


class LLMConfigError(Exception):
    """Raised when the real backend can't be reached — missing credential,
    unreachable model, etc. Caught at the CLI boundary and turned into a short,
    actionable message instead of a raw SDK traceback."""


class OpenAILLM:
    """Real backend: OpenAI's Chat Completions API with function calling.

    OpenAI's wire contract differs from the runtime's internal shape in three
    ways that matter for a harness:

    1. **System prompt** is not a separate parameter — it's the first message,
       ``{"role": "system", "content": ...}``.
    2. **Tool calls** live in a ``tool_calls`` array on the assistant message,
       not as separate content blocks; each call's arguments arrive as a JSON
       *string* that must be parsed, not a pre-parsed object.
    3. **Tool results** are each their own message with ``role: "tool"`` and a
       ``tool_call_id`` — one message per call. Anthropic instead wants every
       result for a turn batched into a single ``user`` message. Get this
       wrong in either direction and the API rejects the request; it is not a
       cosmetic difference. ``_to_openai_messages`` / ``_from_openai_message``
       below are where that translation actually happens.
    """

    def __init__(self, model: str = "gpt-4o", max_tokens: int = 4096) -> None:
        # Imported lazily so the offline/test path never needs the SDK installed.
        try:
            import openai
        except ImportError as e:
            raise LLMConfigError(
                "the 'openai' package is not installed. Run: pip install -r requirements.txt"
            ) from e

        try:
            self._client = openai.OpenAI()
        except openai.OpenAIError as e:
            raise LLMConfigError(
                f"could not create an OpenAI client: {e}\n"
                "Set OPENAI_API_KEY in the environment (export OPENAI_API_KEY=sk-...)."
            ) from e
        self._openai = openai
        self.model = model
        self.max_tokens = max_tokens

    def create(self, *, system, messages, tools) -> LLMResponse:
        oa_messages = _to_openai_messages(system, messages)
        oa_tools = [_to_openai_tool(t) for t in tools] if tools else None
        try:
            resp = self._client.chat.completions.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=oa_messages,
                tools=oa_tools,
            )
        except self._openai.NotFoundError as e:
            raise LLMConfigError(
                f"model '{self.model}' is not available to this API key. "
                f"Try a different --model. ({e})"
            ) from e
        except self._openai.AuthenticationError as e:
            raise LLMConfigError(f"OpenAI rejected the API key: {e}") from e
        except self._openai.APIConnectionError as e:
            # Discovered by running this for real: a raw APIConnectionError
            # (DNS failure, TLS block, a network policy rejecting the host)
            # otherwise surfaces as a 20-line SDK/httpx traceback. One
            # sentence is more useful than a stack trace for something the
            # caller can't fix by editing this file.
            raise LLMConfigError(
                f"could not reach the OpenAI API: {e}\n"
                "Check your network connection — or, if you're behind a proxy or "
                "in a sandboxed environment, whether outbound access to "
                "api.openai.com is allowed."
            ) from e
        except self._openai.APIError as e:
            # Catch-all for anything else the SDK's exception hierarchy defines
            # (rate limits, server errors, bad requests) — still a clean
            # message rather than a bare traceback.
            raise LLMConfigError(f"OpenAI API error: {e}") from e
        return _from_openai_message(resp.choices[0].message, resp.choices[0].finish_reason)


def _to_openai_tool(tool: dict[str, Any]) -> dict[str, Any]:
    """Our tool schema -> OpenAI's function-tool schema."""
    return {
        "type": "function",
        "function": {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["input_schema"],
        },
    }


def _to_openai_messages(system: str, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Internal block-shape history -> OpenAI's flat message array.

    Each internal ``{"role": ..., "content": [blocks]}`` entry may expand into
    *multiple* OpenAI messages: an assistant turn with both text and a
    tool_use block becomes one assistant message carrying ``tool_calls``; a
    user turn carrying several tool_result blocks becomes several standalone
    ``role: "tool"`` messages, one per result.
    """
    out: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for msg in messages:
        role, content = msg["role"], msg["content"]
        if isinstance(content, str):
            out.append({"role": role, "content": content})
            continue

        if role == "assistant":
            text_parts = [b["text"] for b in content if b.get("type") == "text"]
            tool_calls = [
                {
                    "id": b["id"],
                    "type": "function",
                    "function": {"name": b["name"], "arguments": json.dumps(b["input"])},
                }
                for b in content if b.get("type") == "tool_use"
            ]
            entry: dict[str, Any] = {"role": "assistant", "content": "".join(text_parts) or None}
            if tool_calls:
                entry["tool_calls"] = tool_calls
            out.append(entry)
        else:  # user turn: plain text and/or a batch of tool_result blocks
            for b in content:
                if b.get("type") == "tool_result":
                    out.append({
                        "role": "tool",
                        "tool_call_id": b["tool_use_id"],
                        "content": b["content"],
                    })
                elif b.get("type") == "text":
                    out.append({"role": "user", "content": b["text"]})
    return out


def _from_openai_message(message: Any, finish_reason: str) -> LLMResponse:
    """OpenAI's response message -> our internal ``LLMResponse``."""
    content: list[dict[str, Any]] = []
    if message.content:
        content.append({"type": "text", "text": message.content})
    for call in message.tool_calls or []:
        try:
            args = json.loads(call.function.arguments)
        except json.JSONDecodeError:
            args = {}
        content.append({
            "type": "tool_use",
            "id": call.id,
            "name": call.function.name,
            "input": args,
        })
    # finish_reason "tool_calls" is OpenAI's spelling of what the rest of this
    # runtime calls "tool_use" (Anthropic's spelling) — normalize at the edge
    # so runtime.py's `stop_reason == "tool_use"` check works unchanged.
    stop_reason = "tool_use" if finish_reason == "tool_calls" else finish_reason
    return LLMResponse(content=content, stop_reason=stop_reason)


class ScriptedLLM:
    """Deterministic backend for tests and demos.

    Constructed with a list of ``turns``, where each turn is either:
      - a plain string  -> a final ``end_turn`` text response, or
      - a dict/list building the ``content`` for a ``tool_use`` turn.

    A turn may also be a callable ``(messages) -> LLMResponse`` for reacting to
    what tools returned. This lets a test drive a full multi-step trajectory
    without a network or an API key.
    """

    def __init__(self, turns: list[Any]) -> None:
        self._turns = list(turns)
        self._i = 0
        self.calls: list[dict[str, Any]] = []  # captured for assertions

    def create(self, *, system, messages, tools) -> LLMResponse:
        self.calls.append({"system": system, "messages": messages, "tools": tools})
        if self._i >= len(self._turns):
            raise AssertionError("ScriptedLLM ran out of scripted turns")
        turn = self._turns[self._i]
        self._i += 1
        if callable(turn):
            return turn(messages)
        if isinstance(turn, str):
            return LLMResponse([{"type": "text", "text": turn}], "end_turn")
        content = turn if isinstance(turn, list) else [turn]
        stop = "tool_use" if any(b.get("type") == "tool_use" for b in content) else "end_turn"
        return LLMResponse(content, stop)


# --- small helpers for building scripted turns in tests -----------------------

def say(text: str) -> str:
    return text


def call(name: str, tool_input: dict[str, Any], call_id: str = "call_1") -> dict[str, Any]:
    return {"type": "tool_use", "id": call_id, "name": name, "input": tool_input}
