"""Recording a run so it can be replayed and inspected.

The loop already emits events through the ``on_event`` seam; ``TraceRecorder``
just listens and builds a JSON-able record of everything that happened: what the
model said, which tools it called with which arguments, what came back, how
long-term memory changed, and — the interesting part for a self-extending agent —
how the **tool surface** grew over the course of the run.

That last one is why the trace exists. A list of tool calls tells you what the
agent did; a list of tool-surface snapshots tells you what the agent *became*.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TraceRecorder:
    """Drop-in ``on_event`` handler that accumulates a structured trace."""

    title: str = "Agent run"
    events: list[dict[str, Any]] = field(default_factory=list)
    tool_surface: list[list[str]] = field(default_factory=list)
    started: float = field(default_factory=time.time)
    memory_snapshots: list[dict[str, str]] = field(default_factory=list)
    _memory: Any = None

    def bind_memory(self, memory) -> "TraceRecorder":
        """Watch a Memory instance so long-term changes are captured."""
        self._memory = memory
        return self

    def __call__(self, kind: str, data: dict[str, Any]) -> None:
        if kind == "tools":
            names = list(data["names"])
            # Only record the surface when it actually changes — a flat list of
            # identical snapshots is noise.
            if not self.tool_surface or self.tool_surface[-1] != names:
                self.tool_surface.append(names)
                self.events.append({
                    "kind": "tools",
                    "t": round(time.time() - self.started, 3),
                    "names": names,
                    "new": _added(self.tool_surface),
                })
            return

        event = {"kind": kind, "t": round(time.time() - self.started, 3), **data}
        if kind == "tool_result" and self._memory is not None:
            snap = self._memory.all()
            if not self.memory_snapshots or self.memory_snapshots[-1] != snap:
                self.memory_snapshots.append(snap)
                event["memory"] = snap
        self.events.append(event)

    def to_dict(self, result=None) -> dict[str, Any]:
        return {
            "title": self.title,
            "events": self.events,
            "tool_surface": self.tool_surface,
            "final_memory": self._memory.all() if self._memory is not None else {},
            "output": getattr(result, "output", None),
            "stopped_reason": getattr(result, "stopped_reason", None),
            "duration": round(time.time() - self.started, 3),
        }


def _added(surface: list[list[str]]) -> list[str]:
    if len(surface) < 2:
        return []
    return [n for n in surface[-1] if n not in surface[-2]]
