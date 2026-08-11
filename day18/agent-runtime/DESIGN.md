# Design Note — A Self-Extending Agent Runtime

An LLM API is stateless: you send messages, you get one reply. An **agent
runtime** is the thin layer that turns that single reply into autonomous,
multi-step work — by letting the model call tools, running them, feeding the
results back, and looping until the task is done. This runtime does exactly
that, and nothing it doesn't need to.

Then it does one thing more. The usual framing is that an agent's memory holds
**facts**. This one also lets it hold **skills**: when the built-in tools can't
do what a task needs, the agent *writes a new tool for itself*, registers it
into the live registry, calls it on the very next step, and keeps it for future
sessions. Its capabilities accumulate instead of resetting.

Sections 1–3 cover what the task asks for — the **loop**, the **tool
interface**, **memory**. Section 4 covers the harness details that make the loop
correct rather than merely plausible. Section 5 covers the provider boundary —
the runtime's internal contract is its own, not any one vendor's, and OpenAI is
wired in through a translation layer that proves it. Sections 6–8 cover the
self-extension, the trace viewer that makes it visible, and running it for real.

---

## 1. The orchestration loop

`Agent.run(task)` in `runtime.py` is the whole engine:

```
add the user's task to working memory
repeat up to max_steps:
    response = model(system, messages, tools)
    append the response to working memory        # BEFORE acting on it
    if response is not asking for tools:
        return its text                          # the model is done
    for each tool the model asked for:
        result = run it
        collect a tool_result (carrying the tool's id)
    append ALL results as ONE user message
stop: hit max_steps                              # guaranteed termination
```

The pivot is the model's `stop_reason`. When it is `"tool_use"`, the model has
paused to ask for information or action; we supply it and call back. Any other
stop reason means the model has produced its answer and the loop ends. That
`while` is the entire difference between "a chatbot" and "an agent".

**Why a hand-written loop and not a vendor SDK's tool-runner?** Because the task
is partly about showing *understanding of the harness*. Owning the loop makes
the API contract visible and gives natural seams for the things a real harness
needs: a step cap, per-step tracing (`on_event`), a serializable transcript, and
total control over how tool errors are handled.

---

## 2. The tool interface

A tool (`tools.py`) is four things:

| Field | Purpose |
|---|---|
| `name` | how the model addresses it |
| `description` | **how the model decides when to call it** — the most load-bearing field |
| `input_schema` | JSON Schema the model fills in; the API validates the shape |
| `fn` | the Python function that actually does the work |

`ToolRegistry` turns the registered tools into the schema list the API expects
(`schemas()`) and routes a call to the right function (`dispatch(name, input)`).
The built-in kit (`build_default_tools`) is deliberately small but genuinely
useful: `calculator`, `list_files` / `read_file` / `write_file`, and
`remember` / `recall`.

Two decisions make the interface robust:

- **Failures are data, not exceptions.** `dispatch` never lets a tool throw into
  the loop. A missing file, bad arguments, an unknown tool, or a raised exception
  all come back as a `ToolResult(is_error=True)`. That result is fed to the model
  as a normal `tool_result` with `is_error: true` — the same contract the model
  already understands — so it can read the error and recover (retry, pick another
  tool, or explain the problem). `test_tool_error_is_recoverable` pins this.
- **Actions are sandboxed at a single choke point.** Every file tool goes through
  `Workspace`, which resolves any model-supplied path and confines it to the
  workspace root, so `read_file("../../etc/passwd")` is rejected. The calculator
  is a whitelist-only AST evaluator (no names, no builtins) — `2 ** 10` works,
  `__import__('os')` does not.

Adding a tool is one decorator:

```python
@registry.add("weather", "Get current weather for a city.",
              {"type": "object", "properties": {"city": {"type": "string"}},
               "required": ["city"]})
def weather(city): ...
```

---

## 3. Memory

Agents need two kinds of memory, and conflating them is a common mistake, so
`memory.py` keeps them separate:

**Working memory** is the `messages` list — the running transcript of *this*
task: the user turn, each assistant turn (text + tool_use), and each batch of
tool results, in order. Because the API is stateless, this list *is* the
conversation; the loop rebuilds the full context on every call. It is large,
ephemeral, and thrown away when the task ends.

**Long-term memory** is a small key/value store persisted to JSON on disk. It
survives across sessions and is curated **by the model itself** through the
`remember` and `recall` tools. On startup its contents are rendered into the
system prompt (`memory_briefing`), so the agent begins each session already
aware of what it learned before. It is small, durable, and deliberately
model-managed. `test_long_term_memory_persists_across_sessions` shows a fact
written in one session being recalled by a brand-new `Memory` in the next.

The split matters: working memory is *context* (reconstructed per task);
long-term memory is *knowledge* (accumulated across tasks).

---

## 4. Harness correctness (why this is "real")

The loop honors invariants that separate a correct harness from a demo that
happens to work once. The first two are about the runtime's **own** internal
contract — `Memory.messages`, the block-shaped list every module above the LLM
boundary reads and writes — not any one vendor's wire format (that distinction
matters and gets its own section next):

1. **Append the model's whole response before acting.** The assistant turn —
   text and every `tool_use` block — is added to working memory before tools
   run, and every `tool_use` must survive to be matched by its result. The
   internal shape also has a `thinking` block type reserved for a reasoning
   backend that needs to replay it verbatim on the next turn — real for
   providers that expose it, unused by the current OpenAI backend, which
   doesn't surface reasoning content this way.
2. **One `tool_result` per `tool_use`, batched into a single user turn** — in
   the runtime's *internal* representation (`test_parallel_tool_calls_single_result_message`
   pins this). Whether that survives as one wire message or gets split into
   several is a **provider decision**, not this runtime's — see §5.
3. **Guaranteed termination.** `max_steps` bounds the loop, so a model that keeps
   calling tools forever still stops with `stopped_reason == "max_steps"` instead
   of running unbounded (`test_max_steps_termination`).
4. **A swappable backend.** The loop depends only on a two-line interface
   (`create(system, messages, tools) -> LLMResponse`). `ScriptedLLM` replays a
   fixed trajectory so the *entire* runtime — loop, tools, memory, termination —
   is testable offline with no API key. That is why this repo ships dozens of
   passing tests that need no network.

---

## 5. The provider boundary — OpenAI as a translation layer

Point 4 above claims a swappable backend. `OpenAILLM` (`llm.py`) is what makes
that claim checkable rather than aspirational: it's a **translation layer**,
not a reimplementation. `runtime.py`, `tools.py`, `toolsmith.py`, `memory.py`,
and the trace/visualizer never see OpenAI's wire format at all — they only ever
read and write the block-shaped internal representation from §4. `OpenAILLM`
converts in both directions on every call, and the two directions expose two
real, independently-discovered contract differences worth naming:

- **System prompt placement.** The internal shape treats `system` as its own
  parameter. OpenAI's Chat Completions API has no such parameter — it's just
  `{"role": "system", ...}` as the first entry in one flat `messages` array.
  `_to_openai_messages` prepends it.
- **Tool-result batching, resolved oppositely.** §4 point 2 pins the internal
  invariant: all of a turn's `tool_result` blocks live in **one** user message.
  That is also literally correct for a hypothetical Anthropic backend. OpenAI
  wants the **opposite**: each tool result is its own message,
  `{"role": "tool", "tool_call_id": ..., ...}`, matched to its call by ID.
  `_to_openai_messages` fans the internal batch out into N separate messages;
  getting this backwards produces a 400, not a subtle bug —
  `test_tool_result_becomes_its_own_tool_role_message` pins the fan-out.
- **`finish_reason` vocabulary.** OpenAI's signal that the model wants to call
  a tool is `finish_reason == "tool_calls"`; the rest of this runtime is
  written against `stop_reason == "tool_use"`. `_from_openai_message`
  normalizes at the boundary — `runtime.py` never changes, never even knows
  which vendor answered.

None of this is decorative. It is what "true understanding of the harness"
has to mean once "the harness" isn't a single vendor's document anymore: the
loop's contract — append-before-acting, one result per call, a stop signal that
means "give me more" vs. "I'm done" — is the invariant. The bytes on the wire
that satisfy it are not, and are worth getting exactly right in each direction.
`test_openai_backend.py` exercises both directions with fake OpenAI-shaped
objects, so none of this depended on a live call to verify the translation
itself.

**Two bugs actually running this found — offline tests couldn't have caught
either:**

- An uncaught `openai.APIConnectionError` (network down, a proxy blocking the
  host, DNS failure) originally fell through as a 20-line SDK/httpx traceback
  instead of a one-line, actionable message. Fixed by widening `create()`'s
  exception handling (`APIConnectionError` specifically, `APIError` as a
  catch-all) into the same `LLMConfigError` contract already used for missing
  credentials — the "failures are data, not a crash" principle from §2 applied
  to the backend boundary too. `test_connection_error_becomes_config_error`
  and `test_generic_api_error_becomes_config_error` pin it with injected real
  `openai` exception types, no network required to keep it pinned.
- Running the CLI on Windows (`python -m agent_runtime --demo`) raised
  `UnicodeEncodeError` the moment the trace printer tried to write `🤖` — a
  default Windows console codepage (`cp1252`) can't encode it, and nothing
  about that shows up running the same code on Linux or in a test suite that
  never touches a real console. Fixed with an unconditional
  `sys.stdout.reconfigure(encoding="utf-8")` at the top of `cli.py`. Cheap,
  platform-general, and the kind of bug that specifically rewards *actually
  running the program* over trusting that green tests mean it works everywhere.

---

## 6. Self-extending tools

`toolsmith.py` adds one meta-tool, `create_tool(name, description,
input_schema, code)`. The agent supplies a tool definition *and its Python
implementation*; the runtime screens the code, executes it, registers the
result, and writes it to `<workspace>/.tools/`. Learned skills are re-registered
at startup, so a tool invented on Monday is available on Tuesday.

**The bug that makes or breaks this.** The natural way to write the loop is:

```python
schemas = self.tools.schemas()     # ← hoisted out of the loop
for _ in range(max_steps):
    resp = self.llm.create(system=..., messages=..., tools=schemas)
```

That is subtly, permanently broken here. A tool created at step 2 would never
appear in the schema list, so the model could never call the thing it just
wrote. The loop **recomputes `self.tools.schemas()` on every iteration**. It's
one line, and it is the entire feature.

**The cost, stated honestly.** Tools render at the *front* of the prompt prefix
in most vendor APIs, so mutating them mid-conversation risks invalidating a
prompt cache from that point onward — every cached token of the conversation
gets re-processed on the turn a tool is added. For a runtime this size that's
the right trade; at scale it isn't, and at least one vendor API has a
purpose-built answer (declare tools up front with deferred loading, surface
them later via a dedicated event, preserving the cached prefix). This runtime
takes the simple path and states the cost rather than pretending it's free.

**On the sandbox.** Executing model-authored code is the genuinely dangerous
part, so the screening is layered: an AST pre-scan rejects imports outside a
small pure-computation allowlist, dunder attribute access (the classic
`().__class__.__bases__[0].__subclasses__()` escape), and `eval`/`exec`/`open`/
`__import__`; execution then happens in a namespace with a stripped
`__builtins__`. Multiple tests cover the rejection paths.

That raises the cost of an escape considerably — and it is **not a security
boundary**, which the code says in as many words. In-process execution of
untrusted code in CPython has too many reachable paths for a static screen to be
airtight. Running this against untrusted input in production means real
isolation: a subprocess with dropped privileges, seccomp/gVisor, or a container
per call. The interface wouldn't change; only `_compile` would be swapped for an
out-of-process runner. Claiming otherwise would be the most dangerous line in
this document.

## 7. Seeing the loop

An agentic loop is hard to reason about from a log. `trace.py` hangs a recorder
off the loop's existing `on_event` seam and captures a structured, JSON-able
record: every model turn, tool call, and result — plus **tool-surface
snapshots**. `viz.py` renders it into a single self-contained HTML page (inline
CSS/JS, no CDN, no network at view time) that you step through with ← / →.

The tool-surface panel is the reason it exists. A list of tool calls tells you
what the agent *did*; watching the panel gain an entry mid-run tells you what
the agent *became*. Run `python -m agent_runtime --demo --trace trace.html` and
the timeline shows the moment: **✦ tool surface grew — the agent wrote itself:
`word_count`**.

## 8. Running it for real, interactively

`python -m agent_runtime "task"` runs one real task against OpenAI and exits.
`--chat` (`cli.py`) is a REPL for a whole session of tasks: prompt `Task:`, run
it to completion with live tracing to the terminal, prompt again — `exit` or
Ctrl-D to stop.

The REPL is where the working/long-term memory split from §3 stops being an
abstract design point and becomes a concrete UX decision. Each task gets a
**clean transcript** — `Memory.reset_working()` clears `messages` between loop
iterations, so task 2 doesn't silently inherit task 1's entire conversation as
hidden context. But the `Memory` object, its long-term store, and the
`ToolRegistry` are never recreated across iterations — a fact remembered or a
tool written in task 1 is already there when task 3 starts. One session, one
growing skillset, many independent tasks.

## What was left out (on purpose)

Streaming, context compaction/editing, concurrency, and subagents are all real
harness concerns — and all beyond "minimal". The interfaces here leave room for
them (the transcript is serializable for compaction; `on_event` is where a
streaming UI would hook in; the registry is where tool-search would slot), but
adding them would trade the one virtue the task asked for — *minimal* — for
breadth it didn't. The line drawn is: everything needed to complete a multi-step
task correctly, nothing past it.

One more worth naming, because self-extension invites it: an agent that writes
tools will eventually write *bad* tools, and nothing here judges quality. A
learned skill is never reviewed, benchmarked, or retired — the surface only
grows. A real version of this needs eviction and evaluation (does the tool still
work? is it ever called? did a better one replace it?). That is a genuinely
interesting problem and squarely outside "minimal".
