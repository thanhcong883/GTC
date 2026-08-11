# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: AI hiring managers and technical recruiters**, across many companies rather than one target employer. They arrive time-boxed — scanning a candidate's work to decide whether this person is worth an interview. Their real job is judging whether the candidate can actually build and reason about AI systems, as opposed to listing tools on a CV.

This audience reads in two speeds, and both must be served by the same page: a fast skim that answers "is this person credible?", and a deep read for the one evaluator who opens a day page and keeps going.

## Product Purpose

A personal portfolio and a public build log for Giang Thanh Cong (Công), an AI Engineer in Hà Nội. Its purpose is to prove capability through shipped artifacts instead of claims about past work.

The spine is a **30-day build challenge**: ship one real, self-contained deliverable per day and publish it at a permanent URL. Success is a body of work strong enough to reuse across job applications indefinitely — explicitly *not* tied to a single offer, a single company, or a moment in time.

## Positioning

Most AI portfolios list projects. This one publishes a dated sequence of shipped deliverables where the reasoning is visible and the numbers are checkable: teardowns built from real captured traces, an evaluation kit with results from 45 hand-graded runs, a runtime that ships with a passing test suite you can run.

The claim a neighboring portfolio could not truthfully copy is not "I know AI" — it is the volume plus the traceability: 30 artifacts, each standing on its own, each with its figures attributable to measurement rather than assertion.

## Operating Context

- **18 of 30 days shipped** as of 2026-08-10. The challenge is mid-flight; 12 deliverables remain.
- Published at **https://gtc883.vercel.app**. Each day lives at a clean URL (`/day1/` … `/day18/`).
- **Deployment is a direct `vercel --prod`** from the project root (Vercel project `gtc883`). This working copy has **no git repository**, so deployment is currently the only publication and preservation path for shipped work.
- **The homepage day list is data-driven.** Shipping a day means adding one object to the top of the `DAYS` array in `index.html`; the shipped count, progress bar, and "coming up" grid all recompute from it. No other homepage edit is required.
- Deliverables vary in kind by design — pitch decks, product teardowns, strategy reports, UX redesigns, architecture design docs, and runnable code — because the point is range as well as depth.
- Several days ship an interactive artifact alongside the write-up (a priced workbench, a live pricing model, a clickable policy gate, a steppable trace replay).

## Capabilities and Constraints

**Binding constraints** (confirmed with the user; future work must preserve these):

- **Every day lives at `/dayN/`** as a self-contained folder, reachable at a clean URL. Adding one must not require editing the homepage beyond a single `DAYS` entry.
- **Every number must be traceable.** Figures are measured here, cited to a source, or explicitly labelled as an assumption or model. Fabricated benchmarks, metrics, testimonials, or customer counts are out of bounds.

**Current implementation, not commitments** (the user did *not* mark these as binding):

- The site is hand-written HTML, CSS, and vanilla JavaScript with **no build step or framework**; `@vercel/analytics` is the only dependency. This is the present state, not a constraint — future work may introduce tooling.
- **Day pages are written in English**, while working conversation happens in Vietnamese. Not declared binding.

**Other facts:**

- `.vercelignore` excludes `*.pptx` and the CV PDF, so **the CV is deliberately not published** to the live site.
- Undecided: what happens to the site after day 30 — whether the challenge continues, pauses, or is archived.

## Brand Commitments

- **Name:** Giang Thanh Cong (Công), AI Engineer. Footer wordmark renders as `Giang Thanh Cong.` with an accented final period.
- **Contact:** gtcong12a03@gmail.com · 0836 968 682 · github.com/thanhcong883
- **Voice — evidence first.** Claims arrive with their provenance attached. This is the binding editorial commitment confirmed above, and it shows up in the existing work as a willingness to publish unflattering conclusions: Day 4 reports nine of the author's own hypotheses falsified by his own data; Day 16 scores its subject below a competitor on the author's own grid and concludes it has no moat; Day 18 documents the limits of its own sandbox rather than overstating them.
- Existing homepage copy still carries some client-services framing ("Clients Get Always Exceptional Work") that predates the audience decision recorded above. Noted as an observed tension for future copy work — not changed here.

## Evidence on Hand

**Shipped work**

- 18 published day pages at `/day1/` … `/day18/`.
- Day 18 — a runnable Python agent runtime with **39 passing offline tests** (`day18/agent-runtime/`), plus a design note and a recorded trace replay.
- Day 4 — an evaluation kit with real results from **45 hand-graded runs** (`day4/eval/`), including spec, task suite, graders, and scorecards.
- Day 1 — an investor-grade pitch deck (PDF + editable source) with a slide viewer.

**Projects**

- **VietGuide AI** — live demo at https://c2-app-101.vercel.app; Next.js, ASP.NET Core, FastAPI, LangGraph, ChromaDB RAG, Whisper. Screenshot at `assets/vietguide.jpg`.
- Chatbot RAG for History (MongoDB, Gemini API, LangChain); Title → Category prediction (PhoBERT); Fire Detection & Warning on Raspberry Pi (YOLOv8) — **3rd Prize, scientific research**.

**Credentials**

- BSc Artificial Intelligence & Data Science, Thuyloi University, GPA 3.0/4.0. MSc Computer Science, Posts & Telecommunications Institute of Technology, 2025–2027. IELTS 5.5.
- Everest Global (Aug 2025 – Apr 2026): agent RAG for stock-market problems; internal LLM-powered customer-support chat across Zalo, Telegram, WhatsApp.
- Elcom Technology Communications (Jul 2024 – Mar 2025), AI Intern: ST-GCN human activity recognition; YOLOv11 traffic-sign recognition.
- Ngan Giang Technology & Trading (Sep 2023 – Jun 2024), Embedded/AI Intern: Google Assistant on Raspberry Pi; MODBUS RTU.
- CV at `assets/Giang-Thanh-Cong-CV.pdf` (not deployed — see constraints).

**Absences future work must not fabricate**

No client testimonials. No traffic, engagement, or conversion numbers. No revenue, customer counts, or user counts. No endorsements or references beyond the employment history listed above.

## Product Principles

1. **Ship the artifact, not the description.** Each day's proof is something that runs, or a document whose reasoning can be checked — never a claim about work that happened somewhere unverifiable.
2. **A number without provenance is worse than no number.** Measure it, cite it, or label it an assumption. This is what makes the whole body of work trustworthy, and one invented figure would discredit all of it.
3. **State the limits out loud.** Negative findings, unsolved parts, and honest caveats stay in the deliverable. For this audience they read as judgment, not weakness.
4. **Every day stands alone.** A reader arriving cold at `/dayN/` gets full context there. The collection is an index, not a prerequisite.
5. **Serve the skim and the deep read at once.** The evaluator who spends 60 seconds and the one who spends 30 minutes are the same audience on different days; work that only rewards one of them fails half its readers.
