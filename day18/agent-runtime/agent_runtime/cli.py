"""Command-line entry point.

    python -m agent_runtime "your task here"       # real, needs OPENAI_API_KEY
    python -m agent_runtime --chat                 # real, interactive REPL
    python -m agent_runtime --demo                 # offline scripted walk-through
    python -m agent_runtime --demo --trace t.html  # ...and write an HTML replay

The real paths use the OpenAI backend; ``--demo`` uses the scripted backend so
you can watch the loop, self-extending tools, and memory work end to end with no
API key.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile

# Windows consoles default stdout/stderr to the system codepage (cp1252 etc.),
# which can't encode the emoji/arrows in the trace printer below — a
# UnicodeEncodeError that only surfaces by actually running this on Windows,
# never in tests. Force UTF-8 unconditionally; reconfigure() is a no-op-safe
# Python 3.7+ API and every stream here is text-mode.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

from .llm import LLMConfigError, OpenAILLM, ScriptedLLM, call
from .memory import Memory
from .runtime import Agent
from .tools import build_default_tools
from .trace import TraceRecorder
from .viz import render_trace
from .workspace import Workspace


def _trace_printer(kind: str, data: dict) -> None:
    if kind == "assistant" and data["text"]:
        print(f"\n🤖 {data['text']}")
    elif kind == "tool_call":
        print(f"   ↳ tool: {data['name']}({_fmt(data['input'])})")
    elif kind == "tool_result":
        mark = "✗" if data["is_error"] else "✓"
        print(f"     {mark} {data['output'].splitlines()[0][:100]}")


def _fmt(d: dict) -> str:
    return ", ".join(f"{k}={v!r}" for k, v in d.items())[:110]


def _fanout(*handlers):
    def emit(kind, data):
        for h in handlers:
            h(kind, data)
    return emit


def _finish(recorder, result, trace_path, title):
    print(f"\n=== done ({result.stopped_reason}) ===")
    if trace_path:
        html = render_trace({**recorder.to_dict(result), "title": title})
        with open(trace_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"trace written to {trace_path}")


def _build_real_agent(model, workspace_dir, store):
    """Shared setup for the two real (non-demo) entry points."""
    workspace = Workspace(workspace_dir)
    memory = Memory(store)
    tools = build_default_tools(workspace, memory)
    llm = OpenAILLM(model=model)  # raises LLMConfigError before any network call
    return workspace, memory, tools, llm


def run_real(task, model, workspace_dir, store, trace_path) -> None:
    workspace, memory, tools, llm = _build_real_agent(model, workspace_dir, store)
    recorder = TraceRecorder(title=task[:80]).bind_memory(memory)
    agent = Agent(llm, tools, memory, on_event=_fanout(_trace_printer, recorder))
    result = agent.run(task)
    _finish(recorder, result, trace_path, task[:80])


def run_chat(model, workspace_dir, store, trace_dir) -> None:
    """Interactive REPL: one task per line, run to completion, repeat.

    Long-term memory and the tool registry (including anything the agent wrote
    for itself) persist for the whole session — what the agent *learned*
    carries forward. The *working* transcript is reset between tasks (see
    ``Memory.reset_working``) so each task is its own conversation rather than
    one endlessly growing one.
    """
    workspace, memory, tools, llm = _build_real_agent(model, workspace_dir, store)
    print(f"agent-runtime chat — model={model}, workspace={workspace.root}")
    print("Type a task and press enter. 'exit' or Ctrl-D to quit.\n")

    n = 0
    while True:
        try:
            task = input("Task: ").strip()
        except EOFError:
            print()
            break
        if not task:
            continue
        if task.lower() in ("exit", "quit"):
            break

        n += 1
        recorder = TraceRecorder(title=task[:80]).bind_memory(memory)
        agent = Agent(llm, tools, memory, on_event=_fanout(_trace_printer, recorder))
        result = agent.run(task)
        trace_path = os.path.join(trace_dir, f"chat-{n}.html") if trace_dir else None
        _finish(recorder, result, trace_path, task[:80])
        memory.reset_working()  # next task starts a clean conversation
        print()

    print(f"tools known at exit: {tools.names()}")
    print(f"long-term memory: {memory.all()}")


# The tool the scripted agent writes for itself mid-run.
_WORD_COUNT_SRC = '''def word_count(text):
    """Count words and characters in a piece of text."""
    words = [w for w in text.split() if w]
    return f"{len(words)} words, {len(text)} characters"
'''


def run_demo(trace_path) -> None:
    """A self-contained trajectory where the agent hits the limits of its
    built-in tools, *writes a new tool for itself*, and then uses it — no API
    key required."""
    tmp = tempfile.mkdtemp(prefix="agent-demo-")
    workspace = Workspace(tmp)
    workspace.write("notes.txt", "the runtime loops until the model stops asking for tools\n")
    memory = Memory(os.path.join(tmp, "memory.json"))
    tools = build_default_tools(workspace, memory)

    script = [
        [{"type": "text", "text": "Let me read the file first."},
         call("read_file", {"path": "notes.txt"}, "c1")],
        [{"type": "text",
          "text": "I have no tool that counts words, so I'll write one for myself."},
         call("create_tool", {
             "name": "word_count",
             "description": "Count the words and characters in a piece of text.",
             "input_schema": {"type": "object",
                              "properties": {"text": {"type": "string"}},
                              "required": ["text"]},
             "code": _WORD_COUNT_SRC,
         }, "c2")],
        [{"type": "text", "text": "Now I can use the tool I just made."},
         call("word_count",
              {"text": "the runtime loops until the model stops asking for tools"}, "c3")],
        call("remember", {"key": "notes_word_count", "value": "10 words"}, "c4"),
        "I read notes.txt, wrote myself a word_count tool since none existed, and used it: "
        "10 words, 56 characters. I saved the count to memory and kept the tool for next time.",
    ]

    recorder = TraceRecorder(title="Agent writes its own tool").bind_memory(memory)
    agent = Agent(ScriptedLLM(script), tools, memory,
                  on_event=_fanout(_trace_printer, recorder))

    print(f"workspace: {tmp}")
    print(f"tools at start: {tools.names()}")
    result = agent.run("Count the words in notes.txt and remember the result.")
    print(f"\ntools at end:   {tools.names()}")
    print(f"learned skills on disk: {sorted(p.name for p in (workspace.root / '.tools').glob('*.py'))}")
    print(f"long-term memory: {memory.all()}")
    _finish(recorder, result, trace_path, "Agent writes its own tool")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="agent_runtime",
                                description="A minimal but real, self-extending agent runtime.")
    p.add_argument("task", nargs="?", help="the task for the agent to carry out")
    p.add_argument("--demo", action="store_true", help="run the offline scripted demo (no API key)")
    p.add_argument("--chat", action="store_true", help="interactive REPL: enter one task at a time")
    p.add_argument("--trace", metavar="PATH", help="write an interactive HTML replay of the run")
    p.add_argument("--trace-dir", metavar="DIR",
                   help="with --chat, write a numbered trace per task into this directory")
    p.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-4o"),
                   help="OpenAI model (default: gpt-4o via OPENAI_MODEL, override freely — "
                        "this default may be out of date by the time you're reading this)")
    p.add_argument("--workspace", default=os.environ.get("AGENT_WORKSPACE", "./workspace"))
    p.add_argument("--store", default=os.environ.get("AGENT_MEMORY", "./memory.json"))
    args = p.parse_args(argv)

    if args.demo:
        run_demo(args.trace)
        return 0

    try:
        if args.chat:
            run_chat(args.model, args.workspace, args.store, args.trace_dir)
        elif args.task:
            run_real(args.task, args.model, args.workspace, args.store, args.trace)
        else:
            p.print_help()
            return 1
    except LLMConfigError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
