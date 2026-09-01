# The critic loop

**Status:** design, ready to implement. Written 2026-09-02 in answer to his
ask: *"an agent that keeps reviewing you at certain intervals etc. So you
keep you stay in check. Search online how this mechanism should work so you
perform at your best."*

Two labels are used throughout and they mean different things:

- **[RESEARCH]** — a published result, with a URL. If the evidence is weak or
  contested it says so on the same line.
- **[JUDGEMENT]** — my design decision. The research constrains it; it does
  not dictate it.

---

## 0. The answer in one paragraph, and one disagreement with the ask

A critic works when it **runs checks against artifacts the author cannot
edit**, and fails when it **reasons about the author's own account of the
work**. Every strong result in this literature is the first thing; every
negative result is the second. So the mechanism is: a script assembles an
evidence packet (diff, raw test output, raw measurement JSON, the emitted
bundle, the goal file, the findings doc — **never my summary**), a separate
agent applies a fixed checklist built out of *this repo's* recorded failure
classes, and every finding it files must carry a **falsifier**: the command
that settles it either way. Findings land in a ledger, and a release or a
findings-doc append is mechanically blocked while any exposure-class row is
open.

**One disagreement with the framing.** He said "at certain intervals". The
evidence says intervals are the weaker trigger shape, and this repo has the
matching scar: a probe that measures nothing reads exactly like a clean one
(`engine-findings.md` §1). A timer fires whether or not a checkable artifact
exists, and a critic run over no new evidence produces a clean report that
looks identical to a real one. The design below is **event-triggered with a
timer as a backstop that no-ops on an empty diff**. Section 4 defends this.

---

## 1. Does LLM self-critique work? [RESEARCH]

### 1.1 The central negative result

**Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet",
ICLR 2024** — https://arxiv.org/abs/2310.01798

> "In the context of reasoning, our research indicates that LLMs struggle to
> self-correct their responses without external feedback, and at times, their
> performance even degrades after self-correction."

The paper's unit of analysis is *intrinsic* self-correction: the model
revising "based solely on its inherent capabilities, without the crutch of
external feedback." That is exactly the configuration of "read your own
summary and critique it."

**Kamoi et al., "When Can LLMs Actually Correct Their Own Mistakes? A
Critical Survey", TACL 2024** — https://arxiv.org/abs/2406.01297

Sharper, and it is a survey rather than a single experiment. Three findings
that determine this design:

1. **"No prior work demonstrates successful self-correction with feedback
   from prompted LLMs"** except on exceptionally well-suited tasks.
2. Self-correction *does* work when the system can use **reliable external
   verification**.
3. Much of the positive literature used **"impractical frameworks or unfair
   evaluations that over-evaluate self-correction"** — several headline
   results leaked oracle labels (e.g. stopping the loop only when the answer
   became correct).

**Tyen et al., "LLMs cannot find reasoning errors, but can correct them given
the error location", ACL Findings 2024** — https://arxiv.org/abs/2311.08516

This one localises the failure precisely. Models "generally struggle with the
task, even in highly objective, unambiguous cases" when asked to *find* the
mistake; given the ground-truth location they *fix* it fine. Notably: **small
classifiers trained on out-of-domain data outperform prompting large models
at mistake detection.**

> **Design consequence.** The critic's job is not "is this right?" — that is
> the error-finding task the literature says is weak. Its job is "run this
> list of locating procedures against these artifacts." Localisation comes
> from a deterministic check wherever one exists. [JUDGEMENT]

### 1.2 Where it provably helps: external grounding

Every positive result in this space imports a signal from outside the model.

- **CRITIC (Gou et al., ICLR 2024)** — https://arxiv.org/abs/2305.11738 —
  "humans typically utilize external tools to cross-check and refine their
  initial content." Tools used: **search engines** for fact-checking, **code
  interpreters** for math/program synthesis. The critique is verified, not
  imagined.
- **Reflexion (Shinn et al.)** — https://arxiv.org/abs/2303.11366 — 91%
  pass@1 on HumanEval against GPT-4's 80%. The framework accepts feedback
  from "external or internally simulated" sources — but the coding result is
  driven by **unit tests**, an executable oracle.
- **Self-Refine (Madaan et al.)** — https://arxiv.org/abs/2303.17651 —
  the widely-cited positive result for pure self-feedback. Kamoi's survey
  (above) is the reason to treat it cautiously: its gains concentrate on
  open-ended generation tasks, not on tasks with a checkable answer, and it
  is among the works whose evaluation protocol the survey criticises. **Weak
  support; do not build on it.**
- **Constitutional AI (Bai et al.)** — https://arxiv.org/abs/2212.08073 —
  the critique-and-revise loop is grounded in an *external written document*:
  "the only human oversight is provided through a list of rules or
  principles." The model is not asked for its opinion; it is asked to check
  against a text it did not write.

> **Design consequence.** Constitutional AI is the direct precedent for the
> checklist in §3. `docs/engine-findings.md` §1 and §9 are already that
> document — a written list of principles and failure modes, authored across
> many sessions, that no single critic run gets to rewrite. [JUDGEMENT]

### 1.3 Is verifying easier than generating?

**Song et al., "Mind the Gap: Examining the Self-Improvement Capabilities of
LLMs", ICLR 2025** — https://arxiv.org/abs/2412.02674

Introduces the **generation-verification gap** and shows "a variant of the
generation-verification gap scales monotonically with the model pre-training
flops."

So: verification is genuinely easier than generation — but it is a *gap*, not
a guarantee, and it is **model-dependent and scale-dependent**. That is the
research basis for spending a capable model on the critic role specifically,
rather than assuming any model can verify what a strong model produced.

---

## 2. Multi-agent review, judging, and the critic's own failure modes
[RESEARCH]

### 2.1 An independent critic beats a self-critique pass — but for a
### mechanical reason worth knowing

**Panickssery, Bowman & Feng, "LLM Evaluators Recognize and Favor Their Own
Generations"** — https://arxiv.org/abs/2404.13076

Models have "non-trivial accuracy at distinguishing themselves from other
LLMs and humans," and there is a **linear correlation between self-recognition
capability and self-preference bias strength**, shown causal via fine-tuning.
An evaluator "scores its own outputs higher than others' while human
annotators consider them of equal quality."

> **Design consequence, and it is the sharpest one in this document.** The
> strongest self-recognition signal in any evidence packet is *my prose*. A
> diff and a JSON ring carry far less authorial fingerprint than a paragraph
> of my writing. So "never against my own summary" is not only about
> anchoring — it also strips the signal that drives self-preference.
> [JUDGEMENT, built on the causal finding above]

### 2.2 Judge biases

**Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena",
NeurIPS 2023 D&B** — https://arxiv.org/abs/2306.05685

Names **position, verbosity, and self-enhancement biases, plus limited
reasoning ability**. Also the positive half: strong judges reach "over 80%
agreement" with human preferences — "the same level of agreement between
humans."

Reading: LLM judging is usable, and it is biased in named, avoidable ways.
Avoid pairwise A/B with a fixed presentation order (position bias). Never
reward length (verbosity bias). Never let a model score its own output
(self-enhancement).

### 2.3 Sycophancy — why the critic must not see my conclusion first

**Sharma et al. (Anthropic), "Towards Understanding Sycophancy in Language
Models"** — https://arxiv.org/abs/2310.13548

"When a response matches a user's views, it is more likely to be preferred,"
and "both humans and preference models prefer convincingly-written
sycophantic responses over correct ones a non-negligible fraction of the
time." Optimising against preference models "sometimes sacrifices truthfulness
in favor of sycophancy."

> **Design consequence.** A critic asked "do you agree with this conclusion?"
> is being run in the configuration this paper describes. It must produce its
> own findings from artifacts *before* it is shown any claim of mine. §5.2
> makes that a two-phase protocol. [JUDGEMENT]

### 2.4 Debate: real, but conditional and not free

**Khan et al., "Debating with More Persuasive LLMs Leads to More Truthful
Answers"** — https://arxiv.org/abs/2402.06782

Debate raises non-expert accuracy: **models 48% → 76%, humans 60% → 88%**.
The debaters have access to the underlying evidence (verified quotes); the
judge does not. So the mechanism is *evidence surfacing under adversarial
pressure*, not argument quality per se.

**Smit et al., "Should we be going MAD? A Look at Multi-Agent Debate
Strategies for LLMs"** — https://arxiv.org/abs/2311.17371

The counterweight: multi-agent debate "do[es] not reliably outperform other
proposed prompting strategies, such as self-consistency and ensembling using
multiple reasoning paths," and is more sensitive to hyperparameters.

**Cemri et al., "Why Do Multi-Agent LLM Systems Fail?"** —
https://arxiv.org/abs/2503.13657

MAST taxonomy: **14 failure modes in 3 categories — system design issues,
inter-agent misalignment, and task verification** — from 1600+ annotated
traces across 7 frameworks (κ = 0.88 on the 150-trace development set). And:
"performance gains on popular benchmarks are often minimal."

> **Design consequence.** Do not build a debate parliament. **One critic**,
> grounded in evidence, escalating to **one second opinion from a different
> model** only on a contested finding. Every extra agent is a draw against
> MAST's failure catalogue. [JUDGEMENT]

### 2.5 Escalation is predictable; protocol choice is not

**Yang et al., "LLMs Can Predict Failure Risk, But Struggle to Predict Which
Collaboration Protocol Pays Off", 2026** — https://arxiv.org/abs/2608.14927

Across 4,181 competition math problems plus four robustness benchmarks: a
post-answer probe ranks baseline failures at **0.8847 AUROC**, and remains
informative for "does *any* collaboration help" (0.7683 AUPRC) — but is
**much weaker for choosing between protocols (0.1674 and 0.1041 AUPRC)**.
Also: "conservative policies under-escalate, whereas higher-solve frozen
routers often over-escalate."

> **Design consequence.** A cheap signal can decide *whether* to escalate.
> Do not build machinery to choose *which kind* of review; it does not work.
> And a fixed conservative cadence is the named failure — it under-fires.
> [JUDGEMENT]

---

## 3. Human analogues with actual evidence [RESEARCH]

### 3.1 Checklists — and the contested half nobody quotes

**Haynes et al., "A Surgical Safety Checklist to Reduce Morbidity and
Mortality in a Global Population", NEJM 2009** —
https://doi.org/10.1056/NEJMsa0810119

Eight hospitals, 3,733 patients before / 3,955 after a 19-item checklist:
"The rate of death was **1.5% before** the checklist was introduced and
declined to **0.8%** afterward (P=0.003). Inpatient complications occurred in
**11.0%** of patients at baseline and in **7.0%** after."

**Urbach et al., "Introduction of Surgical Safety Checklists in Ontario,
Canada", NEJM 2014** — https://doi.org/10.1056/NEJMsa1308261

101 hospitals, 109,341 procedures before / 106,370 after **mandatory**
province-wide adoption: adjusted death risk **0.71% → 0.65% (OR 0.91, 95% CI
0.80–1.03, P=0.13)**; complications **3.86% → 3.82% (OR 0.97, P=0.29)**. No
significant benefit.

> **This pair is the most useful thing in the whole literature review.**
> Checklists work when the items are specific, owned by the people using
> them, and adopted because they catch things. They do nothing when adopted
> as compliance ritual. So the checklist in §3.4 must be **derived from this
> repo's own recorded defects**, and it must be **revised when it stops
> catching things** (§7). A generic "review this code" checklist is the
> Ontario arm. [JUDGEMENT]

### 3.2 Pre-mortem / prospective hindsight

**Mitchell, Russo & Pennington, "Back to the future: Temporal perspective in
the explanation of events", Journal of Behavioral Decision Making, 1989** —
https://doi.org/10.1002/bdm.3960020103

The prospective-hindsight result: framing an outcome as *already having
happened* and asking why produces more, and more specific, causes than asking
for a prediction. Klein's project-premortem framing (HBR, 2007) is the
management popularisation of this.

> Used as the last checklist item: *"this is on his phone tomorrow and he
> reports it is worse — write the three most likely mechanisms."*

### 3.3 Devil's advocate: works, but only if the dissent is real

**Schwenk, "Effects of devil's advocacy and dialectical inquiry on decision
making: A meta-analysis", Organizational Behavior and Human Decision
Processes, 1990** — https://doi.org/10.1016/0749-5978(90)90051-A — structured
dissent methods beat expert/consensus approaches on decision quality.

**Nemeth, Brown & Rogers, "Devil's advocate versus authentic dissent:
stimulating quantity and quality", European Journal of Social Psychology,
2001** — https://doi.org/10.1002/ejsp.58 — **authentic dissent outperforms
role-played devil's advocacy.**

> **Design consequence.** Do not prompt the critic to "be harsh" or "play the
> skeptic". Role-play produces performed dissent, which is the weaker arm.
> Give it genuine independent evidence access and a real veto (§5.3) so its
> dissent is authentic. [JUDGEMENT]

### 3.4 Code review, and the operational gold standard

**Bacchelli & Bird, "Expectations, outcomes, and challenges of modern code
review", ICSE 2013** — https://doi.org/10.1109/ICSE.2013.6606617 — finding
defects is the top stated expectation, but the dominant realised outcomes are
knowledge transfer and design discussion; **reviewer understanding of the
changed code is the limiting factor**. *(Abstract not retrievable through the
paywall; this is the paper's well-established headline finding, not a
verbatim quote.)*

**Sadowski et al., "Modern code review: a case study at Google", ICSE-SEIP
2018** — https://doi.org/10.1145/3183519.3183525 — Google's review culture is
built on **very small changes** reviewed by **very few reviewers**. *(Same
caveat: abstract not retrievable.)*

**Sadowski, van Gogh, Jaspan, Söderberg & Winter, "Tricorder: Building a
Program Analysis Ecosystem", ICSE 2015** —
https://research.google/pubs/tricorder-building-a-program-analysis-ecosystem/

This is the most directly transferable source in the review, and I extracted
it verbatim from the PDF:

> "To an analysis writer, a false positive is an incorrect report produced by
> their analysis tool. However, to a developer, a false positive is any
> report that they did not want to see. We prefer to use the term **effective
> false positive** … any report from the tool where a user chooses not to
> take action to resolve the report."

> "We still enforce a very low effective false positive rate here (**< 10%**).
> Additionally, we only display results for most analyses **on changed lines**
> by default."

> "A rate **≥ 10%** puts the analyzer **on probation**, and the analysis
> writer must show progress toward addressing the issue. If the rate goes
> above **25%**, we may decide to **turn the analyzer off** immediately."

Their four criteria for admitting a new check: (1) easy to understand, fix
clear, obvious and actionable; (2) **"Developers should feel that we are
pointing out an actual issue at least 90% of the time"**; (3) potential for
significant impact; (4) **"occur with a small but noticeable frequency … if a
warning occurs too frequently, it's likely that it's not causing any real
problems. We don't want to overwhelm people with too many warnings."**

And on why noisy tools die: FindBugs, Coverity and Klocwork "have largely
fallen out of use due to problems with workflow integration, scaling, and
false positives … the command-line tool was used by only 35 developers in
2014 (and by 20 of those only once)."

> **This is the calibration regime for the critic, adopted whole.** §7.

---

## 4. When it runs

### 4.1 Why not fixed intervals

Four independent lines of evidence, and one from this repo:

- **Huang / Kamoi**: the value comes from checking against external
  artifacts. A timer fires whether or not a checkable artifact exists.
- **Tricorder**: results shown "on changed lines"; warnings must occur at a
  "small but noticeable frequency". Tie review to the change, not the clock.
- **Yang et al. 2026**: "conservative policies under-escalate." A fixed
  cadence is exactly a conservative fixed policy.
- **Urbach 2014**: mandatory scheduled adoption of a checklist produced no
  measurable effect.
- **This repo, `engine-findings.md` §1**: *"A probe that measures nothing
  reads exactly like a clean one."* A critic run over an empty diff returns a
  clean report indistinguishable from a real one, and those accumulate into
  false confidence.

### 4.2 The trigger set [JUDGEMENT]

| # | Trigger | Blocking? | Model | Checklist scope |
|---|---|---|---|---|
| **T1** | **Before any release** — `gh release create`, manifest push, `rules/tuning.json` push | **YES** | Opus | Full |
| **T2** | **A claim becomes a number** — any new/edited table or "measured X" line in `engine-findings.md` | **YES**, on that claim | Opus | C1, C5, C10, C11, C12 |
| **T3** | Diff touches a decision-layer file: `person-track`, `body-clamp`, `scene-gate`, `video-region`, `region-blur`, `init-entry`, `person-gate`, `tuning` | No | Opus | Full |
| **T4** | A test is added or changed | No | Sonnet | C2, C3 only |
| **T5** | A previous finding is struck / retracted | No | Opus (different model from the one that produced the struck claim) | C12 + full |
| **T6** | **Backstop timer, 90 min** — *no-ops if `git diff` since last run is empty* | No | Sonnet | Full, but small diff |

T1 is the only hard block on wall-clock, and it earns it: a release is
irreversible and reaches his phone. T2 blocks the *claim*, not the work — I
can keep going, I just cannot write the number into the findings doc.

The T6 no-op guard is the whole point of T6. It exists so a long unattended
stretch cannot pass unreviewed, **not** to pace the work.

---

## 5. What the critic reads, and in what order

### 5.1 The evidence packet

Assembled by `bench/critic-packet.mjs`, which I do not edit per-run. That
constraint is load-bearing — see §9.

**In:**

| Artifact | Why |
|---|---|
| `git diff <base>..HEAD` | the actual change |
| `git log --oneline <base>..HEAD` (subjects only) | what was claimed, minimally |
| `npm test` and `cargo test` raw stdout + exit codes, captured to file | executable oracle (Reflexion/CRITIC) |
| raw measurement files touched in range: `spikes/gauntlet/*.json`, bench output, device rings | the numbers, not my table |
| path to the **emitted bundle** | `engine-findings.md` §9 — verify constants in the build, never the source |
| `docs/run-goal.md` | the standing brief |
| `docs/engine-findings.md` | the constitution (Constitutional AI precedent) |
| `docs/critic/ledger.md` | so it does not re-file a settled finding |

**Out — and this is a hard rule:**

- my session summary or landing report
- my CLAUDE.md session entry
- commit message bodies beyond the subject line
- any prose in which I state a conclusion

**Why the exclusion is right, in three research terms:**

1. **Huang / Kamoi** — feeding my summary converts an external check into
   intrinsic self-correction, the configuration with the negative result.
2. **Panickssery** — my prose is the strongest self-recognition signal
   available, and self-recognition causally drives self-preference.
3. **Sharma** — a stated position invites sycophantic agreement, and
   "convincingly-written" is precisely what a good summary is.

The repo arrived at this rule empirically ("never against my own summary").
The literature says it is the single most important parameter in the design.

### 5.2 Two-phase, sealed-envelope [JUDGEMENT]

The exclusion above has one cost: the critic cannot catch a *false claim in
prose* — a number in my summary that no artifact supports. Two phases fix it
without reintroducing anchoring:

- **Phase A — independent.** Packet as above. The critic produces its findings
  with no access to any claim of mine. Written to disk and hashed.
- **Phase B — contradiction only.** My summary is appended. The critic is
  asked exactly one question: *"which of these claims is contradicted or
  unsupported by the Phase A evidence?"* It may **not** revise, soften, or
  withdraw a Phase A finding in Phase B. The hash proves it did not.

Phase B is where "the counters said nothing was wrong" (CLAUDE.md, loop 40)
gets caught: a claim of health that no artifact in the packet supports.

### 5.3 The checklist — the constitution [JUDGEMENT, derived from
### `engine-findings.md` §1 and the retraction record]

Each item is a **procedure**, not a question. Per Tyen et al., the critic is
bad at open-ended error finding and good at executing a locating procedure.

```
C1  INSTRUMENT. For every number in the diff or the raw files: name a
    mechanism by which the instrument would produce this exact number with
    the code broken. Check specifically:
      - probe hit-tests one of our overlays  -> did it set pointerEvents='auto'?
      - probe counts patches                 -> does it check display/visibility?
      - number is a b-minus-a on a counter   -> is that counter a saturating ring?
      - counter reads 0                      -> did the WebView pid change (fresh counter)?
      - any failure/timing number             -> emulator uptime; was it re-run after a restart?

C2  CAN-THIS-TEST-FAIL. For every new or changed test, name the single
    assertion that breaks and the exact source edit that turns it red.
    File a finding for any test where you cannot. Known shapes here:
      - a `#[test]` attribute missing (ten live assertions, never ran)
      - a string match on source rather than a call into the code
      - a fixture whose precondition does not hold (boxes that never overlap)
      - an assertion that restates line 1 of the predicate under test

C3  PATH. Does the test/bench exercise the path the defect lives in? A
    regression test that calls updatePersonTracks does not cover an
    exposure that lives in init-entry.

C4  SHIPPED-NOT-SOURCED. Any constant claimed changed: grep the EMITTED
    bundle for it. Source is not evidence. A constant has shipped dead
    here for six rounds.

C5  FLAT-SWEEP. Any sweep reported flat: prove the arm can move at all by
    an absurd value. Two "flat" results this month were arms calling
    module-level functions instead of the variant's.

C6  MONOTONE-DIRECTION. Which way does this move exposure? Test any claim
    of the form "this can only cover more" against track death and coast
    expiry — that exact claim was false once via coastStep.

C7  COUNTERS. Does a new counter reuse an existing name (silently
    rebasing every prior reading)? Does it reach buildReport? Is it seeded
    to 0 so absent is distinguishable from never-hooked?

C8  SCOPE. Anything in the diff the ask did not name? Anything matching
    .env* / **/auth/** / **/payment*/** / **/migrations/** / *.sql /
    .github/workflows/** / src-tauri/capabilities/** / any filename
    containing key|secret|token|credential?

C9  OWNER RULES. Walk engine-findings.md §9 line by line against the diff:
    solid patches (no holes/splits/silhouettes), blur-first, BLOCK-ONLY,
    no code over OTA (JSON-escaped string, never an object literal),
    non-fullscreen 360p is the target regime, emitted-bundle verification.

C10 REGIME. Was this measured in HIS regime — 38-64px band, 360p,
    non-fullscreen, his device or the matching corpus band? A number from
    another regime is not evidence for this one.

C11 STALE HARNESS. Emulator uptime, WebView pid, adb session age, whether
    a failure was re-observed after a restart.

C12 CONTRADICTION. Does any claim in the packet contradict an entry in
    engine-findings.md? One of them is wrong. Say which, and how to settle.

C13 PRE-MORTEM. This is on his phone tomorrow and he reports it is worse.
    Write the three most likely mechanisms, ranked, each naming the
    counter or file that would show it.
```

### 5.4 Finding format — the falsifier rule

Every finding must carry all five fields. **A finding with no runnable
falsifier is not filed.**

```
SEVERITY  EXPOSURE | WRONG-NUMBER | DEAD-CHECK | SCOPE | NIT
WHERE     file:line, or the artifact + key
CLAIM     one sentence, mechanical, no adjectives
FALSIFIER the exact command or measurement that settles it either way
COST      what it costs him if true, in his terms (seconds of exposure,
          false cover, a sharp face)
```

The falsifier requirement does three jobs at once: it is Tricorder's
"actionable, fix clear" admission criterion; it is the operational form of
"critique needs external grounding"; and it mechanically kills generically
negative findings — *"consider adding more tests"* has no falsifier, so it
cannot be filed.

---

## 6. Output, routing, and how a finding forces my hand

### 6.1 Where it goes

- Full report: `docs/critic/<UTC>-<trigger>.md` (Phase A hash in the header).
- One row appended to `docs/critic/ledger.md`:

```
| id | date | trigger | severity | claim | falsifier | verdict | resolution | evidence |
```

### 6.2 The gate — this is what stops me ignoring it [JUDGEMENT]

`bench/critic-gate.mjs` exits non-zero while any ledger row of severity
`EXPOSURE` or `WRONG-NUMBER` has verdict `OPEN`. It is wired into:

- the release recipe, before `gh release create`;
- the path that appends to `docs/engine-findings.md`.

So the mechanism is not "I should consider the critic's findings." It is
**the release command fails**. That is the only version of this that survives
hour six of an unattended run.

Deliberately **not** gated: ordinary commits and pushes on a branch. Gating
those would fire constantly and produce exactly the alarm fatigue Tricorder
documents.

---

## 7. Disagreement: how a finding gets closed

Every row reaches exactly one of three verdicts, and **each demands an
artifact, not an argument.**

| Verdict | What it requires |
|---|---|
| `CONFIRMED` | a commit that fixes it **plus** a check that was red before the fix and green after |
| `REFUTED` | the falsifier was **run**, and its **raw output is pasted into the row** |
| `ACCEPTED-COST` | cite the `engine-findings.md` §9 line that makes this a cost rather than a bug (e.g. a cleared man inside someone else's patch) |

**A finding I overrule by reasoning alone stays `OPEN` and keeps blocking.**

That rule is not invented. This repo already discovered both halves:

- The critic being right when I was confident: it found a real exposure in a
  shipped fix on its first run, and it found this repo's own null-band gate
  refusing a real woman.
- The critic being correctly rejected — and every time, the rejection was
  backed by **data or a code fact**, and written into the source: the 0.17
  keypoint floor (three frames in that band are real people's hands); the
  `gender !== 'male'` guard shown vacuous on 3,188 in-band reads; the
  `refreshRects` path rejected in favour of the render loop on a ~16ms vs
  ~250ms measurement.
- And the inverse, recorded in loop 37c: *"the second critic ran experiments
  instead of arguments and killed my fix."*

**Evidence beats argument in both directions.** That is the whole protocol.

Escalation, and only here: if the critic re-files a `REFUTED` finding, or if a
finding is `EXPOSURE`-class and I disagree, run **one** second opinion from a
**different model** on the Phase A packet plus both positions. Different
model, per Panickssery — a second pass by the same model on the same text is
the weakest available check. Do not go to three. (Smit et al.; Cemri et al.)

---

## 8. Keeping the critic honest

Three mechanisms. The repo's own standard applies: *a counter nobody has seen
fire is a claim*, and so is a critic nobody has measured.

### 8.1 The falsifier requirement (§5.4)

Structural. Cannot be gamed by writing more.

### 8.2 Seeded-defect calibration

`bench/critic-seed.mjs` holds ~10 patches, each a **one-line reversion of a
real defect from this repo's history**:

1. remove a `#[test]` attribute from a Rust test function
2. revert `faceEvidence = faces.length` to `noShape ? 0 : faces.length`
3. rename `bodyClampFired` back to `clampFired` (silent counter collision)
4. delete the `!persons.skipped` guard in `emptyFrame`
5. point a bench variant arm at the module-level function instead of the
   variant's (the flat-sweep defect)
6. make a clamp test fixture non-overlapping (vacuous precondition)
7. change a constant in source but not in `rules/tuning.json`
8. hand an ImageData-shaped object to `lumaGrid` (NaN → zero cuts)
9. drop a new counter from `buildReport`'s pass-through
10. move `isNullRead` back above the child branch (ordering defect)

Weekly, and on **any change to the critic prompt or model**: apply one at
random in a scratch worktree, run the critic blind, record hit/miss in
`docs/critic/calibration.md`. Rotate the seed set as new defect classes are
found — a seed the critic has memorised is worthless.

### 8.3 Tricorder accounting, thresholds adopted whole

Define, per trigger class:

- **effective false positive** = a finding whose falsifier was run and showed
  the finding wrong (`REFUTED`), plus any `NIT` I chose not to act on. This is
  Tricorder's definition — *any report the developer did not want to see* —
  and it is deliberately harsher than "incorrect".
- **miss** = a defect later found by another route (his report, a device run,
  a retraction) where the critic *had the diff in its packet* and did not file
  it.

Thresholds, taken from Tricorder verbatim:

- **≥ 10% effective FP rate → that trigger class goes on probation.** Narrow
  its scope (changed lines only) or tighten the prompt. Progress must be
  shown.
- **≥ 25% → switch that trigger class off** until it is fixed.
- Target, from their admission criterion: **the critic should be pointing at
  an actual issue at least 90% of the time.**

The **miss** rate is the number that says the *checklist* needs a new item.
An FP problem is a prompt problem; a miss problem is a constitution problem.
They are fixed differently.

---

## 9. Cost, model choice, cadence in practice

**Model per role** — the project rule ("if you can write the brief as steps
it is Sonnet; if the brief is a question it is Opus") lines up with the
generation-verification gap result (§1.3):

| Role | Model | Why |
|---|---|---|
| T4 test-check, T6 small-diff backstop | **Sonnet** | pure checklist application, writable as steps |
| T1 release, T2 claim, T3 decision layer, T5 retraction | **Opus** | the brief is "what would make this number wrong?" |
| Second opinion on a contested finding | **a different model from the first critic** | Panickssery — self-recognition drives self-preference |

**Wall clock, honest estimates:**

- packet assembly: seconds (a script)
- Sonnet T4/T6 pass: ~2 min
- Opus T1/T2/T3 pass: 5–15 min, the upper end when it runs a bench arm or
  reads a device ring
- typical loop here (one substantive change + one measurement + maybe a
  release) → 2–4 critic runs → **~20–40 min of the loop's wall clock**, mostly
  overlapped because everything except T1 runs in the background while I write
  the findings entry
- T6 on an idle stretch: near zero, because it no-ops on an empty diff

That is the real cost, and it is the reason the trigger set is narrow. A
critic every 25 minutes on work that takes three hours would spend more wall
clock than the work, and — per Tricorder — a tool that fires too often stops
being read.

---

## 10. What the critic must never be asked

- **"Is this good?"** Holistic quality judgement is where verbosity and
  self-enhancement bias live (Zheng et al.) and where sycophancy lands
  (Sharma et al.). Every question in the checklist is a procedure with a
  checkable answer.
- **"Do you agree with my conclusion?"** — §2.3.
- **"Play the harsh skeptic."** Role-played devil's advocacy is the weaker arm
  (Nemeth et al. 2001). Give it evidence access and a real veto instead.
- **Anything requiring it to rank two of my outputs in a fixed order** —
  position bias (Zheng et al.).
- **To review its own prior report.** Same model, same text, worst case.

---

## 11. Implementation order

1. `bench/critic-packet.mjs` — assemble the packet, refuse to include any
   file under `docs/critic/` written this run, and refuse my summary.
2. `docs/critic/ledger.md` + `docs/critic/CHECKLIST.md` (§5.3 verbatim).
3. `bench/critic-gate.mjs` — exit non-zero on open EXPOSURE/WRONG-NUMBER.
   **Break it deliberately and watch the release recipe fail** before trusting
   it. (`engine-findings.md` §1, last bullet.)
4. Wire T1 (release) and T2 (findings append) — the two blocking triggers.
5. Wire T3/T4 as background spawns.
6. T6 timer with the empty-diff no-op.
7. `bench/critic-seed.mjs` + first calibration run. **A critic that has never
   been measured against a known defect is a claim.**

---

## 12. The single thing most likely to make this fail

Reading the emitted bundle, the raw device rings and the measurement JSON is
slow and expensive, and my summary is a compressed, accurate, *convenient*
substitute. The temptation, at hour six, is to hand the critic the summary
"to save time."

The moment that happens the mechanism silently becomes **intrinsic
self-correction** — the exact configuration Huang et al. show *degrades*
performance — while continuing to produce confident, well-formatted reports
that look identical to real ones. It is the repo's own §1 failure in a new
shape: a critic that checks nothing reads exactly like a clean one.

That is why the packet is assembled by a script with a hard exclusion rule,
why Phase A is hashed before my summary is ever shown, and why §8.2 re-runs
calibration on **any** change to the critic prompt.

---

## Sources

- [Huang et al., Large Language Models Cannot Self-Correct Reasoning Yet (ICLR 2024)](https://arxiv.org/abs/2310.01798)
- [Kamoi et al., When Can LLMs Actually Correct Their Own Mistakes? (TACL 2024)](https://arxiv.org/abs/2406.01297)
- [Tyen et al., LLMs cannot find reasoning errors, but can correct them given the error location (ACL Findings 2024)](https://arxiv.org/abs/2311.08516)
- [Gou et al., CRITIC: Tool-Interactive Critiquing (ICLR 2024)](https://arxiv.org/abs/2305.11738)
- [Shinn et al., Reflexion](https://arxiv.org/abs/2303.11366)
- [Madaan et al., Self-Refine](https://arxiv.org/abs/2303.17651)
- [Bai et al., Constitutional AI](https://arxiv.org/abs/2212.08073)
- [Panickssery et al., LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/abs/2404.13076)
- [Zheng et al., Judging LLM-as-a-Judge (NeurIPS 2023 D&B)](https://arxiv.org/abs/2306.05685)
- [Sharma et al., Towards Understanding Sycophancy in Language Models](https://arxiv.org/abs/2310.13548)
- [Khan et al., Debating with More Persuasive LLMs Leads to More Truthful Answers](https://arxiv.org/abs/2402.06782)
- [Smit et al., Should we be going MAD?](https://arxiv.org/abs/2311.17371)
- [Cemri et al., Why Do Multi-Agent LLM Systems Fail? (MAST)](https://arxiv.org/abs/2503.13657)
- [Song et al., Mind the Gap (ICLR 2025)](https://arxiv.org/abs/2412.02674)
- [Yang et al., LLMs Can Predict Failure Risk, But Struggle to Predict Which Collaboration Protocol Pays Off (2026)](https://arxiv.org/abs/2608.14927)
- [Sadowski et al., Tricorder: Building a Program Analysis Ecosystem (ICSE 2015)](https://research.google/pubs/tricorder-building-a-program-analysis-ecosystem/)
- [Sadowski et al., Lessons from Building Static Analysis Tools at Google (CACM 2018)](https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/)
- [Sadowski et al., Modern code review: a case study at Google (ICSE-SEIP 2018)](https://doi.org/10.1145/3183519.3183525)
- [Bacchelli & Bird, Expectations, outcomes, and challenges of modern code review (ICSE 2013)](https://doi.org/10.1109/ICSE.2013.6606617)
- [Haynes et al., A Surgical Safety Checklist… (NEJM 2009)](https://doi.org/10.1056/NEJMsa0810119)
- [Urbach et al., Introduction of Surgical Safety Checklists in Ontario, Canada (NEJM 2014)](https://doi.org/10.1056/NEJMsa1308261)
- [Mitchell, Russo & Pennington, Back to the future (JBDM 1989)](https://doi.org/10.1002/bdm.3960020103)
- [Schwenk, Effects of devil's advocacy and dialectical inquiry: A meta-analysis (OBHDP 1990)](https://doi.org/10.1016/0749-5978(90)90051-A)
- [Nemeth, Brown & Rogers, Devil's advocate versus authentic dissent (EJSP 2001)](https://doi.org/10.1002/ejsp.58)
