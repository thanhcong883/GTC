# Continuity — the agent kit

Ten MindPal agents that take a brief and produce a gate report: a script, a scene plan
with a price on every scene, six reviews, and one decision about what a human needs to
see before anything gets rendered.

Build it in about an hour. A full run is roughly 25–35 credits and three minutes.

---

## Files

| File | What it is |
|---|---|
| `cut-schema.md` | **Read first.** The Cut — the one object everything else reads and writes. Field reference, three invariants, and a complete worked example |
| `prompts.md` | The ten system prompts, the model-and-temperature table, and the MindPal wiring |
| `checker.md` | The tenth node in detail: authority table, conflict priority, three prohibitions, audit schema |
| `example-run.md` | One end-to-end run, recorded verbatim |
| `../cut.html` | The deterministic half — validates a Cut, prices it, builds the payloads, merges the findings back |

---

## The ten nodes

```
brief + sources + brand rules + ceiling
        │
   ─── COMPOSE ───
   N1  📋 Intake          three clarifying questions, each with a default
   N2  ✍️ Writer           ~150 words of Vietnamese script
   N3  🎬 Scene planner    → the Cut
        │
        ├──►  cut.html — validate, price, build payloads
        │
   ─── REVIEW ───
   N4  💰 Budget          recomputed cost against the stage ceiling
   N5  🏷 Brand            banned phrases, address form, disclaimers
   N6  🎭 Ratio            talking-head share against the band
   N7  📎 Claim sourcing   every claim traced; undeclared claims found
   N8  ⚖️ Overclaim        absolutes, guarantees, comparative advertising
   N9  🕵️ Red team          what the five lenses structurally could not see
        │
   N10 🎯 Checker          authority table → blockers, proposals, advisories
```

MindPal runs nodes sequentially. The five lenses share an input, not a moment in time.

---

## The three ideas

**1. The agent writes a document, not a video.**
The Cut is a structured object a deterministic renderer builds into an MP4. Nothing here
ever touches a video file. That is what makes a local edit cheap, a diff possible, and a
review meaningful — you can approve a plan before paying for pixels.

**2. Three fields nobody else records.**
Every scene declares which engine it uses **and why**, what it will **cost**, and every
factual **claim** it asserts with the source behind it. Strip those three and the Cut is
an ordinary edit decision list, and those are free and already solved.

**3. The Checker proposes; it never acts.**
Every node here runs on a language model, this one included. The obvious objection is *an
LLM checking an LLM*. The answer is not that the models are reliable — it is that a
fabricated finding costs a human five seconds of reading rather than a wrong edit to
their video. Removing the ability to act collapses the worst case from "silently changed
your script" to "wasted a moment of your attention."

---

## Where the money goes

Gates are ordered by cumulative spend, because that is the only ordering that makes
review worth doing:

| Gate | What the human sees | Spent so far |
|---|---|---|
| **1 · the words** | Script, scene plan, committee flags, two voice samples, two avatar stills | ~$0.38 |
| **· the animatic** | The whole video at full length — real voice, text cards, no imagery | ~$0.47 |
| **2 · the draft** | Full render with still b-roll, editable in place | $1–4 |
| **· upgrade** | Generated video, on approved scenes only | +$2–8 |

The animatic is nearly free because the audio — the expensive part — was already paid
for at gate 1. It catches the errors reading cannot: pacing, ordering, a scene that says
the same thing as the one before it.

---

## Building it

1. Read `cut-schema.md`. Nothing else makes sense first.
2. Fill in the model table at the top of `prompts.md` with the models your account
   actually has. **Pin them. Never use Auto** — it costs 2.5× and hides which model ran.
3. Create ten agents, paste the system prompts, wire the Task fields per `prompts.md` §15.
4. Check every `@variable` renders **purple**. A hand-typed reference does not bind, and
   the run fails without saying so.
5. Publish as a Form. That public URL is the live agent.
6. Open `../cut.html`, load the VéXe example, and confirm you get $5.30 recomputed against
   an authored $3.87. If those two numbers match, something is wrong.

---

## Latency budget

Wall-clock time from brief to gate report, measured on a single-run basis. The five
lenses share an input and run sequentially on MindPal — a parallel-capable orchestrator
would cut the Review row roughly in half.

| Phase | Nodes | Wall time | Notes |
|---|---|---|---|
| **Compose** | N1 → N2 → N3 | ~25–40 s | N2 (Claude Opus 5) is the slowest; ~10–15 s for 150 words |
| **Validate** | `cut.html` | < 50 ms | Deterministic; runs locally in the browser |
| **Review** | N4 → N5 → N6 → N7 → N8 (sequential on MindPal) | ~60–90 s | N7 (Opus 5, long context) dominates; Flash nodes ~2–4 s each |
| **Red team** | N9 | ~12–15 s | Reads all five lens reports + the Cut |
| **Checker** | N10 | ~5–8 s | Mapping, not reasoning |
| **Total to gate report** | — | **~2–3 min** | |

Post-approval generation (not part of the agent run):

| Step | Service | Latency | Cost | Source |
|---|---|---|---|---|
| Voice synthesis | ElevenLabs Flash v2.5 | **~75 ms** inference; < 500 ms TTFB | $0.05 / 1 k chars | [elevenlabs.io/pricing](https://elevenlabs.io/pricing) |
| Avatar render | HeyGen API | **~10 min** per 1 min of video (queue-dependent) | $0.50–$0.99 / credit | [heygen.com/pricing](https://www.heygen.com/pricing) |
| B-roll / Visuals | Runway API (credit-based) | minutes (model-dependent) | $0.01 / credit | [runwayml.com/developers](https://www.runwayml.com/developers) |
| HTML render | Hyperframes (local) | seconds | ~$0.02 / s (compute) | — |
| Assembly + export | FFmpeg | ~1–2 min | $0 | — |

The bottleneck is avatar rendering. Everything else finishes in seconds. This is why the
gate system exists — catching a bad claim *before* a $3–$8 avatar render is the
difference between a three-cent fix and a three-dollar one.

---

## Voice → Assembly pipeline

Why audio comes first, and how timestamps drive everything downstream.

**1. Text-to-Speech → Word-Level Timestamps.**
ElevenLabs (or any TTS with word-level alignment) takes `dialogue_vi` and returns two
things: an audio file and an array of `{ word, start_s, end_s }`. That array is the
master clock — every visual element is positioned against it.

**2. Audio → Avatar lip-sync.**
The audio file is the control signal for HeyGen's diffusion model. The model generates
a video whose mouth movements are synchronised to the waveform. No separate timestamp
handoff is needed — the audio *is* the timing.

**3. Timestamps → Subtitles.**
Word-level timestamps produce karaoke-style captions: each word highlights as it is
spoken. This is the current TikTok/Reels standard for muted-autoplay engagement.

**4. FFmpeg deterministic assembly.**
FFmpeg receives all tracks — audio, avatar video, b-roll clips, subtitle file (.ass) —
and concatenates them using `-ss` (frame-exact seeking) driven by each scene's
`duration_s` from the Cut. Same JSON → same video, byte-for-byte. Loudness is normalised
to −14 LUFS (the platform standard for short-form).

**5. Cache invalidation (I3).**
The scene hash covers `dialogue_vi ‖ engine.id ‖ engine.params` but deliberately excludes
`duration_s`, `cost`, and `approval`. Re-timing or re-pricing a scene does not invalidate
a rendered asset. Changing what is *said* or *how it is made* does. This is why editing
one scene costs one scene's render, not the whole video's.

---

## What this is not

**Not an end-to-end pipeline.** MindPal's Public API is paywalled, so the hop between N3
and the lenses is a copy-paste through `cut.html`. Said plainly rather than dressed up.

**Not tested at scale.** One example run, recorded honestly. There is no eval suite here,
no recall figure, no false-positive rate. `example-run.md` is a demonstration, not
evidence of reliability.

**Not counsel.** N8 reads Vietnamese advertising law and cites provisions. That is a
prompt with a knowledge source attached, not a lawyer.

**Not able to price itself accurately.** Every engine rate in the price book is marked
`assumed`. The arithmetic on top of them is exact; the rates underneath are estimates
until someone runs a real render and measures.
