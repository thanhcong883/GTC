"""Self-extending tools: the agent writes new tools for itself, mid-task.

The thesis: an agent's memory shouldn't only hold *facts* — it should hold
*skills*. When the built-in tools can't do what a task needs, the agent writes a
new Python tool, registers it into the live registry, and calls it on the very
next step. The tool is persisted to disk, so the capability survives into future
sessions. The tool surface grows over time.

Two things make this work, and both live in the harness rather than the model:

1. The loop must recompute the tool schemas **every iteration** (see
   ``runtime.py``). Compute them once up front — the obvious way to write the
   loop — and a tool created at step 2 is invisible forever.
2. Model-authored code has to be screened before it runs. ``_screen`` does an
   AST pre-scan and execution happens with a stripped ``__builtins__``. This is
   defense-in-depth, **not** a real sandbox — see the note at the bottom.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Any

from .tools import Tool, ToolRegistry, ToolResult

# Modules a generated tool may import. Everything here is pure computation:
# no filesystem, no network, no process control.
ALLOWED_IMPORTS = {"math", "json", "re", "datetime", "statistics", "itertools", "collections"}

# Names that are never allowed to appear in generated code. These are the usual
# escape hatches out of a restricted namespace.
BANNED_NAMES = {
    "exec", "eval", "compile", "open", "__import__", "input",
    "globals", "locals", "vars", "getattr", "setattr", "delattr",
    "breakpoint", "memoryview",
}

CREATE_TOOL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "snake_case tool name, e.g. 'word_count'",
        },
        "description": {
            "type": "string",
            "description": "What the tool does and when to use it. You will read this later to decide when to call it.",
        },
        "input_schema": {
            "type": "object",
            "description": "JSON Schema for the tool's arguments: an object with 'type', 'properties', and 'required'.",
        },
        "code": {
            "type": "string",
            "description": (
                "Python source defining exactly one top-level function whose name matches 'name'. "
                "Its parameters must match the schema's properties. It must return a string. "
                "You may import only: " + ", ".join(sorted(ALLOWED_IMPORTS)) + ". "
                "No file, network, or process access."
            ),
        },
    },
    "required": ["name", "description", "input_schema", "code"],
}


class ToolSmithError(Exception):
    """Raised when proposed tool code is rejected. Surfaced to the model as a
    normal error result so it can read the reason and try again."""


def _screen(code: str, expected_name: str) -> ast.FunctionDef:
    """Static screening of model-authored code. Returns the function node."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ToolSmithError(f"syntax error: {e}") from e

    funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
    if len(funcs) != 1:
        raise ToolSmithError(
            f"code must define exactly one top-level function (found {len(funcs)})"
        )
    fn = funcs[0]
    if fn.name != expected_name:
        raise ToolSmithError(f"function is named '{fn.name}' but the tool name is '{expected_name}'")

    for node in ast.walk(tree):
        # Imports: allowlist only.
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in ALLOWED_IMPORTS:
                    raise ToolSmithError(f"import of '{alias.name}' is not allowed")
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root not in ALLOWED_IMPORTS:
                raise ToolSmithError(f"import from '{node.module}' is not allowed")
        # Dunder attribute access is the classic sandbox escape
        # (``().__class__.__bases__[0].__subclasses__()``).
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith("__") and node.attr.endswith("__"):
                raise ToolSmithError(f"access to dunder attribute '{node.attr}' is not allowed")
        # Banned builtins, referenced by name.
        elif isinstance(node, ast.Name) and node.id in BANNED_NAMES:
            raise ToolSmithError(f"use of '{node.id}' is not allowed")
    return fn


# A deliberately small set of builtins available to generated tools.
_SAFE_BUILTINS = {
    k: __builtins__[k] if isinstance(__builtins__, dict) else getattr(__builtins__, k)
    for k in (
        "abs", "all", "any", "bool", "dict", "divmod", "enumerate", "filter",
        "float", "int", "len", "list", "map", "max", "min", "range", "repr",
        "reversed", "round", "set", "sorted", "str", "sum", "tuple", "zip",
        "isinstance", "ValueError", "TypeError", "KeyError", "IndexError", "Exception",
    )
}


def _compile(code: str, name: str):
    """Execute screened code in a restricted namespace and return the function."""
    namespace: dict[str, Any] = {"__builtins__": _SAFE_BUILTINS}
    try:
        exec(compile(code, f"<tool:{name}>", "exec"), namespace)  # noqa: S102
    except Exception as e:  # noqa: BLE001
        raise ToolSmithError(f"code failed to load: {type(e).__name__}: {e}") from e
    fn = namespace.get(name)
    if not callable(fn):
        raise ToolSmithError(f"no callable named '{name}' after executing the code")
    return fn


class ToolSmith:
    """Creates, persists, and reloads agent-authored tools."""

    def __init__(self, registry: ToolRegistry, skills_dir: str | Path) -> None:
        self.registry = registry
        self.dir = Path(skills_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    # --- creation ------------------------------------------------------------

    def create(self, name: str, description: str, input_schema: dict[str, Any], code: str) -> str:
        if not name.isidentifier():
            raise ToolSmithError(f"'{name}' is not a valid Python identifier")
        if self.registry.has(name):
            raise ToolSmithError(f"a tool named '{name}' already exists")
        if not isinstance(input_schema, dict) or input_schema.get("type") != "object":
            raise ToolSmithError("input_schema must be a JSON Schema object with type 'object'")

        _screen(code, name)
        fn = _compile(code, name)
        self.registry.register(Tool(name, description, input_schema, fn))
        self._persist(name, description, input_schema, code)
        return name

    def _persist(self, name: str, description: str, input_schema: dict[str, Any], code: str) -> None:
        (self.dir / f"{name}.py").write_text(code, encoding="utf-8")
        (self.dir / f"{name}.json").write_text(
            json.dumps({"name": name, "description": description, "input_schema": input_schema},
                       indent=2),
            encoding="utf-8",
        )

    # --- reload across sessions ---------------------------------------------

    def load_learned(self) -> list[str]:
        """Re-register every previously learned tool. Called at startup, this is
        what makes a skill outlive the session that invented it."""
        loaded: list[str] = []
        for meta_path in sorted(self.dir.glob("*.json")):
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                code = (self.dir / f"{meta['name']}.py").read_text(encoding="utf-8")
                name = meta["name"]
                if self.registry.has(name):
                    continue
                _screen(code, name)  # re-screen on load; the file could have been edited
                fn = _compile(code, name)
                self.registry.register(Tool(name, meta["description"], meta["input_schema"], fn))
                loaded.append(name)
            except (ToolSmithError, KeyError, OSError, json.JSONDecodeError):
                continue  # a corrupt skill must not stop the agent from starting
        return loaded


def mount_toolsmith(registry: ToolRegistry, skills_dir: str | Path) -> ToolSmith:
    """Register the ``create_tool`` meta-tool and reload learned skills."""
    smith = ToolSmith(registry, skills_dir)

    def create_tool(name: str, description: str, input_schema: dict[str, Any], code: str):
        try:
            created = smith.create(name, description, input_schema, code)
        except ToolSmithError as e:
            return ToolResult(f"Could not create tool: {e}", is_error=True)
        return ToolResult(
            f"Created tool '{created}'. It is available to call from your next step onward."
        )

    registry.register(Tool(
        "create_tool",
        "Write a brand-new tool for yourself when no existing tool can do what the task needs. "
        "Supply a name, a description, a JSON Schema for its arguments, and Python source defining "
        "one function of that name returning a string. The tool becomes callable on your next step "
        "and is saved for future sessions. Prefer existing tools when one already fits.",
        CREATE_TOOL_SCHEMA,
        create_tool,
    ))
    smith.load_learned()
    return smith


# --- on the security posture --------------------------------------------------
#
# ``_screen`` + stripped builtins raises the cost of an escape considerably, but
# in-process execution of model-authored code is not a security boundary, and
# calling it one would be dishonest. CPython has too many reachable paths for a
# static screen to be airtight. Running this against untrusted input in
# production means real isolation: a subprocess with dropped privileges, a
# seccomp/gVisor sandbox, or a container per call — the same posture Anthropic's
# own code-execution tool uses. The interface here would not change; only
# ``_compile`` would be swapped for an out-of-process runner.
