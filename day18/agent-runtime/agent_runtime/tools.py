"""The tool interface and a small set of built-in tools.

A *tool* is the unit of action the model can take. Each one is: a name, a
human-readable description (the model reads this to decide when to call it), a
JSON Schema for its arguments, and a Python function that executes it. Tools are
registered in a ``ToolRegistry`` which turns them into the schema list the API
expects and dispatches calls by name.

Design choices worth noting:
  - Dispatch never raises into the loop. A tool that blows up (bad args, missing
    file, thrown exception) comes back as an *error result* the model can read
    and recover from — the same contract the model already understands.
  - Tools return a ``ToolResult``; a bare string is auto-wrapped for convenience.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class ToolResult:
    content: str
    is_error: bool = False


ToolFn = Callable[..., Any]


class Tool:
    def __init__(self, name: str, description: str, input_schema: dict[str, Any], fn: ToolFn) -> None:
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.fn = fn

    def schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"duplicate tool: {tool.name}")
        self._tools[tool.name] = tool

    def add(self, name: str, description: str, input_schema: dict[str, Any]) -> Callable[[ToolFn], ToolFn]:
        """Decorator form: ``@registry.add("name", "desc", schema)``."""

        def deco(fn: ToolFn) -> ToolFn:
            self.register(Tool(name, description, input_schema, fn))
            return fn

        return deco

    def schemas(self) -> list[dict[str, Any]]:
        return [t.schema() for t in self._tools.values()]

    def names(self) -> list[str]:
        return list(self._tools)

    def has(self, name: str) -> bool:
        return name in self._tools

    def dispatch(self, name: str, tool_input: dict[str, Any]) -> ToolResult:
        """Run a tool by name. All failure modes become error results, never
        exceptions — the loop feeds them back to the model verbatim."""
        tool = self._tools.get(name)
        if tool is None:
            return ToolResult(f"Unknown tool '{name}'. Available: {', '.join(self._tools)}", is_error=True)
        try:
            out = tool.fn(**tool_input)
        except TypeError as e:
            return ToolResult(f"Bad arguments for '{name}': {e}", is_error=True)
        except Exception as e:  # noqa: BLE001 - deliberately broad; surface to the model
            return ToolResult(f"Tool '{name}' failed: {type(e).__name__}: {e}", is_error=True)
        if isinstance(out, ToolResult):
            return out
        return ToolResult(str(out))


# --- built-in tools -----------------------------------------------------------

def _obj(**props: dict[str, Any]) -> dict[str, Any]:
    required = [k for k, v in props.items() if not v.pop("_optional", False)]
    return {"type": "object", "properties": props, "required": required}


def build_default_tools(workspace, memory, *, self_extending: bool = True) -> ToolRegistry:
    """Wire up a useful starter kit against a sandboxed ``workspace`` (a
    :class:`~agent_runtime.workspace.Workspace`) and a ``memory`` store.

    With ``self_extending`` (the default) the agent also gets ``create_tool`` and
    any skills it wrote in previous sessions are reloaded — so its capabilities
    accumulate over time rather than resetting each run.
    """
    reg = ToolRegistry()

    @reg.add(
        "calculator",
        "Evaluate a single arithmetic expression and return the numeric result. "
        "Supports + - * / ** %, parentheses, and floats. Use this instead of doing math yourself.",
        _obj(expression={"type": "string", "description": "e.g. '19.99 * 3 + 4.50'"}),
    )
    def calculator(expression: str):
        return str(_safe_eval(expression))

    @reg.add(
        "list_files",
        "List the files in the workspace directory.",
        _obj(),
    )
    def list_files():
        files = workspace.list()
        return "\n".join(files) if files else "(workspace is empty)"

    @reg.add(
        "read_file",
        "Read a UTF-8 text file from the workspace and return its contents.",
        _obj(path={"type": "string", "description": "path relative to the workspace root"}),
    )
    def read_file(path: str):
        return workspace.read(path)

    @reg.add(
        "write_file",
        "Write (or overwrite) a UTF-8 text file in the workspace.",
        _obj(
            path={"type": "string", "description": "path relative to the workspace root"},
            content={"type": "string", "description": "full file contents to write"},
        ),
    )
    def write_file(path: str, content: str):
        n = workspace.write(path, content)
        return f"Wrote {n} bytes to {path}"

    @reg.add(
        "remember",
        "Save a fact to long-term memory under a key, so it survives across sessions. "
        "Use for durable facts, user preferences, and conclusions worth keeping.",
        _obj(
            key={"type": "string"},
            value={"type": "string"},
        ),
    )
    def remember(key: str, value: str):
        memory.remember(key, value)
        return f"Remembered '{key}'."

    @reg.add(
        "recall",
        "Look up a fact previously saved to long-term memory. Returns the value, or a not-found note.",
        _obj(key={"type": "string"}),
    )
    def recall(key: str):
        val = memory.recall(key)
        return val if val is not None else f"No memory found for '{key}'."

    if self_extending:
        # Imported here to keep the import graph acyclic (toolsmith imports us).
        from .toolsmith import mount_toolsmith

        mount_toolsmith(reg, workspace.root / ".tools")

    return reg


# A deliberately small, safe arithmetic evaluator (no builtins, no names).
import ast
import operator as _op

_OPS = {
    ast.Add: _op.add,
    ast.Sub: _op.sub,
    ast.Mult: _op.mul,
    ast.Div: _op.truediv,
    ast.Pow: _op.pow,
    ast.Mod: _op.mod,
    ast.USub: _op.neg,
    ast.UAdd: _op.pos,
}


def _safe_eval(expr: str) -> float | int:
    def ev(node: ast.AST):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.operand))
        raise ValueError("unsupported expression")

    return ev(ast.parse(expr, mode="eval").body)
