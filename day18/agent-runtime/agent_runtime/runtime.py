"""The orchestration loop — the heart of the runtime.

This is the "agentic loop": the model is called, and if it asks to use tools we
run them, feed the results back, and call it again — repeating until the model
stops asking for tools (it has an answer) or we hit a safety cap. That single
``while`` loop is what turns a stateless text-completion API into something that
can carry out a multi-step task on its own.

Three details make this robust rather than a toy:
  - We append the model's *entire* response (text + thinking + tool_use) to
    history before running tools, so nothing the model said is lost.
  - Every tool_use block gets exactly one matching tool_result, and they all go
    back in a *single* user message.
  - A ``max_steps`` cap guarantees termination even if the model loops.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .llm import LLM
from .memory import Memory
from .tools import ToolRegistry

DEFAULT_SYSTEM = """You are a capable task-completion agent running inside a minimal runtime.

You have tools for arithmetic, reading and writing files in a sandboxed workspace,
and saving/looking up durable facts in long-term memory. Work step by step: call
tools to gather information and take actions, then give a short, direct final
answer once the task is complete. Prefer the calculator over doing math yourself,
and save anything worth remembering across sessions with the remember tool.

What you already remember from past sessions:
{memory}
"""


@dataclass
class Step:
    """One turn of the loop, captured for tracing/inspection."""

    kind: str  # "message" | "tool"
    detail: dict[str, Any]


@dataclass
class RunResult:
    output: str
    steps: list[Step] = field(default_factory=list)
    stopped_reason: str = "end_turn"  # "end_turn" | "max_steps"


class Agent:
    def __init__(
        self,
        llm: LLM,
        tools: ToolRegistry,
        memory: Memory,
        *,
        system: str = DEFAULT_SYSTEM,
        max_steps: int = 12,
        on_event: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> None:
        self.llm = llm
        self.tools = tools
        self.memory = memory
        self.system_template = system
        self.max_steps = max_steps
        self.on_event = on_event or (lambda kind, data: None)

    def _system(self) -> str:
        return self.system_template.format(memory=self.memory.memory_briefing())

    def run(self, user_input: str) -> RunResult:
        """Drive one task to completion."""
        self.memory.add_user(user_input)
        self.on_event("user", {"text": user_input})
        steps: list[Step] = []

        for _ in range(self.max_steps):
            # Recompute the tool schemas on EVERY iteration, not once up front.
            # The agent can create new tools mid-task (see toolsmith.py); hoisting
            # this out of the loop — the obvious way to write it — would make a
            # tool invented at step 2 invisible for the rest of the run.
            schemas = self.tools.schemas()
            self.on_event("tools", {"names": self.tools.names()})

            resp = self.llm.create(
                system=self._system(),
                messages=self.memory.messages,
                tools=schemas,
            )
            # Record the assistant turn *before* acting on it — thinking and
            # tool_use blocks must be replayed to the model on the next call.
            self.memory.add_assistant(resp.content)
            steps.append(Step("message", {"content": resp.content, "stop_reason": resp.stop_reason}))
            if text := resp.text():
                self.on_event("assistant", {"text": text})

            tool_calls = resp.tool_calls()
            if resp.stop_reason != "tool_use" or not tool_calls:
                return RunResult(output=resp.text(), steps=steps, stopped_reason="end_turn")

            # Run every requested tool; collect one result per call.
            results: list[dict[str, Any]] = []
            for call in tool_calls:
                self.on_event("tool_call", {"name": call["name"], "input": call["input"]})
                result = self.tools.dispatch(call["name"], call["input"])
                steps.append(Step("tool", {"name": call["name"], "input": call["input"],
                                           "output": result.content, "is_error": result.is_error}))
                self.on_event("tool_result", {"name": call["name"], "output": result.content,
                                              "is_error": result.is_error})
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call["id"],
                    "content": result.content,
                    "is_error": result.is_error,
                })
            # All results go back in one user message.
            self.memory.add_user(results)

        # Ran out of steps without the model finishing.
        return RunResult(
            output="[stopped: reached max_steps without a final answer]",
            steps=steps,
            stopped_reason="max_steps",
        )
