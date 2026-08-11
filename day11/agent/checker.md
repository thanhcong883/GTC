# The Checker

The tenth node. It reads six lens reports and decides two things: what happens to each
finding, and what the human actually sees.

It is the only node with authority, and it has been deliberately given as little of it as
possible.

---

## 1. What it is not

**It does not judge the video.** Six lenses already did. The Checker never forms an
opinion about whether a claim is sourced, whether a phrase is on-brand, or whether the
budget works — it reads verdicts and looks them up.

**It does not act.** Every outcome is a proposal a human clicks. There is no autonomous
edit, no automatic downgrade, no silent correction.

That second constraint is the single strongest safety property in the system, and it is
worth being explicit about why. Every node here runs on a language model, including this
one. The obvious objection is *an LLM checking an LLM*. The answer is not that the models
are reliable — it is that **a fabricated finding costs a human five seconds of reading,
not a wrong edit to their video**. Take away the Checker's ability to act and the worst
case collapses from "silently changed your script" to "wasted a moment of your attention".

Everything else in this file follows from choosing that trade.

---

## 2. Authority table

The Checker looks up each finding's code. It does not invent actions. A code absent from
this table is surfaced as an advisory, labelled unrecognised.

| Code | Severity | Action | Why this action |
|---|---|---|---|
| `CLAIM_UNSOURCED` | blocker | **BLOCK** | Nobody can fix this but the author — either find the source or change the sentence. There is no safe automatic move |
| `CLAIM_UNDECLARED` | blocker | **BLOCK** | A checkable assertion that was never declared. Blocking is the only thing that makes declaring worth doing |
| `CLAIM_CONTRADICTED` | blocker | **BLOCK** | The source says otherwise. This is the failure the whole system exists to prevent |
| `OVERCLAIM_LEGAL` | blocker | **BLOCK** | Legal exposure belongs to the user, so the user must see it and decide |
| `COMPARATIVE_AD` | blocker | **BLOCK** | Sharpest edge in Vietnamese advertising law; never auto-handled |
| `UNKNOWN_ENGINE` | blocker | **BLOCK** | An engine that cannot be named cannot be priced, so no budget statement is trustworthy |
| `BANNED_PHRASE` *(replacement exists)* | blocker | **PROPOSE FIX** | The replacement was written by a human, in the brand table. The proposal is a literal splice at known offsets — no model writes new text |
| `BANNED_PHRASE` *(no replacement)* | blocker | **BLOCK** | No approved substitution exists. Inventing one would be the Checker writing copy |
| `ADDRESS_FORM` | warn | **PROPOSE FIX** | Pure table lookup, and the wrong pronoun is visible to every viewer |
| `MISSING_DISCLAIMER` | warn | **PROPOSE FIX** | The exact required text is in the brand profile; appending it is mechanical |
| `BUDGET_OVER_CEILING` | blocker | **PROPOSE DOWNGRADE** | An engine swap is reversible and content-neutral — but it changes how the video looks, so a person signs off |
| `COST_MISPRICED` | warn | **PROPOSE NUMBER FIX** | Arithmetic, not content. Still surfaced, because a mispriced scene is often how an over-budget plan disguised itself |
| `CLAIM_PARTIAL` | warn | **ADVISE + tick** | The source half-supports it. Whether that is honest enough is a judgement only the author can make |
| `OVERCLAIM_SOFT` | warn | **ADVISE + tick** | Risky but not clearly unlawful. Blocking would make the lens a nuisance |
| `DURATION_DRIFT` | warn | **ADVISE** | Often deliberate |
| `RATIO_HIGH` · `RATIO_LOW` | advisory | **FOLD AWAY** | Taste. A taste lens that can stop the line gets switched off within a week |
| `AVATAR_RUN_TOO_LONG` | advisory | **FOLD AWAY** | Same |
| `BUDGET_TIGHT` | advisory | **FOLD AWAY** | Under the ceiling is under the ceiling |
| `REDTEAM_*` | varies | **BLOCK if blocker, else ADVISE** | One unvalidated pass may raise an alarm; it may not edit anything |
| `NO_RESIDUAL` | advisory | **Record, do not surface** | Useful in the audit log, noise in the report |

Two patterns run through the table.

**Anything touching truth or law blocks.** Nothing in the truth column is ever
auto-fixed, because every conceivable automatic fix is the Checker deciding what the
video should assert.

**Anything auto-fixable is fixable because a human already wrote the fix.** Every
`PROPOSE FIX` row draws its replacement text from the brand profile, not from a model.
The proposal is a splice of known text at known character offsets — which is why it can
be shown as a clean before/after and accepted with one click.

---

## 3. Conflicts

Two lenses can propose incompatible actions on the same scene. Priority:

```
truth (L4)  >  legal (L5)  >  budget (L1)  >  brand (L2)  >  editorial (L3, L6)
```

The order runs from *what cannot be wrong* to *what is a matter of taste*.

**The loser is never dropped.** It travels to the human marked `deferred`, with one line
naming the action that displaced it and what the consequence is.

**This is not hypothetical — it fires in the VéXe example run.**

That Cut is $1.30 over its gate2 ceiling. L1's rule picks the two scenes with the largest
downgrade gap, and because avatar is the most expensive engine per second, those are the
two *avatar* scenes — `sc-01` and `sc-08`, $1.08 saved each. The budget clears at $3.14.
But removing 12 of the 16.5 avatar seconds takes the talking-head ratio from **0.367 to
0.100**, under the 0.15 floor.

Budget outranks editorial, so the downgrade is what gets proposed. It carries one line:

> *Consequence: accepting this moves the talking-head ratio 0.367 → 0.100, below the
> 0.15–0.35 band, because sc-01 and sc-08 were the scenes downgraded.*

That clause is the point. Attributing the consequence **to the decision that caused it**
is the difference between a system that was designed and a list that was concatenated. A
user who sees "ratio is low" floating on its own learns nothing. A user who sees "your
budget fix did this" can decide whether they still want the fix.

The consequence figure is computed by `cut.html`, not by a model — it is arithmetic, so
it belongs on the deterministic side, and the Checker is handed the number rather than
asked to derive it.

**What the example is really saying.** A 45-second video that is one-third presenter
cannot be made for $4 at $0.20 a second. The two lenses are not contradicting each
other; they are both pointing at a brief that wants more than its budget buys. The
system's job is not to resolve that — it is to make sure a person is told, and told
which trade they are being offered.

---

## 4. Three prohibitions

These are written as three sentences in the N10 prompt and checked explicitly after every
run.

**1. Never rewrite `claims[]`, `dialogue_*`, or `sources[]`.**
Not to fix a blocker, not to soften an overclaim, not to make anything pass. Editing
*"tiết kiệm đến 40%"* into *"tiết kiệm đáng kể"* removes the warning and keeps the
problem — the video still asserts something unsupported, and now nothing is watching. If
a claim does not stand up, block and say so.

**2. Never propose raising `budget.ceiling_usd`.**
The ceiling is the user's. The Checker may rearrange the video to fit inside it and may
report that no arrangement fits — but "this would work with more money" is not a finding,
it is a sales pitch.

**3. Never mark a blocker approved.**
Only a human waives a blocker, and the waiver is recorded under their name with a reason.
That record is the most valuable line in the system.

---

## 5. Three presentation tiers

A user drowned in warnings turns the feature off. Selectivity is the job, not a courtesy.

| Tier | Presentation | Typical count |
|---|---|---|
| **Blockers** | Loud, top of the report. Scene id, the sentence quoted verbatim, and exactly which source failed | 0–2 |
| **Proposals** | Collapsed to one line with a count — *"9 proposals · review"* — opened on demand | 0–12 |
| **Advisories** | Folded, one line per class with a count | any |

If more than four blockers fire at once, something upstream went wrong — a bad brief, the
wrong sources attached — and the report should say that rather than listing sixteen
individually.

Every blocker must be readable without opening anything else. That means the sentence
quoted in full, not a scene reference the reader has to go look up.

---

## 6. Audit record

Append-only array on `cut.audit`. Because the Checker only proposes, each entry records
**both** the proposal and what the human did with it.

```json
{
  "seq": 7,
  "ts": "2026-07-30T09:41:22+07:00",
  "gate": "gate2",
  "trigger": {
    "code": "BUDGET_OVER_CEILING",
    "from_lens": "budget",
    "lens_version": "1.0"
  },
  "authority_row": "BUDGET_OVER_CEILING/blocker",
  "proposed": {
    "type": "DOWNGRADE",
    "scene_id": "sc-06",
    "before": { "engine": "seedance_video",   "cost_usd": 0.90 },
    "after":  { "engine": "hyperframes_html", "cost_usd": 0.12 },
    "cost_delta_usd": -0.78,
    "rationale": "Largest gap between current cost and downgrade_path[0] of any scene."
  },
  "human": {
    "decision": "accepted",
    "by": "cong",
    "at": "2026-07-30T09:43:10+07:00",
    "note": ""
  },
  "deferred": [],
  "cut_hash_before": "…",
  "cut_hash_after": "…"
}
```

| Field | Notes |
|---|---|
| `authority_row` | Which row of §2 produced this. Makes the decision auditable against the table rather than against a model's reasoning |
| `proposed.rationale` | One sentence. Why *this* scene and not another |
| `human.decision` | `accepted` · `rejected` · `waived` |
| `human.note` | **Required when `waived`** |
| `deferred` | Findings this action displaced, per §3 |

**Every number in the gate report must trace to an entry here.** A figure on screen with
no audit line behind it is a figure nobody can check.

### The line that matters

```json
"human": { "decision": "waived", "by": "cong",
           "note": "Số 40% lấy từ slide cũ, sẽ xác minh sau khi đăng." }
```

*The user was told this claim has no source, and chose to render anyway.*

That is the sentence that moves responsibility to where it belongs. A system that
silently fixed the claim would have destroyed it. A system that blocked forever would
never have produced it. Recording the override — with a name, a time and a reason — is
the whole design in one line.
