# GTC — Personal site & 30-Day Build Challenge

Personal developer portfolio and a "build in public" log by **Giang Thanh Cong** (AI Engineer).

🔗 **Live:** https://gtc883.vercel.app

## Structure

```
index.html            Portfolio homepage — hand-coded, no framework, no build step
assets/               Shared portfolio assets (project image, CV)
day1/                 Day 1 — MindPal for Revenue pitch deck
  index.html            slide viewer (keyboard / swipe / deep-link per slide)
  slides/               the 15 deck slides as images
  MindPal_for_Revenue_v5.pdf / .pptx   investor-grade deck (PDF + editable source)
  MindPal_for_Revenue_v3.pptx          original draft
  pitch-thumb.png       card thumbnail used on the homepage
day2/                 Day 2 — two outside-in product teardowns (MindPal & PAM)
  index.html
day3/                 Day 3 — MindPal agent-harness teardown (black-box)
  index.html
  evidence/             the 5 network/UI screenshots cited in the teardown
day4/                 Day 4 — an agent evaluation system, designed then actually run
  index.html
  eval/                 the eval kit — spec, task suite, graders, run protocol
    EVAL-SPEC.md          the spec: SUTs, metrics, grader tiers, regression rules
    SUT.md                how to build the three systems under test
    tasks.md              10 tasks with expected answers and rule assertions
    sut/                  the knowledge source (authored, so ground truth is exact)
    graders/              the pinned model-grader prompt + kappa calibration rule
    results/              scorecards and raw run data from 21 Jul 2026
day5/                 Day 5 — Console: an agent-workspace dashboard, redesigned
  index.html            markup only
  css/                  tokens · base · layout · components · charts · views · responsive
  js/                   ES modules, no build step — data, router, theme, charts, views
day6/                 Day 6 — the Launch Readiness Committee
  index.html            the one-pager (use case · idea · design · proof · ROI)
  agent/                build kit — the 10 committee prompts + test cases
day11/                Day 11 — Continuity: an agent that judges the video it made
  index.html            the one-pager — 11 sections, problem → nine roles → the Cut →
                        ten agents → model table → the Checker → gate ladder (clickable)
                        → user journey → worked example → "AI checking AI" → limits
  cut.html              the workbench — validates a Cut, recomputes every cost, builds
                        the paste-ready payload for each MindPal node, then merges the
                        findings back through the authority table. Runs in the browser
  agent/                build kit
    README.md             what the ten nodes are, how they wire, what a run costs
    cut-schema.md         the Cut — fields, three invariants, a worked VéXe example
    prompts.md            10 system prompts + the model/temperature table + wiring
    checker.md            authority table, conflict priority, three prohibitions, audit
    example-run.md        one end-to-end run — input and expected findings written in
                          advance; the ten model outputs are still empty slots
day12/                Day 12 — Counterpoint: a canvas a person and an agent share
  index.html            one page, three parts — a working demo up top, then the
                        interaction spec (10 sections) and the architecture
                        (10 sections), with a sticky sidebar table of contents
day13/                Day 13 — Custody: a people-data platform with no crawler
  index.html            9 parts — the legal constraint, the policy envelope, architecture,
                        entity resolution, freshness and deletion, capacity and cost,
                        the API contract, 7 decision records, risks; plus a clickable
                        policy gate and a sticky sidebar table of contents
day14/                Day 14 — Ceiling: rethinking the browser for agents
  index.html            14 parts — what changes first, the new objective function,
                        three guarantee laws, two budgets, the manifesto, the
                        four-zone trust architecture, the domain-neutral action
                        profile and Effect Rails, the uniform Guarantee Envelope,
                        five deltas, the agent-facing interface, prior art, what
                        it makes worse, open problems; plus a commerce stress test
                        where a price change lands four different ways, and a
                        sticky sidebar table of contents
day10/                Day 10 — Chronos: a cloud sandbox for agents, designed
  index.html            the design doc, RFC-shaped — 18 sections from goals and
                        non-goals through prior art to open questions, plus an
                        inline Airlock demo
  ux.html               the UX as a clickable prototype — the sandbox boundary
                        drawn down the middle of the screen, time along the top,
                        a movable wall, and a design-notes annotation layer
day19/                 Day 19 — PAL Memory Compiler
  index.html            the design doc + a working context compiler: typed memory
                        IR, authority linter, CompileReceipt, per-namespace cache,
                        hard-delete cascade, and two charts it recomputes live
  eval/drift/           the real-model experiment — transcript, code, published
                        scoring rule, every raw request/response, METHOD.md
day20/                 Day 20 — PAL Tool Fabric: from tool integration to a
                        governed extension platform
  index.html            the design + a working policy gateway: parameter-aware
                        authorization, label propagation, the Two Surfaces
                        approval demo, and 12 fixtures that run in the page
  plugin/publish-report.json  19 executable publish gates, with the manifest sha256
  evidence/             the two MindPal screenshots the argument rests on
  plugin/               the sample PublishedPlugin — manifest, design notes,
                        and the two fixture sets the page and `pal plugin test`
                        both run
day18/                 Day 18 — A self-extending agent runtime
  index.html            the write-up — loop, tool interface, memory, the
                        schema-recompute line, the OpenAI translation layer,
                        two bugs found only by running it, an embedded trace
                        replay
  agent-runtime/          the real package — orchestration loop, tools,
                        two-layer memory, self-extending create_tool, 39
                        offline tests, DESIGN.md
  trace.html              a real recorded run — self-contained HTML replay
```
Each day lives at a clean URL: `/day1/` … `/day10/`.

## 30-Day Challenge

- **Day 20** — *PAL Tool Fabric*: from tool integration to a governed extension platform — a Tool and Plugin SDK for a product that already has three ways to extend it and no way to distribute any of them. PAL's own navigation tree gives away what is missing — Tools sit under Assets, beside Notes and Brand Guidelines, so a tool is something a workspace owns, not something a third party publishes. The missing primitive is not `Tool`; it is `PublishedPlugin`, and the deliverable defines it: publisher identity and signature, protocol version, declared effects, both egress surfaces (the server endpoint *and* the UI iframe's own CSP origins), lifecycle, plus a downloadable four-tool sample. The load-bearing correction is that authority is not a data label and never propagates: sensitivity, integrity and influence travel on edges, while authority is resolved fresh at every call from the principal, the grant and the exact arguments — which is why catalog visibility is not permission. The page ships the gateway itself. Edit a real call's payload and the verdict moves on the field the policy reads while holding steady on the one it doesn't; switch the injection detector off and the untrusted label survives, because detection is not what makes web content untrustworthy. Ten fixtures run in the browser against the same code path the canvas uses. Approve the manifest PAL composed and a token is minted bound to its hash; approve what the plugin's iframe drew instead and it is refused — MCP's sandbox protects the host from the app and says nothing about the app lying to you
- **Day 19** — *PAL Memory Compiler*: a memory and context architecture for long-running agents, built on one distinction — memory is governed state, context is a view compiled for a single step under a credit and latency budget. Records carry three independent axes (kind, governance status, lifecycle status), which turns summary drift from a vague "context rot" complaint into a type error a compiler can refuse by name: a proposal cast as an approval with no authority event. Ships the compiler itself, running in the page. Two evaluations, deliberately labelled differently: the engine recomputes its own policy conformance in your browser (a recency-ranked assembler keeps three of three governed constraints at ten steps and zero of three at two hundred), and a real model was measured — 20 chains per condition, 120 calls — on whether it promotes a hedged $50,000 proposal. It never did, in 40 chains, not even under a prompt that asked what had been *decided*. It deleted the figure outright in nearly half of them instead, on the first summary rather than the fifth. The hypothesis died and produced a better rule than the one it replaced
- **Day 18** — *A self-extending agent runtime*: a minimal but real agent runtime — orchestration loop, tool-calling, two-layer memory — pushed one line further. The tool schema list is recomputed every iteration instead of once, which is the entire difference between an agent that can write a new tool for itself mid-task and use it on the next step, versus one where that tool stays permanently invisible. `create_tool` screens agent-authored code (AST-allowlisted imports, no dunder access, stripped builtins — explicitly documented as not a security boundary) and persists what it writes, so a skill invented in one session is already loaded at the start of the next. OpenAI is wired in as a translation layer rather than a rewrite, bridging two real wire-format differences from the runtime's own internal contract. 39 offline tests pass with no key. Ships with a live trace replay embedded in the page
- **Day 0** — this portfolio site (build → deploy → submit warm-up)
- **Day 1** — *MindPal for Revenue*: a 15-slide pitch selling a multi-agent AI workforce to a VP Sales / CRO
- **Day 2** — *Two product teardowns*: MindPal & PAM reconstructed from the outside (objects, roles, flows)
- **Day 3** — *Under the hood*: how MindPal runs an agent — the runtime harness, inferred from network traces and cross-checked against the docs
- **Day 6** — *The Launch Readiness Committee*: a live multi-agent agent on MindPal — seven functional lenses + a red team + a chair that stress-test whether a product is ready to launch. Run on my own product (VietGuide) it cited real Vietnamese law and found five launch-killing risks nobody owned. Deliverable: the live agent + a one-pager
- **Day 5** — *Console*: the MindPal workspace redesigned — four screens, a cost X-ray that attributes a run to the nodes that spent it, per-workflow drill-down and a failure timeline. Hand-coded, no build step
- **Day 10** — *Chronos*: an architecture and UX design for a cloud sandbox an agent drives on your behalf, written to design-doc form — goals and non-goals, prior art (Firecracker vs gVisor vs containers; Dual-LLM/CaMeL for injection), alternatives rejected, open questions. The execution environment first, then one data type — Effects, shared by the UI, the policy engine and the audit log — plus three pillars: a copy-on-write time machine, an Airlock that holds every irreversible effect at one gate, and a quarantined reader that gives the model touching the web no tools. Ships with a clickable prototype whose layout *is* the argument, and states plainly what rewind cannot take back
- **Day 11** — *Continuity*: an agent that turns a brief into a finished video — and then checks it. Video generation is now bought, not built, so the design targets the one layer nobody sells: is the script sourced, on-brand, and inside its budget. Ten MindPal agents around one structured object, the Cut, where every scene declares which engine and why, what it costs, and every claim it makes. Gates ordered by cumulative spend, a Checker that proposes but never acts, and a browser workbench that catches an example priced at $3.87 which actually costs $5.30
- **Day 12** — *Counterpoint*: two independent lines on one score — the interaction design and architecture for a design canvas a person and an AI agent edit at the same time. Three channels chosen by how hard a change is to reverse; per-actor undo so `Ctrl+Z` never eats work you didn't do; a soft lock that signals without blocking. The load-bearing decision is that operations stream one at a time rather than landing as a batch — it costs more messages, and it's the only reason the agent can be interrupted mid-run. Ships with a working demo: start an alignment run, click anything on the canvas, and the agent drops what it had left
- **Day 13** — *Custody*: a licensed people-data platform canonicalising roughly a billion people, designed backwards from the rule that kills the obvious approach — LinkedIn prohibits automated crawling without express permission, and the one permitted tier may only feed public search-engine indexing, not a commercial enrich API. So the control plane is data rights, not a crawler: every assertion carries source, lawful basis, permitted purposes, jurisdiction and an expiry, enforced at ingest, at query time and at expiry. Counted honestly, 1.2 billion accounts becomes ~500–590 million records a product can actually sell. Ships with a clickable policy gate: four routes into the same profile, four verdicts
- **Day 14** — *Ceiling*: the browser redesigned for a user who has no eyes. Three laws bound what any component may promise — you guarantee only what you enforce inside a boundary you control; a policy decision is worth no more than the oracle supplying its facts; and web content may influence a choice inside granted authority but never create authority, actions or sinks. Two scarce resources are budgeted rather than assumed infinite: human attention (SSL warnings are clicked through 70.2% of the time, malware warnings 10–25% — so the goal is fewer *and* better-framed interruptions) and information leakage. Domain is not a primitive: reading a grant deadline, sending mail, submitting a job application and buying under a price cap all run through one action profile and one `propose → approve → commit → verify` protocol, differing only in who enforces and what evidence survives — which is why the receipt for a job application ends in `remote_state: unknown` rather than a comfortable success. Most of the machinery already exists under other names — WebMCP, ACP's Shared Payment Token, AP2's Checkout Mandate, Web Bot Auth, CaMeL, Macaroons — and the design says so, then marks precisely where each one still leaves a hole. A commerce stress test closes it: approve at 2,890,000 VND, watch the price move to 3,150,000, and see four endings. One of them raises no error at all
- **Day 4** — *Are these agents actually good?*: an eval system — task suite, metrics, four grader tiers, regression detection — then run for real. 45 hand-graded runs, 272 AI credits, and nine of my own hypotheses falsified by the data

## Public annotations

Every day page carries one line:

```html
<script defer src="/assets/comments.js" data-page="dayN"></script>
```

Readers highlight any passage and attach a note to it, or leave a general
comment in the frame at the end. Posting is open and appears immediately — a
deliberate choice, so the API rate-limits to 5 posts per minute per IP, caps
length, and stores comments as plain text that the client renders with
`textContent`. A comment can never become markup on the page.

**Anchors are quoted text, not DOM offsets.** An anchor stores the quote plus
~40 characters of context on each side, and is re-found on load. Storing
positions would break the moment a word is edited earlier in the page and
silently reattach the note to the wrong sentence. Three outcomes:

| Result | Shown as |
|---|---|
| Quote and context both match | anchored, highlighted in place |
| Quote matches, context moved | anchored, flagged *đã dịch chỗ* |
| Quote is gone | *mất neo*, with the text it used to point at |

Admitting a lost anchor beats pointing at the wrong words.

```
api/comments.js        GET · POST · DELETE — Upstash Redis, one list per page
assets/comments.js     the client: anchoring, selection UI, comment frame
tools/comments.mjs     moderation, run locally: list / delete (not deployed)
```

`.vercelignore` excludes `.env*` and `tools/`. This matters more than it looks:
the site deploys every file in the directory as a public asset, so `.gitignore`
alone would have left the Redis credentials fetchable at `/.env.local`.

Deleting requires `ADMIN_TOKEN` in the project environment. Without it the
DELETE route returns 501 rather than being open by default.

## Stack

Plain HTML, CSS and vanilla JavaScript, no build step. One serverless function
for comments, backed by Upstash Redis. Deployed on Vercel.

---
Built with [Claude Code](https://claude.com/claude-code).
