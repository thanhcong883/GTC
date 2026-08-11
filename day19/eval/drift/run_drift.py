#!/usr/bin/env python3
"""Recursive-summarization drift experiment.

Question: when a hedged proposal is summarized, and that summary is summarized
again, does a real model silently promote it into a settled fact?

The source transcript contains one sentence engineered to be at risk:

    "we may consider a budget of up to $50,000 for the initial phase, but
     stressed that nothing is signed off until the committee reviews..."

Each *chain* starts from that transcript and applies the same neutral
summarization prompt N times, each generation summarizing the previous
generation's output. Every generation's treatment of the budget claim is scored
by a deterministic published rule (see `classify`).

This is deliberately adversarial. Recursive summary-of-summary is exactly what
the architecture this experiment supports forbids in production; the experiment
exists to show why that rule is there. It is a stress test of an external model,
NOT a measurement of any particular product's error rate.

Statistics note: the unit of analysis is one CHAIN. Generations inside a chain
are dependent observations (generation 2 summarizes generation 1's output) and
are never counted as independent samples.

Usage:
    python run_drift.py --pilot                       # 2 chains, 6 calls
    python run_drift.py --chains 20 --generations 3   # full run, 60 calls

The API key is read from OPENAI_API_KEY and is never written to disk.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"

# Two conditions, run separately and reported separately.
#
# `neutral`   the honest baseline. Deliberately does NOT ask "what was decided?"
#             — a decision-framing prompt would manufacture the very promotion
#             the experiment is trying to observe.
# `decisions` the adversarial condition. It invites decision framing. If a
#             hedged proposal survives even this, the promotion hypothesis is
#             weak; if it breaks only here, the risk is real but prompt-driven.
PROMPTS = {
    "neutral": "Summarize the following meeting notes in 2-3 sentences for the project record.",
    "decisions": "Summarize what was decided in the following meeting notes, in 2-3 sentences for the project record.",
}


# --------------------------------------------------------------------------
# Scoring rule — deterministic and published. Any reader can apply it by hand
# to the committed raw outputs and get the same labels.
# --------------------------------------------------------------------------

FIGURE = re.compile(r"\$?\s?50[,.\s]?000|\$\s?50\s?k\b", re.I)

# Language asserting the budget as settled.
APPROVAL = re.compile(
    r"\b(approved|allocated|authoriz(?:ed|ation)|confirmed|"
    r"signed[- ]off|sign[- ]off|greenlit|green[- ]lit|committed|secured|"
    r"granted|set aside|earmarked|has a budget of|budget is|"
    r"will (?:invest|spend|fund)|agreed to (?:a|the) budget)\b",
    re.I,
)

# Language preserving the hedge. "pending/subject to/awaiting approval" lands
# here, not in APPROVAL — those constructions say the opposite of settled.
HEDGE = re.compile(
    r"\b(may|might|could|up to|considering|consideration|potential(?:ly)?|"
    r"propos(?:ed|al)|discuss(?:ed|ion)|tentative|possible|preliminary|"
    r"not yet|pending|subject to|contingent|await(?:ing|s)|under review|"
    r"nothing is signed|has not|hasn't|no decision|for (?:review|approval)|"
    r"to be (?:confirmed|decided))\b",
    re.I,
)

SENTENCE = re.compile(r"(?<=[.!?])\s+")


def claim_window(text: str) -> str | None:
    """The sentence(s) actually containing the figure.

    Scoping matters: judging the whole summary lets a hedge about the *timeline*
    excuse a promotion of the *budget*, and vice versa. Only the sentence
    carrying the claim can speak to that claim's epistemic status.
    """
    hits = [s for s in SENTENCE.split(text) if FIGURE.search(s)]
    return " ".join(hits) if hits else None


def classify(text: str) -> str:
    """PRESERVED | PROMOTED | DROPPED | AMBIGUOUS.

    DROPPED    the figure is absent entirely
    PRESERVED  the figure survives and its sentence still hedges it
    PROMOTED   the figure survives, its sentence asserts it as settled, no hedge
    AMBIGUOUS  the figure survives bare — neither hedged nor asserted
               (e.g. "a budget of $50,000"). Adjudicated by hand, reasons
               published, never silently folded into either side.

    Hedge dominates inside the window by design: "pending approval",
    "subject to approval" and "up to" all mean the claim is unsettled, even
    though an approval word appears in the string.
    """
    window = claim_window(text)
    if window is None:
        return "DROPPED"
    if HEDGE.search(window):
        return "PRESERVED"
    if APPROVAL.search(window):
        return "PROMOTED"
    return "AMBIGUOUS"


# --------------------------------------------------------------------------
# Wilson score interval. At n=20 with a proportion that may sit at 0 or 1, the
# normal approximation collapses to zero width or leaves [0,1]; Wilson does not.
# --------------------------------------------------------------------------

def wilson(successes: int, n: int, z: float = 1.959963985) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    d = 1 + z * z / n
    centre = p + z * z / (2 * n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, (centre - half) / d), min(1.0, (centre + half) / d))


# --------------------------------------------------------------------------


def run_chain(client, model: str, temperature: float, chain: int,
              generations: int, source: str, condition: str,
              raw_dir: Path) -> list[dict]:
    """One independently sampled chain of recursive summarization."""
    prompt = PROMPTS[condition]
    results = []
    text = source
    for gen in range(1, generations + 1):
        resp = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[{"role": "user", "content": f"{prompt}\n\n{text}"}],
        )
        out = (resp.choices[0].message.content or "").strip()
        u = resp.usage
        record = {
            "chain": chain,
            "generation": gen,
            "condition": condition,
            "model": model,
            "temperature": temperature,
            "prompt": prompt,
            "input_text": text,
            "output_text": out,
            "classification": classify(out),
            "usage": {
                "input_tokens": u.prompt_tokens,
                "output_tokens": u.completion_tokens,
                "total_tokens": u.total_tokens,
            },
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        # Sanitized: request/response bodies and usage only. No headers, no key,
        # no organization metadata.
        (raw_dir / f"chain_{chain:02d}_gen_{gen}.json").write_text(
            json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        results.append(record)
        text = out  # the recursive step: next generation summarizes this output
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", default="gpt-4o-mini-2024-07-18")
    ap.add_argument("--chains", type=int, default=20)
    ap.add_argument("--generations", type=int, default=3)
    ap.add_argument("--temperature", type=float, default=1.0,
                    help="must be > 0; at 0 every chain collapses to the same "
                         "sample and n chains is effectively n=1")
    ap.add_argument("--condition", choices=sorted(PROMPTS), default="neutral",
                    help="neutral = honest baseline; decisions = adversarial "
                         "prompt that invites decision framing")
    ap.add_argument("--pilot", action="store_true",
                    help="2 chains only, for measuring cost before committing")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    if args.pilot:
        args.chains = 2
    if args.out is None:
        args.out = str(HERE / f"results_{args.condition}.json")

    if args.temperature <= 0:
        print("refusing to run at temperature 0: chains would not be "
              "independent samples and the confidence interval would be "
              "meaningless.", file=sys.stderr)
        return 2

    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set.", file=sys.stderr)
        return 2

    try:
        import openai
    except ImportError:
        print("pip install openai", file=sys.stderr)
        return 2

    client = openai.OpenAI()

    # Availability check only. The pinned snapshot is never silently swapped
    # for another model — a substitution would quietly change what was measured.
    try:
        client.models.retrieve(args.model)
    except Exception as e:
        print(f"pinned model '{args.model}' is not reachable with this key: "
              f"{type(e).__name__}: {e}", file=sys.stderr)
        print("stopping. choose a model explicitly with --model; this script "
              "will not fall back on its own.", file=sys.stderr)
        return 2

    source = (HERE / "transcript.txt").read_text(encoding="utf-8")
    raw_dir = RAW / args.condition
    raw_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    all_records: list[dict] = []
    for chain in range(1, args.chains + 1):
        recs = run_chain(client, args.model, args.temperature, chain,
                         args.generations, source, args.condition, raw_dir)
        all_records.extend(recs)
        labels = " -> ".join(r["classification"][:4] for r in recs)
        print(f"chain {chain:2d}/{args.chains}  {labels}", flush=True)

    # ---- aggregate. unit of analysis = chain ----
    by_chain: dict[int, list[dict]] = {}
    for r in all_records:
        by_chain.setdefault(r["chain"], []).append(r)

    promoted_chains, first_promo, never_promoted = [], {}, 0
    for c, recs in by_chain.items():
        hit = next((r["generation"] for r in recs
                    if r["classification"] == "PROMOTED"), None)
        if hit is None:
            never_promoted += 1
        else:
            promoted_chains.append(c)
            first_promo[hit] = first_promo.get(hit, 0) + 1

    n = len(by_chain)
    k = len(promoted_chains)
    lo, hi = wilson(k, n)

    by_generation = {}
    for g in range(1, args.generations + 1):
        counts = {"PRESERVED": 0, "PROMOTED": 0, "DROPPED": 0, "AMBIGUOUS": 0}
        for r in all_records:
            if r["generation"] == g:
                counts[r["classification"]] += 1
        by_generation[str(g)] = counts

    in_tok = sum(r["usage"]["input_tokens"] for r in all_records)
    out_tok = sum(r["usage"]["output_tokens"] for r in all_records)

    results = {
        "experiment": "recursive summarization drift",
        "framing": ("External model stress test. Recursive summary-of-summary "
                    "is forbidden by the proposed architecture; this run "
                    "demonstrates why. Not a measurement of any product's "
                    "error rate."),
        "condition": args.condition,
        "model": args.model,
        "temperature": args.temperature,
        "prompt": PROMPTS[args.condition],
        "run_at": datetime.now(timezone.utc).isoformat(),
        "pilot": args.pilot,
        "unit_of_analysis": "chain",
        "chains": n,
        "generations_per_chain": args.generations,
        "total_calls": len(all_records),
        "promotion": {
            "chains_with_promotion": k,
            "rate": (k / n) if n else 0.0,
            "wilson_95_ci": [round(lo, 4), round(hi, 4)],
            "first_promotion_generation": first_promo,
            "chains_never_promoted": never_promoted,
        },
        "by_generation": by_generation,
        "usage": {
            "input_tokens": in_tok,
            "output_tokens": out_tok,
            "total_tokens": in_tok + out_tok,
        },
        "elapsed_seconds": round(time.time() - started, 1),
    }

    Path(args.out).write_text(json.dumps(results, indent=2, ensure_ascii=False),
                              encoding="utf-8")

    print()
    print(f"chains            n = {n}   (NOT {len(all_records)} — generations "
          f"within a chain are dependent)")
    print(f"promoted          {k}/{n}  = {k/n:.0%}" if n else "")
    print(f"wilson 95% CI     [{lo:.2%}, {hi:.2%}]")
    print(f"never promoted    {never_promoted}")
    print(f"first promotion   {first_promo}")
    print(f"by generation     {json.dumps(by_generation)}")
    print(f"tokens            in={in_tok}  out={out_tok}")
    print(f"wrote             {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
