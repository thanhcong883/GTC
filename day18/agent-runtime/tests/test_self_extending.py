"""Tests for the self-extending tool system and the trace/visualizer.

All offline via the scripted backend — no API key, no network.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from agent_runtime import (
    Agent,
    Memory,
    ScriptedLLM,
    ToolSmithError,
    TraceRecorder,
    Workspace,
    build_default_tools,
    render_trace,
)
from agent_runtime.llm import call
from agent_runtime.toolsmith import ToolSmith
from agent_runtime.tools import ToolRegistry

WORD_COUNT = '''def word_count(text):
    words = [w for w in text.split() if w]
    return f"{len(words)} words"
'''

SCHEMA = {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}


def make(tmp_path, script, **kw):
    ws = Workspace(tmp_path / "ws")
    mem = Memory(tmp_path / "memory.json")
    tools = build_default_tools(ws, mem)
    return Agent(ScriptedLLM(script), tools, mem, **kw), ws, mem, tools


def create_call(cid="c1", name="word_count", code=WORD_COUNT):
    return call("create_tool", {
        "name": name, "description": f"{name} tool",
        "input_schema": SCHEMA, "code": code,
    }, cid)


# --- the headline behavior ----------------------------------------------------

def test_agent_creates_a_tool_and_uses_it_in_the_same_run(tmp_path):
    script = [
        create_call("c1"),
        call("word_count", {"text": "one two three"}, "c2"),
        "It has 3 words.",
    ]
    agent, _, _, tools = make(tmp_path, script)
    assert not tools.has("word_count")          # did not exist at the start
    result = agent.run("Count the words in 'one two three'.")

    assert result.stopped_reason == "end_turn"
    assert tools.has("word_count")              # exists now
    outs = [s.detail["output"] for s in result.steps if s.kind == "tool"]
    assert "3 words" in outs[1]                 # and it actually ran


def test_schemas_are_recomputed_each_iteration(tmp_path):
    """The crux of the feature: hoisting schemas out of the loop would make a
    tool created mid-run invisible to the model."""
    script = [create_call("c1"), call("word_count", {"text": "a b"}, "c2"), "done"]
    ws = Workspace(tmp_path / "ws")
    mem = Memory(tmp_path / "memory.json")
    tools = build_default_tools(ws, mem)
    llm = ScriptedLLM(script)
    Agent(llm, tools, mem).run("go")

    first_call_tools = {t["name"] for t in llm.calls[0]["tools"]}
    later_call_tools = {t["name"] for t in llm.calls[2]["tools"]}
    assert "word_count" not in first_call_tools   # didn't exist yet
    assert "word_count" in later_call_tools       # visible on a later turn


def test_learned_tool_persists_into_a_new_session(tmp_path):
    """A skill invented in one session is available at startup in the next."""
    script = [create_call("c1"), "made it"]
    agent, ws, _, _ = make(tmp_path, script)
    agent.run("Make a word_count tool.")

    ws2 = Workspace(tmp_path / "ws")
    mem2 = Memory(tmp_path / "memory2.json")
    tools2 = build_default_tools(ws2, mem2)
    assert tools2.has("word_count")
    assert tools2.dispatch("word_count", {"text": "x y z"}).content == "3 words"


def test_learned_skills_are_hidden_from_list_files(tmp_path):
    """The runtime's own skill store is bookkeeping, not user content."""
    agent, ws, _, tools = make(tmp_path, [create_call("c1"), "ok"])
    ws.write("real.txt", "hello")
    agent.run("make a tool")
    assert ws.list() == ["real.txt"]


# --- screening / safety -------------------------------------------------------

@pytest.mark.parametrize("bad_code, reason", [
    ("def t(text):\n    import os\n    return os.listdir('/')", "import"),
    ("def t(text):\n    return ().__class__.__bases__[0].__subclasses__()", "dunder"),
    ("def t(text):\n    return open('/etc/passwd').read()", "open"),
    ("def t(text):\n    return eval(text)", "eval"),
    ("def t(text)\n    return 1", "syntax"),
    ("def a(x):\n    return 1\ndef b(x):\n    return 2", "exactly one"),
    ("def other(text):\n    return 'hi'", "named"),
])
def test_malicious_or_malformed_code_is_rejected(tmp_path, bad_code, reason):
    reg = ToolRegistry()
    smith = ToolSmith(reg, tmp_path / ".tools")
    with pytest.raises(ToolSmithError):
        smith.create("t", "desc", SCHEMA, bad_code)
    assert not reg.has("t")


def test_rejection_is_an_error_result_not_a_crash(tmp_path):
    """A rejected tool comes back as a readable error the model can recover from."""
    script = [
        create_call("c1", name="sneaky", code="def sneaky(text):\n    import os\n    return '1'"),
        "Understood, I can't use os.",
    ]
    agent, _, _, tools = make(tmp_path, script)
    result = agent.run("try something")
    step = [s for s in result.steps if s.kind == "tool"][0]
    assert step.detail["is_error"] is True
    assert "not allowed" in step.detail["output"]
    assert not tools.has("sneaky")
    assert result.stopped_reason == "end_turn"   # loop survived


def test_duplicate_tool_name_is_rejected(tmp_path):
    reg = ToolRegistry()
    smith = ToolSmith(reg, tmp_path / ".tools")
    smith.create("word_count", "d", SCHEMA, WORD_COUNT)
    with pytest.raises(ToolSmithError, match="already exists"):
        smith.create("word_count", "d", SCHEMA, WORD_COUNT)


def test_generated_tool_runtime_error_becomes_error_result(tmp_path):
    reg = ToolRegistry()
    smith = ToolSmith(reg, tmp_path / ".tools")
    smith.create("boom", "d", SCHEMA, "def boom(text):\n    return 1 / 0")
    res = reg.dispatch("boom", {"text": "x"})
    assert res.is_error and "ZeroDivisionError" in res.content


def test_corrupt_skill_on_disk_does_not_break_startup(tmp_path):
    skills = tmp_path / "ws" / ".tools"
    skills.mkdir(parents=True)
    (skills / "broken.json").write_text('{"name": "broken"}')  # no .py alongside
    ws = Workspace(tmp_path / "ws")
    tools = build_default_tools(ws, Memory(tmp_path / "m.json"))
    assert not tools.has("broken")
    assert tools.has("create_tool")   # startup still succeeded


# --- trace + visualizer -------------------------------------------------------

def test_trace_records_tool_surface_growth(tmp_path):
    rec = TraceRecorder(title="t")
    script = [create_call("c1"), call("word_count", {"text": "a b"}, "c2"), "done"]
    ws = Workspace(tmp_path / "ws")
    mem = Memory(tmp_path / "memory.json")
    tools = build_default_tools(ws, mem)
    rec.bind_memory(mem)
    Agent(ScriptedLLM(script), tools, mem, on_event=rec).run("go")

    assert len(rec.tool_surface) >= 2
    growth = [e for e in rec.events if e["kind"] == "tools" and e.get("new")]
    assert growth and "word_count" in growth[0]["new"]


def test_render_trace_is_self_contained_html(tmp_path):
    rec = TraceRecorder(title="Demo run")
    script = [call("calculator", {"expression": "1+1"}, "c1"), "2"]
    ws = Workspace(tmp_path / "ws")
    mem = Memory(tmp_path / "memory.json")
    rec.bind_memory(mem)
    tools = build_default_tools(ws, mem)
    result = Agent(ScriptedLLM(script), tools, mem, on_event=rec).run("1+1?")

    html = render_trace({**rec.to_dict(result), "title": "Demo run"})
    assert html.startswith("<!doctype html>")
    assert "Demo run" in html
    assert "http://" not in html and "https://" not in html
    assert "<script src" not in html and "<link" not in html
