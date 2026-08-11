"""A sandboxed directory the file tools operate inside.

Every path the model supplies is resolved and confined to the workspace root, so
``read_file("../../etc/passwd")`` can't escape. This is the single choke point
for filesystem access — the tools never touch ``open()`` directly.
"""

from __future__ import annotations

from pathlib import Path


class Workspace:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, path: str) -> Path:
        p = (self.root / path).resolve()
        if p != self.root and self.root not in p.parents:
            raise ValueError(f"path '{path}' escapes the workspace")
        return p

    def list(self) -> list[str]:
        """User-visible files. Dot-directories (e.g. the runtime's own `.tools`
        skill store) are internal bookkeeping and stay out of the model's view."""
        return sorted(
            str(p.relative_to(self.root))
            for p in self.root.rglob("*")
            if p.is_file() and not any(part.startswith(".") for part in p.relative_to(self.root).parts)
        )

    def read(self, path: str) -> str:
        p = self._resolve(path)
        if not p.is_file():
            raise FileNotFoundError(f"no such file: {path}")
        return p.read_text(encoding="utf-8")

    def write(self, path: str, content: str) -> int:
        p = self._resolve(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p.write_text(content, encoding="utf-8")
