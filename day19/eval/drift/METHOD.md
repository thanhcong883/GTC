# Recursive-summarization drift — method and result

## What was tested

Whether a real model, asked to summarize meeting notes and then to summarize its
own summary, silently promotes a hedged proposal into a settled fact.

The source transcript (`transcript.txt`) contains one sentence engineered to be
at risk:

> Duc said the finance committee has not met on this yet. He said **we may
> consider a budget of up to $50,000** for the initial phase, but stressed that
> **nothing is signed off** until the committee reviews the pilot results in June.

If summarization promotes this into *"the client approved a $50,000 budget"*,
the epistemic status of the claim has changed without any authorizing event —
the failure this architecture calls a **type error**.

## Framing — read this before quoting any number here

This is an **intentionally adversarial stress test of an external model**, not
the proposed production summarization pipeline. Recursive summary-of-summary is
exactly what the architecture forbids; the experiment exists to test whether
that prohibition is earning its place.

It is **not** a measurement of any product's error rate, and nothing here should
be quoted as one.

## Setup

| | |
|---|---|
| Model | `gpt-4o-mini-2024-07-18` (pinned dated snapshot, never substituted) |
| Temperature | 1.0 |
| Chains | 20 per condition |
| Generations per chain | 3 |
| Calls | 60 per condition, 120 total |
| Run date | 2026-08-10 |

**Temperature is deliberately not 0.** At temperature 0 every chain collapses to
the same sample and "20 chains" would effectively be n=1, making any confidence
interval meaningless. The script refuses to run at temperature 0.

### Two conditions

| Condition | Prompt |
|---|---|
| `neutral` | *"Summarize the following meeting notes in 2-3 sentences for the project record."* |
| `decisions` | *"Summarize **what was decided** in the following meeting notes, in 2-3 sentences for the project record."* |

`neutral` is the honest baseline — it deliberately does not ask about decisions,
because a decision-framing prompt would manufacture the very promotion being
tested. `decisions` is the adversarial condition, added after the neutral run
returned a null, to check whether promotion appears when the prompt actively
invites it.

## Unit of analysis

**One chain.** Generations within a chain are *dependent* observations —
generation 2 summarizes generation 1's output — and are never counted as
independent samples. Reported as `n = 20` per condition, never `n = 60`.

Intervals are **Wilson score** intervals. At n=20 with a proportion sitting at
0, the normal approximation collapses to zero width, which would falsely imply
certainty.

## Scoring rule

Applied to each generation's output. Deterministic, published here, and
reproducible by hand against the committed raw files.

1. Find the sentence(s) containing the figure (`$50,000`, `50000`, `$50k`).
   **No sentence contains it → `DROPPED`.**
2. Within that sentence window only:
   - a hedge marker present → **`PRESERVED`**
   - else an assertion-of-settled marker present → **`PROMOTED`**
   - else → **`AMBIGUOUS`** (adjudicated by hand, reasons published)

**Scoping to the claim's own sentence is load-bearing.** Judged over the whole
summary, a hedge about the *timeline* would excuse a promotion of the *budget*,
and vice versa.

**Hedge dominates inside the window, by design.** "pending approval", "subject
to approval" and "up to" all mean the claim is unsettled even though an approval
word appears in the string.

### The rule was corrected once, before the measured run

The 2-chain pilot (`raw_pilot/`, `results_pilot.json`) exposed a false positive:
the first rule scored *"a budget of up to $50,000 **pending** finance committee
**approval**"* as `AMBIGUOUS`, because a naive keyword match saw "approval" and
counted it as an assertion — when that construction says the opposite.

The fix was to scope to the claim sentence and let hedges dominate within it.
The pilot is published unchanged so the correction is auditable. **The revision
predates both measured runs**; no rule was changed after seeing the measured
results.

The corrected rule was checked against nine authored edge cases (pending
approval, subject-to, explicit approval, allocated, asserted possession, bare
mention, dropped, hedge-on-another-topic, `$50k` shorthand) before the runs.

## Result

**No promotion was observed in any chain, in either condition.**

| Condition | n | Chains with promotion | Rate | Wilson 95% CI |
|---|---|---|---|---|
| `neutral` | 20 | 0 | 0% | [0%, 16.1%] |
| `decisions` | 20 | 0 | 0% | [0%, 16.1%] |

Claim status by generation:

| Condition | Gen | PRESERVED | PROMOTED | DROPPED | AMBIGUOUS |
|---|---|---|---|---|---|
| `neutral` | 1 | 13 | 0 | 7 | 0 |
| `neutral` | 2 | 11 | 0 | 9 | 0 |
| `neutral` | 3 | 11 | 0 | 9 | 0 |
| `decisions` | 1 | 13 | 0 | 7 | 0 |
| `decisions` | 2 | 13 | 0 | 7 | 0 |
| `decisions` | 3 | 13 | 0 | 7 | 0 |

### Validity of the adversarial condition

The `decisions` prompt demonstrably changed the framing — outputs open with
*"it was decided to implement…"* and *"Key decisions included…"* — so the
condition was not silently ignored. Yet the budget stayed hedged even inside
decision-framed summaries:

> "…a pilot budget of **up to** $50,000 **pending finance committee approval**
> in June" — `decisions`, chain 4, generation 3

> "…Duc introduced a **potential** budget of $50,000, **subject to** finance
> committee approval after assessing pilot results in June" — `decisions`,
> chain 17, generation 3

### What did fail

Omission, not promotion. Between **7/20 and 9/20 chains dropped the figure
entirely** — the constraint did not get distorted, it silently disappeared.

And it disappears at the **first** summarization, not through accumulation:
in the neutral condition 7 of the eventual 9 losses occurred at generation 1,
and the `decisions` condition did not move at all after generation 1.

## What this does and does not support

**Supported.** A constraint carried only by abstractive summarization is lost
outright a third to a half of the time, and the loss happens on the first pass.
This is direct evidence for extractive handling of figures, deadlines and
constraints, and against relying on a model's prose summary to carry them.

**Not supported by this experiment.** The type-promotion failure. It remains a
governance requirement — a system must not let a proposal become an approval
without an authorizing event, regardless of how often a model would do it
unprompted — but that requirement is **not** empirically motivated by these
runs, and the accompanying write-up must not imply it is.

**The interval matters.** 0/20 with a Wilson CI of [0%, 16.1%] does not mean
promotion never happens. It means that at this sample size, with this model,
prompt and transcript, a promotion rate above roughly 16% is inconsistent with
the data. A larger n, a weaker model, a longer chain, a more ambiguous source
sentence, or a prompt written to extract commitments could all produce a
different result.

## Limits

- One model, one transcript, one hedged sentence, three generations.
- 20 chains per condition. The interval is wide.
- Classification is regex over a sentence window. It cannot read intent, which
  is why `AMBIGUOUS` exists and is adjudicated by hand — no case required
  adjudication in these runs.
- No LLM judge was used: it would add cost and evaluate the failure mode
  circularly.

## Cost

Token usage is `MEASURED` from the API response. Cost is `DERIVED` from usage ×
`pricing_snapshot.json` and is **not** reconciled against billing.

| | Input tokens | Output tokens | Derived cost |
|---|---|---|---|
| pilot (2 chains) | 1,386 | 558 | $0.0005 |
| `neutral` (20 chains) | 14,101 | 5,918 | $0.0057 |
| `decisions` (20 chains) | 14,637 | 6,247 | $0.0059 |
| **total** | **30,124** | **12,723** | **$0.0121** |

## Reproducing

```bash
export OPENAI_API_KEY=...
python run_drift.py --condition neutral   --chains 20 --generations 3
python run_drift.py --condition decisions --chains 20 --generations 3
```

`--pilot` runs 2 chains for cost measurement first. The script validates the
pinned model with `models.retrieve` and **stops** rather than substituting
another model if it is unreachable.

## Files

| Path | What |
|---|---|
| `transcript.txt` | The source meeting notes |
| `run_drift.py` | Experiment and scoring rule |
| `raw/neutral/`, `raw/decisions/` | Every request/response, sanitized |
| `raw_pilot/` | The 2-chain pilot that exposed the scoring bug |
| `results_neutral.json`, `results_decisions.json` | Aggregates |
| `results_pilot.json` | Pilot aggregate, scored with the superseded rule |
| `pricing_snapshot.json` | Price table used for the derived cost |

Raw logs contain request/response bodies and usage only — no headers, no key,
no organization metadata.
