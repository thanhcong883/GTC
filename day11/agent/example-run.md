# Example run — VéXe

One brief, ten agents, recorded verbatim.

> ## ⚠️ Status: not yet run
>
> **Everything below marked `[ NOT RUN ]` is an empty slot.** The input is fixed, the
> deterministic worksheet is computed and verified, and the expected findings are written
> down in advance so the run can be checked against them rather than graded after the
> fact.
>
> Nothing in this file is a model output presented as if it were real. When the workflow
> is built, paste each node's output verbatim into its slot — **including the parts that
> come out wrong.** A run with nothing surprising in it is a run nobody learned from.
>
> Cost when you do: ~25–35 credits, about three minutes.

---

## 1. Input

**Brief** (`@brief`):

```
Làm video 60 giây giới thiệu app đặt vé xe khách VéXe cho chiến dịch Tết.
Nói với người đi làm xa quê, 22–40 tuổi ở TP.HCM và Hà Nội.
Cuối video kêu họ tải app.
```

**Ceiling** (`@ceiling_usd`): `4.00`

**Sources** (`@sources`):

| id | Title | Excerpt |
|---|---|---|
| S1 | VéXe — báo cáo vận hành nội bộ Q4/2025 | *Trong quý 4/2025, 41.200 vé được đặt thành công qua ứng dụng VéXe. Tỉ lệ hoàn tất thanh toán đạt 92,4%. Thời gian đặt vé trung bình đo được trên toàn bộ đơn thành công: 48 giây.* |
| S2 | Khảo sát người dùng VéXe, 12/2025, n=612 | *38% người được hỏi cho biết đã từng không mua được vé xe về quê dịp Tết trong 2 năm gần nhất. 61% cho biết đã phải ra bến xếp hàng trực tiếp.* |

**Brand rules** (`@brand_rules`): profile `vexe-v1` —
address form **anh/chị**, forbidden `bạn` · `các bạn` · `mày`,
banned phrases `rẻ nhất` · `số 1 Việt Nam` · `cam kết 100%` · `duy nhất`,
required disclaimer *"Giá vé do nhà xe niêm yết"*.

Note the sources deliberately **do not** contain any figure about savings. That absence
is what the run is built to expose.

---

## 2. The Cut used

The full JSON is in `cut-schema.md` §4, and `cut.html` loads it with one button. It is
deliberately imperfect — six seeded defects across four severity classes, so the gate
report has real content instead of a column of ticks.

To skip N1–N3 and test only the review half, paste that Cut straight into `cut.html`.

---

## 3. Worksheet — computed, verified

This section is **not** a slot. It is arithmetic, it runs in `cut.html`, and it has been
checked.

```
  sc-01  heygen_avatar_v      6.0s ×  $0.200/s =   $1.20    authored $1.20  ok
  sc-02  hyperframes_html     5.5s ×  $0.020/s =   $0.11    authored $0.11  ok
  sc-03  heygen_avatar_v      4.5s ×  $0.200/s =   $0.90    authored $0.90  ok
  sc-04  hyperframes_html     7.0s ×  $0.020/s =   $0.14    authored $0.14  ok
  sc-05  hyperframes_html     5.0s ×  $0.020/s =   $0.10    authored $0.10  ok
  sc-06  seedance_video       6.0s ×  $0.150/s =   $0.90    authored $0.12  off by $0.78
  sc-07  seedance_video       5.0s ×  $0.150/s =   $0.75    authored $0.10  off by $0.65
  sc-08  heygen_avatar_v      6.0s ×  $0.200/s =   $1.20    authored $1.20  ok

                              RECOMPUTED =   $5.30
                                AUTHORED =   $3.87
                        CEILING (gate2)  =   $4.00
                                    OVER =   $1.30

  To fit, downgrade in this order:
    sc-01  heygen_avatar_v → hyperframes_html   saves $1.08
    sc-08  heygen_avatar_v → hyperframes_html   saves $1.08
           new total $3.14  fits

  Consequence of accepting that plan:
    talking-head ratio 0.367 → 0.100   (band 0.15 – 0.35)

  duration            45.0 s   (target 45 s)
  avatar seconds      16.5 s
  talking-head ratio  0.367   (band 0.15 – 0.35)
  claims              5 total, 4 with a source, 1 null
```

**The line worth stopping on** is `AUTHORED $3.87` against `RECOMPUTED $5.30`. The Cut
as written appears to sit comfortably inside its $4.00 ceiling. It does not. Two scenes
were priced at the rate of the engine they would be downgraded *to*, not the one they
actually use — and only recomputing catches it.

That is the entire argument for invariant I1: `totals` is derived, never authored.

**The second line worth stopping on** is the consequence. Clearing the budget the cheapest
way means downgrading the two avatar scenes, which takes twelve of the sixteen and a half
presenter seconds out of the video. Budget and editorial are not disagreeing with each
other here — they are both reporting that a 45-second video which is one-third presenter
cannot be built for $4 at $0.20 a second. Someone has to be told which trade they are
making.

---

## 4. Expected findings

Written before the run, so the run can be checked rather than rationalised.

| # | Node | Code | Severity | Where | Checker should |
|---|---|---|---|---|---|
| 1 | N7 📎 | `CLAIM_CONTRADICTED` | blocker | `sc-06` / `c5` | **BLOCK** — "tiết kiệm đến 40%" cites S1; S1 has no savings figure at all |
| 2 | N7 📎 | `CLAIM_UNDECLARED` | blocker | `sc-07` | **BLOCK** — "hơn năm trăm nhà xe" is checkable, undeclared, unsourced |
| 3 | N4 💰 | `COST_MISPRICED` | warn | `sc-06`, `sc-07` | **PROPOSE NUMBER FIX** ×2 |
| 4 | N4 💰 | `BUDGET_OVER_CEILING` | blocker | whole cut | **PROPOSE DOWNGRADE** — sc-01 and sc-08, and state the ratio consequence |
| 5 | N5 🏷 | `ADDRESS_FORM` | warn | `sc-03` | **PROPOSE FIX** — "Bạn" → "Anh chị" |
| 6 | N6 🎭 | `RATIO_HIGH` | advisory | whole cut | **FOLD AWAY** — 0.367 against a 0.35 ceiling |
| 7 | N7 📎 | `CLAIM_SUPPORTED` | advisory | c1, c2, c4 | **FOLD** — recorded, not surfaced |
| 8 | N8 ⚖️ | `OVERCLAIM_SOFT` | warn | `sc-06` | **ADVISE** — a specific saving stated as fact |
| 9 | N9 🕵️ | *residual, if any* | — | — | Block if blocker, else advise |

Things to watch for that would be **more interesting than the expected list**:

- **N7 misses finding 2.** The undeclared-claim job is harder than the declared-claim job
  and is the one most likely to fail. If it misses, say so — that is the most useful
  sentence in the whole page.
- **N4 does arithmetic instead of checking the worksheet.** If its numbers differ from
  §3, the design premise (hand the model a finished worksheet so it only has to verify)
  did not hold.
- **N5 reports `bạn` inside another word.** Vietnamese substring matching without word
  boundaries is a known trap.
- **N9 repeats a finding another lens made.** Its prompt forbids this; repeating counts as
  producing nothing.
- **N10 departs from the authority table.** `cut.html` computes what the table says should
  happen. If N10's report disagrees, that is a finding about the Checker, and it belongs
  on the page.

---

## 5. Node outputs

### N1 📋 Intake

`[ NOT RUN ]`

### N2 ✍️ Writer

`[ NOT RUN ]`

### N3 🎬 Scene planner

`[ NOT RUN ]` — for a review-only run, the Cut from `cut-schema.md` §4 is used instead.

### N4 💰 L1 Budget

`[ NOT RUN ]`

### N5 🏷 L2 Brand

`[ NOT RUN ]`

### N6 🎭 L3 Ratio

`[ NOT RUN ]`

### N7 📎 L4 Claim sourcing

`[ NOT RUN ]`

### N8 ⚖️ L5 Overclaim

`[ NOT RUN ]`

### N9 🕵️ Red team

`[ NOT RUN ]`

### N10 🎯 Checker

`[ NOT RUN ]`

---

## 6. Run log

Fill in when the workflow runs.

| | |
|---|---|
| Date | |
| Models pinned | fast = Gemini 3.0 Flash · mid = GPT-5.1 · top = Claude Opus 5 *(confirm against your account before the run, and correct here if it differs)* |
| Credits spent | |
| Wall time | |
| Contract violations | *(lens outputs that failed the check in `cut.html`)* |
| Expected findings that fired | / 8 |
| Findings not expected | |
| Divergence between N10 and the authority table | |

### What went wrong

*The section that matters. Anything surprising, anything that failed, anything that had to
be re-run. If it is empty when the rest is filled in, it was not written honestly.*

---

## 7. On the sample findings in `cut.html`

`cut.html` ships a **sample set of lens outputs** behind the *Load a sample set of
findings* button. They are hand-written to exercise the merge step — the contract check,
the authority mapping, the three tiers, the audit rows — so the page is usable before the
workflow exists.

**They are not a run, and nothing on the page presents them as one.** When the real
outputs land in §5, they replace the sample as the thing worth citing.
