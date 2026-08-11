# agent-runtime

**Day 18 of the 30-Day Build Challenge** — a minimal but real agent runtime:
an orchestration loop, tool-calling, and memory, enough to complete a
multi-step task on its own.

Then one thing more. The usual framing is that an agent's memory holds *facts*.
This one also lets it hold **skills**: when no built-in tool can do what a task
needs, the agent **writes a new tool for itself**, registers it into the live
registry, calls it on the very next step, and keeps it for future sessions. Its
capabilities accumulate instead of resetting.

No framework. The runtime's internal contract is its own — not any vendor's —
and talks to **OpenAI** through a small translation layer, so the whole thing
also runs and is tested offline, with no API key, via a scripted backend.

> Read [`DESIGN.md`](./DESIGN.md) for the design note: the loop, the tool
> interface, how memory works, why self-extension hinges on one line in the
> loop, the OpenAI translation layer and the two real wire-format differences
> it bridges, and two real bugs that only actually running this (not the test
> suite) found — one live, one Windows-only.

## Quickstart

```bash
# Offline demo — no API key. The agent hits a gap in its tools and writes one.
python -m agent_runtime --demo

# ...and produce an interactive HTML replay of the run.
python -m agent_runtime --demo --trace trace.html

# Run the tests (39, all offline).
pip install pytest && python -m pytest tests/ -q
```

### Run it for real

```bash
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...

# One task, one shot.
python -m agent_runtime "Write three short lines to notes.txt, then count the words in it."

# Or the interactive REPL — enter tasks one at a time; 'exit' or Ctrl-D to quit.
python -m agent_runtime --chat
```

`--model` defaults to `gpt-4o` (also settable via `OPENAI_MODEL`) — override it
freely; by the time you're reading this the right default may have moved on,
which is exactly why it's a flag and not a hardcoded assumption.

In `--chat`, long-term memory and every tool the agent has learned persist for
the whole session; each task still gets its own clean working transcript, so
tasks don't silently pile into one giant conversation. See `DESIGN.md` §8.

The demo output shows the whole arc — read a file → discover no word-counting
tool exists → **write one** → call it → save the result to long-term memory:

```
tools at start: [calculator, list_files, read_file, write_file, remember, recall, create_tool]
🤖 I have no tool that counts words, so I'll write one for myself.
   ↳ tool: create_tool(name='word_count', ...)
     ✓ Created tool 'word_count'. It is available to call from your next step onward.
🤖 Now I can use the tool I just made.
   ↳ tool: word_count(text='the runtime loops until...')
     ✓ 10 words, 56 characters
tools at end:   [..., create_tool, word_count]
```

Run it a second time and `word_count` is already there at startup.

## What's here

| Path | What it is |
|------|-----------|
| `agent_runtime/runtime.py` | the orchestration loop (`Agent.run`) |
| `agent_runtime/tools.py` | tool interface, registry, built-in tools |
| `agent_runtime/toolsmith.py` | **self-extension**: `create_tool`, code screening, skill persistence |
| `agent_runtime/memory.py` | working memory + persistent long-term memory |
| `agent_runtime/workspace.py` | sandboxed filesystem for the file tools |
| `agent_runtime/trace.py` / `viz.py` | run recorder + self-contained HTML replay |
| `agent_runtime/llm.py` | swappable backend: real OpenAI (translation layer) + scripted |
| `agent_runtime/cli.py` | `--demo`, one-shot, and `--chat` REPL entry points |
| `tests/` | 39 offline end-to-end + translation-layer tests |
| `DESIGN.md` | the design note |

## Configuration

| Flag / env | Default | Meaning |
|---|---|---|
| `--model` / `OPENAI_MODEL` | `gpt-4o` | model for real runs |
| `--workspace` / `AGENT_WORKSPACE` | `./workspace` | sandboxed file directory |
| `--store` / `AGENT_MEMORY` | `./memory.json` | long-term memory file |
| `--trace PATH` | — | write an interactive HTML replay (one-shot mode) |
| `--trace-dir DIR` | — | write one numbered HTML replay per task (`--chat` mode) |

Learned skills live in `<workspace>/.tools/`. Delete that directory to give the
agent amnesia.

## Extending it yourself

Adding a tool by hand is one decorator:

```python
@registry.add("weather", "Get current weather for a city.",
              {"type": "object", "properties": {"city": {"type": "string"}},
               "required": ["city"]})
def weather(city):
    return f"Sunny in {city}."
```

## Two caveats worth reading

`create_tool` executes model-authored Python. The screening (AST allowlist,
stripped builtins, no dunder access) raises the bar considerably but is **not a
security boundary** — see the sandbox section of `DESIGN.md`. Don't point this
at untrusted input without real isolation.

An `OPENAI_API_KEY` typed into a shared or logged session (a remote dev
environment, a CI transcript) should be treated as compromised once used —
rotate it afterward.

---
Built with [Claude Code](https://claude.com/claude-code).
