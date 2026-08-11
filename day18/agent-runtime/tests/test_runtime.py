"""End-to-end tests for the runtime, all offline via the scripted backend.

These exercise the three things the runtime claims to do — orchestration loop,
tool-calling, and memory — plus the failure and termination behavior that makes
the loop safe.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_runtime import Agent, Memory, ScriptedLLM, Workspace, build_default_tools
from agent_runtime.llm import LLMResponse, call
from agent_runtime.tools import ToolRegistry


def make_agent(tmp_path, script, **kw):
    ws = Workspace(tmp_path / "ws")
    mem = Memory(tmp_path / "memory.json")
    tools = build_default_tools(ws, mem)
    return Agent(ScriptedLLM(script), tools, mem, **kw), ws, mem


def test_plain_answer_no_tools(tmp_path):
    agent, _, _ = make_agent(tmp_path, ["The capital of France is Paris."])
    result = agent.run("What is the capital of France?")
    assert result.output == "The capital of France is Paris."
    assert result.stopped_reason == "end_turn"


def test_single_tool_call_then_answer(tmp_path):
    script = [
        call("calculator", {"expression": "6 * 7"}),
        "The answer is 42.",
    ]
    agent, _, _ = make_agent(tmp_path, script)
    result = agent.run("What is 6 times 7?")
    assert "42" in result.output
    tool_steps = [s for s in result.steps if s.kind == "tool"]
    assert tool_steps[0].detail["output"] == "42"


def test_multi_step_task(tmp_path):
    """Read -> compute -> write -> remember -> answer: the full trajectory."""
    ws = Workspace(tmp_path / "ws")
    ws.write("expenses.txt", "a 4.50\nb 19.99\nc 12.00\n")
    mem = Memory(tmp_path / "memory.json")
    tools = build_default_tools(ws, mem)
    script = [
        call("read_file", {"path": "expenses.txt"}, "c1"),
        call("calculator", {"expression": "4.50 + 19.99 + 12.00"}, "c2"),
        call("remember", {"key": "total", "value": "36.49"}, "c3"),
        call("write_file", {"path": "out.txt", "content": "Total: 36.49"}, "c4"),
        "All done: the total is 36.49.",
    ]
    agent = Agent(ScriptedLLM(script), tools, mem)
    result = agent.run("Total the expenses, save them, and remember the total.")

    assert result.stopped_reason == "end_turn"
    assert "36.49" in result.output
    assert ws.read("out.txt") == "Total: 36.49"          # write tool ran
    assert mem.recall("total") == "36.49"                # memory tool ran
    # working memory holds the full alternating transcript
    roles = [m["role"] for m in mem.messages]
    assert roles[0] == "user" and roles[-1] == "assistant"


def test_parallel_tool_calls_single_result_message(tmp_path):
    """Two tool_use blocks in one turn -> both results in ONE user message."""
    script = [
        [call("calculator", {"expression": "2+2"}, "a"),
         call("calculator", {"expression": "3+3"}, "b")],
        "Results are 4 and 6.",
    ]
    agent, _, mem = make_agent(tmp_path, script)
    agent.run("Add 2+2 and 3+3.")
    tool_result_msgs = [
        m for m in mem.messages
        if m["role"] == "user" and isinstance(m["content"], list)
        and all(b.get("type") == "tool_result" for b in m["content"])
    ]
    assert len(tool_result_msgs) == 1
    assert len(tool_result_msgs[0]["content"]) == 2  # both results together


def test_tool_error_is_recoverable(tmp_path):
    """A failing tool comes back as an error result, not an exception, and the
    loop keeps going."""
    script = [
        call("read_file", {"path": "does_not_exist.txt"}, "c1"),
        "I couldn't find that file.",
    ]
    agent, _, mem = make_agent(tmp_path, script)
    result = agent.run("Read a missing file.")
    assert result.stopped_reason == "end_turn"
    tool_step = [s for s in result.steps if s.kind == "tool"][0]
    assert tool_step.detail["is_error"] is True
    err_results = [
        b for m in mem.messages if isinstance(m["content"], list)
        for b in m["content"] if b.get("type") == "tool_result" and b.get("is_error")
    ]
    assert err_results


def test_unknown_tool_is_reported(tmp_path):
    reg = ToolRegistry()
    result = reg.dispatch("nope", {})
    assert result.is_error and "Unknown tool" in result.content


def test_max_steps_termination(tmp_path):
    """A model that never stops calling tools still terminates at the cap."""
    def loop_forever(messages):
        return LLMResponse([call("calculator", {"expression": "1+1"})], "tool_use")

    ws = Workspace(tmp_path / "ws")
    mem = Memory(tmp_path / "memory.json")
    tools = build_default_tools(ws, mem)
    agent = Agent(ScriptedLLM([loop_forever] * 50), tools, mem, max_steps=5)
    result = agent.run("loop")
    assert result.stopped_reason == "max_steps"


def test_long_term_memory_persists_across_sessions(tmp_path):
    store = tmp_path / "memory.json"
    ws = Workspace(tmp_path / "ws")
    m1 = Memory(store)
    a1 = Agent(ScriptedLLM([call("remember", {"key": "name", "value": "Cong"}), "Saved."]),
               build_default_tools(ws, m1), m1)
    a1.run("Remember my name is Cong.")

    m2 = Memory(store)
    assert m2.recall("name") == "Cong"
    assert "Cong" in m2.memory_briefing()


def test_workspace_sandbox_blocks_escape(tmp_path):
    ws = Workspace(tmp_path / "ws")
    try:
        ws.read("../../etc/passwd")
    except ValueError as e:
        assert "escapes" in str(e)
    else:  # pragma: no cover
        raise AssertionError("path traversal was not blocked")


def test_calculator_is_sandboxed(tmp_path):
    _, _, mem = make_agent(tmp_path, [])
    reg = build_default_tools(Workspace(tmp_path / "ws"), mem)
    ok = reg.dispatch("calculator", {"expression": "2 ** 10 + 1"})
    assert ok.content == "1025"
    bad = reg.dispatch("calculator", {"expression": "__import__('os').system('ls')"})
    assert bad.is_error  # names/calls are rejected
