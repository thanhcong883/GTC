# Test cases — three launch briefs

Paste into the Form's `launch_brief` field to demo the committee. Each makes a different
point. Case A is the lead demo — it looks ready but hides the launch-killer.

---

## Case A — looks ready, one fatal blind spot  ⭐ lead demo

```
Product: Jotdown — an AI note-taking app that records your meetings, transcribes them,
and auto-generates summaries and action items. Web + mobile.

Engineering: Backend is on AWS, load-tested to 10k concurrent users, which is 5x our
expected launch traffic. Staging mirrors production. We have a green/blue deploy so we
can roll back in under a minute. Datadog alerts wired to the on-call phone.

Product: Onboarding is a 3-step guided flow that ends with the user recording their first
meeting — tested with 20 beta users, 18 reached a first summary without help. Empty states
and error toasts are designed. Mobile is polished.

Marketing: Landing page live, Product Hunt launch scheduled, a 6-email sequence ready,
and three influencer partners lined up. Positioning: "Never take meeting notes again."
Price: $12/mo, decided.

Support: We have a Notion help center with 15 articles and an in-app chat widget.

We're ready. Launch is Tuesday.
```

**Why this is the demo:** the founder is proud of Engineering and Marketing — both genuinely
strong. But the product **records and stores people's meetings**, and the brief says
*nothing* about a privacy policy, terms of service, where transcripts are stored, or
consent from the *other people in the meeting* (a real legal issue for call recording).
The **Legal lens must flag this as a BLOCKER**, and **Support should flag** that the #1
predictable day-one ticket — "who can see my meeting transcripts / is my data private?" —
isn't answered anywhere in 15 articles about features. Nobody owned the seam between
"we handle sensitive user data" and "we told users how." That's the launch-killer, and no
single person saw it. The committee does.

---

## Case B — early stage, gaps everywhere

```
Product: A marketplace connecting freelance designers with small businesses.

We've built the core booking flow and it works in demo. The design looks clean. We think
there's real demand — every small business needs design work.

We want to launch next week to start getting users.
```

**Why:** almost everything is UNCONFIRMED. Every lens should return "gaps," and the Chair
should rule **DELAY** — not because any one thing is broken, but because the brief confirms
almost nothing across five functions. Demonstrates the committee catching "we're not as
ready as we feel," and that many small gaps add up to a DELAY even with no single blocker.

---

## Case C — genuinely close, minor risks

```
Product: A Chrome extension that blocks distracting websites on a schedule.

Engineering: It's a static extension, no backend, no user data leaves the device. Reviewed
and passing the Chrome Web Store policy check. Auto-update via the store.
Product: One screen, tested with 30 users, onboarding is a single tooltip. Works offline.
GTM: Landing page done, launching on the Chrome store + a Reddit post. Free with a $3
one-time pro unlock. Success = 1,000 installs in month one.
Support: A one-page FAQ covers the 5 questions beta users actually asked. Email support.
Legal: No data collected, no account, no PII. Privacy policy states "we collect nothing,"
which is true. Extension permissions are minimal and justified.
```

**Why:** this one is actually close to ready — small scope, no data, no backend removes
whole categories of risk. The committee should rule **GO** or **GO WITH KNOWN RISKS**,
showing it doesn't cry wolf: when a launch is genuinely ready, it says so. A committee that
only ever says DELAY is useless — Case C proves it discriminates.
