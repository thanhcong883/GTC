"""The memory system.

Two layers, because agents need two different kinds of memory:

1. **Working memory** — the running list of messages for *this* task. It is the
   model's context window: user turns, assistant turns (text + tool_use), and
   tool results, in order. The loop reads and appends to it every step; the API
   is stateless, so this list *is* the conversation.

2. **Long-term memory** — a small key/value store that persists to disk as JSON
   and survives across sessions. The model reads and writes it through the
   ``remember`` / ``recall`` tools. This is how the agent carries facts and
   preferences from one run to the next.

Keeping them separate matters: working memory is large, ephemeral, and rebuilt
each task; long-term memory is small, durable, and curated by the model itself.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class Memory:
    def __init__(self, store_path: str | Path | None = None) -> None:
        # Working memory: the transcript the loop feeds to the model.
        self.messages: list[dict[str, Any]] = []
        # Long-term memory: durable key/value facts.
        self._store_path = Path(store_path) if store_path else None
        self._store: dict[str, str] = self._load()

    # --- working memory -------------------------------------------------------

    def add_user(self, content: Any) -> None:
        self.messages.append({"role": "user", "content": content})

    def add_assistant(self, content: list[dict[str, Any]]) -> None:
        self.messages.append({"role": "assistant", "content": content})

    def reset_working(self) -> None:
        """Clear the transcript so the next task starts with a clean slate.

        Used by the REPL between tasks: each task gets its own conversation
        rather than accumulating into one ever-growing history, while
        long-term memory (below) and the tool registry it's paired with are
        untouched — what the agent *learned* persists; what it was *doing*
        does not."""
        self.messages = []

    # --- long-term memory -----------------------------------------------------

    def remember(self, key: str, value: str) -> None:
        self._store[key] = value
        self._save()

    def recall(self, key: str) -> str | None:
        return self._store.get(key)

    def all(self) -> dict[str, str]:
        return dict(self._store)

    def _load(self) -> dict[str, str]:
        if self._store_path and self._store_path.exists():
            try:
                return json.loads(self._store_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return {}
        return {}

    def _save(self) -> None:
        if self._store_path:
            self._store_path.parent.mkdir(parents=True, exist_ok=True)
            self._store_path.write_text(json.dumps(self._store, indent=2), encoding="utf-8")

    def memory_briefing(self) -> str:
        """A compact rendering of long-term memory to seed the system prompt, so
        the agent starts each session already aware of what it knows."""
        if not self._store:
            return "(long-term memory is empty)"
        return "\n".join(f"- {k}: {v}" for k, v in self._store.items())
