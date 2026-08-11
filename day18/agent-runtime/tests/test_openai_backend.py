"""Tests for the OpenAI translation layer — all offline, no network, no key.

``OpenAILLM`` doesn't change the runtime's internal contract (the block-shape
messages every other module works with); it translates that shape to and from
OpenAI's actual wire format on every call. These tests exercise the translation
functions directly with fake OpenAI-shaped objects, so format bugs are caught
before a live call ever pays for one.
"""

import json
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from agent_runtime.llm import (
    LLMConfigError,
    OpenAILLM,
    _from_openai_message,
    _to_openai_messages,
    _to_openai_tool,
)


def fake_message(content=None, tool_calls=None):
    calls = None
    if tool_calls:
        calls = [
            SimpleNamespace(
                id=c["id"],
                function=SimpleNamespace(name=c["name"], arguments=json.dumps(c["args"])),
            )
            for c in tool_calls
        ]
    return SimpleNamespace(content=content, tool_calls=calls)


# --- outbound: our shape -> OpenAI's wire format -------------------------------

def test_system_prompt_becomes_first_message():
    out = _to_openai_messages("be helpful", [])
    assert out == [{"role": "system", "content": "be helpful"}]


def test_plain_user_text_passes_through():
    history = [{"role": "user", "content": "hello"}]
    out = _to_openai_messages("sys", history)
    assert out[1] == {"role": "user", "content": "hello"}


def test_assistant_tool_use_becomes_tool_calls_array():
    history = [{"role": "assistant", "content": [
        {"type": "text", "text": "checking the weather"},
        {"type": "tool_use", "id": "call_1", "name": "get_weather", "input": {"city": "Hanoi"}},
    ]}]
    out = _to_openai_messages("sys", history)
    msg = out[1]
    assert msg["role"] == "assistant"
    assert msg["content"] == "checking the weather"
    assert msg["tool_calls"] == [{
        "id": "call_1", "type": "function",
        "function": {"name": "get_weather", "arguments": json.dumps({"city": "Hanoi"})},
    }]


def test_tool_result_becomes_its_own_tool_role_message():
    """The one real contract difference from Anthropic: OpenAI wants one
    'tool'-role message per result, not everything batched into one user
    message."""
    history = [{"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": "call_1", "content": "sunny, 30C"},
        {"type": "tool_result", "tool_use_id": "call_2", "content": "4"},
    ]}]
    out = _to_openai_messages("sys", history)
    tool_msgs = out[1:]
    assert len(tool_msgs) == 2  # NOT batched into a single message
    assert tool_msgs[0] == {"role": "tool", "tool_call_id": "call_1", "content": "sunny, 30C"}
    assert tool_msgs[1] == {"role": "tool", "tool_call_id": "call_2", "content": "4"}


def test_tool_schema_translation():
    ours = {"name": "calculator", "description": "does math",
            "input_schema": {"type": "object", "properties": {"expression": {"type": "string"}},
                             "required": ["expression"]}}
    out = _to_openai_tool(ours)
    assert out == {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "does math",
            "parameters": ours["input_schema"],
        },
    }


# --- inbound: OpenAI's response -> our shape -----------------------------------

def test_text_only_response():
    resp = _from_openai_message(fake_message(content="Paris is the capital."), "stop")
    assert resp.text() == "Paris is the capital."
    assert resp.stop_reason == "stop"
    assert resp.tool_calls() == []


def test_tool_calls_response_and_finish_reason_normalized():
    """OpenAI's finish_reason 'tool_calls' must map to 'tool_use' so
    runtime.py's stop_reason check (written against Anthropic's vocabulary)
    works unchanged for either backend."""
    resp = _from_openai_message(
        fake_message(content=None, tool_calls=[
            {"id": "call_1", "name": "get_weather", "args": {"city": "Hanoi"}},
        ]),
        "tool_calls",
    )
    assert resp.stop_reason == "tool_use"
    calls = resp.tool_calls()
    assert len(calls) == 1
    assert calls[0] == {"type": "tool_use", "id": "call_1", "name": "get_weather",
                         "input": {"city": "Hanoi"}}


def test_parallel_tool_calls_both_translated():
    resp = _from_openai_message(
        fake_message(tool_calls=[
            {"id": "a", "name": "calculator", "args": {"expression": "2+2"}},
            {"id": "b", "name": "calculator", "args": {"expression": "3+3"}},
        ]),
        "tool_calls",
    )
    assert len(resp.tool_calls()) == 2


def test_malformed_arguments_json_does_not_crash():
    msg = SimpleNamespace(
        content=None,
        tool_calls=[SimpleNamespace(id="a", function=SimpleNamespace(name="x", arguments="{not json"))],
    )
    resp = _from_openai_message(msg, "tool_calls")
    assert resp.tool_calls()[0]["input"] == {}  # degrades gracefully, doesn't raise


# --- construction / error handling ---------------------------------------------

def test_openai_llm_raises_config_error_without_sdk_or_key():
    try:
        import openai  # noqa: F401
    except ImportError:
        with pytest.raises(LLMConfigError):
            OpenAILLM()
    else:
        pytest.skip("openai is installed in this environment; see the key-based tests below")


def test_missing_key_is_config_error(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(LLMConfigError, match="OPENAI_API_KEY"):
        OpenAILLM()


# --- discovered by actually running this against the real API: a raw ------
# --- APIConnectionError otherwise dumps a 20-line SDK traceback -----------

def test_connection_error_becomes_config_error(monkeypatch):
    openai = pytest.importorskip("openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-a-real-key")
    llm = OpenAILLM()

    def boom(**kwargs):
        raise openai.APIConnectionError(request=SimpleNamespace())

    monkeypatch.setattr(llm._client.chat.completions, "create", boom)
    with pytest.raises(LLMConfigError, match="could not reach"):
        llm.create(system="s", messages=[], tools=[])


def test_generic_api_error_becomes_config_error(monkeypatch):
    openai = pytest.importorskip("openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-a-real-key")
    llm = OpenAILLM()

    def boom(**kwargs):
        raise openai.RateLimitError(
            "rate limited",
            response=SimpleNamespace(status_code=429, headers={}, request=SimpleNamespace()),
            body=None,
        )

    monkeypatch.setattr(llm._client.chat.completions, "create", boom)
    with pytest.raises(LLMConfigError, match="OpenAI API error"):
        llm.create(system="s", messages=[], tools=[])
