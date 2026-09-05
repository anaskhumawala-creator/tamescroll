# What survives a port

Written 2026-09-05, after the round that fixed the GPU arbiter and
answered the bearded-men complaint. The occasion was a product question
— iOS, and whether this can ship on either store — but the useful output
is narrower and more durable: **which of the last several months of work
is knowledge about the problem, and which is knowledge about Android.**

The split matters because the first kind is expensive and was paid for
in nights of measurement; the second is a week of rewriting. Anyone
starting a second platform should carry the first across and re-derive
none of it.

---

## 1. The rules that are about MEASUREMENT, not about Android

Every one of these was earned by a wrong published number. They apply to
any platform, any language, any model.

**Matched exposure or the number is meaningless.** The clear bar sits far
above the label boundary — `GENDER_CLEAR_SCORE` 0.45 male means raw
≥ 0.725 — so a label flip between 0.50 and 0.725 changes nothing that
ships. Any arm can win an accuracy column by leaning female, which is a
threshold move wearing a disguise. Tune each arm's own bar to a COMMON
exposure, then read false cover. Findings 29, 40, 41, 45, 47 and 50 all
turned on this, and one of them was caught the same day it was written.
Print AUC beside the table: a bar solver can move a matched-exposure
cell, nothing moves AUC.

**Count people, not rows.** The corpus is 2,159 reads and only 51
clusters across ten videos, so a leave-one-video-out fit sees ~46
distinct identities. Finding 51 looked like a result about label quality
and was a result about n.

**An instrument that re-derives a shipped rule is a check that cannot
fail.** Caught three times in one session, each written after the rule
forbidding it. The remedy worked all three times: move the rule into a
module, call it from both sides, delete the copy.

**A bench that reports a bound must name the rows behind it.** Finding
48's "open these frames" section is what caught its own 388-vs-5 error.

**A median bounds nothing on the left tail.** A reviewer argued a
threshold never fires, from a p50 of 8.7. Measured directly on the
device: it fires on 17.3% of ticks. If the claim is about a tail, measure
the tail.

**Break an assertion to prove a new test can fail.** This repo has
shipped a check that could not fail more than once.

**Verify a constant in the EMITTED artifact, and verify it is READ.** A
constant once shipped dead as `var IY;` for six rounds; the image null
guard shipped dead for five. Grep the built bundle for the constant being
*used*, not merely present.

**An instrument must not overstate its own n.** A probe here printed
"over 3 videos" while two had been discarded for never advancing. It now
names what it dropped.

---

## 2. What is true about the PROBLEM, and will be true on any device

**The gender model is the wall, and three independent routes say so.**
The detector is innocent: over 3,809 whole frames at the player's own
640×360, only 0.1% of detections fired on no human shape. The largest
single source of wrong marks is a real person the classifier cannot
commit to.

**Faceres reads tone and polarity, not geometry.** Inverting an image
collapses accuracy while preserving every shape; greyscale input beats
RGB; blueOnly is the worst single channel and redOnly the best. This is
why grey works — it changes the *input* rather than re-reading the same
signal. It is also why every idea that re-reads another head or layer of
the same trunk is drawing from one well (finding 46 measured
pearson 0.893 between the head and a descriptor probe).

**Face size predicts error better than anything else.** Under 60px,
30.3% of male reads fall below the thumbnail bar; over 60px, 8.6%. Facial
hair does not separate — a jaw-darkness proxy came back with the wrong
sign, and hand-labelled beards land at 12.0% below the bar against
clean-shaven's 13.6%.

**The image rule and the video rule point in OPPOSITE directions, and
this is the single most surprising thing in the codebase.** On video a
weak read fails open and accumulates toward a clear. On a thumbnail a
weak read IS a patch, because the image rule marks unless a read is
confidently the user's gender. On 1,249 hand-labelled male reads, 80.3%
of wrong blurs are weak-but-correct male reads and only 2.2% actually
read female. Any port must decide this deliberately rather than inherit
it.

**A better teacher exists and cannot ship as-is.** dima806's ViT-base is
5× better on the owner's own corpus (4.2% vs 18.2% false cover at matched
exposure, AUC 0.9974) and is Apache-2.0. It is ~86M parameters against
faceres' 3.5M. The route is a distilled student; nothing about that
project is measured yet.

**Distillation of the three shipped models is a LATENCY project and
cannot improve accuracy.** A student reproduces its teacher's errors. Two
different projects have worn that one word; keep them apart.

**Refused on principle, on every platform:** per-race calibration
(biometric categorisation on a sensitive characteristic), vendoring
AGPL-licensed code, and patching the host app's bytecode.

---

## 3. Product decisions that are the owner's, not the engine's

Recorded because a port will be tempted to re-decide them silently.

**Blur patches are SOLID.** Never punch holes, windows or cut-outs, never
split a patch around somebody. The cost is accepted: a cleared person
inside someone else's patch gets covered. Fix that upstream — better
association, refusing a merge, tighter geometry — never by cutting a
window in the blur.

**Anything that trades exposure is his call.** A bar, a floor, a coast, a
resolution. Report both columns and wait. He has ruled on this trade
twice and chose coverage both times.

---

## 4. What is ANDROID-SPECIFIC and would be rewritten

- The Kotlin TFLite layer, the three interpreters, and the GPU/NNAPI
  arbiter (`NativeInfer.kt`). iOS would use Core ML.
- The WebView injection path and the document-start script.
- The OTA rules channel as implemented (see §5).
- The in-app APK updater. It has no iOS equivalent and Google Play
  forbids it outright — though Play explicitly exempts "code that runs in
  a virtual machine or an interpreter… such as JavaScript in a webview",
  which covers the rules payload.
- `adb` + CDP probing. Everything in `spikes/gauntlet/` is Android-only,
  and it is the reason a fix can be found, shipped and verified inside
  twenty minutes. **Budget for losing that on any other platform.**

The gaze engine itself — `app/gaze/src/` — is plain JavaScript running in
a web page. It is the largest single asset and it ports essentially
unchanged.

---

## 5. The GPU arbiter, and what it taught

Shipped in 1101 because `CompatibilityList.isDelegateSupportedOnThisDevice`
answers out of a device database frozen when the library was built, so
every phone newer than it silently lands on CPU. The replacement measures:
build a trial delegate after ready, compare against a shadow CPU copy on a
real frame, swap only on agreement within 2% AND a 10% speed win.

Three defects found on 2026-09-05, all on the owner's own Adreno 613:

1. **A starved trial was treated as a loss.** The trial waits for a real
   frame *of that model*, and the gender model is only invoked once the
   detector finds a face. On a feed page it never gets one, times out,
   and was permanently marked lost for the process. Measured cost: the
   most expensive model ran at 48.8ms on CPU where the GPU does 12.1ms —
   a 4× speedup available only by luck.
2. **Every losing path wrote no reason.** A timeout and a
   never-scheduled trial produced byte-identical report rows. Five builds
   went by unable to answer "why is this phone on CPU".
3. **The aggregate backend field is worst-of.** One model on CPU paints
   the whole field `cpu`, which is why the owner believed the app ignored
   his GPU while two of three models were on it.

**The generalisable lesson:** a measured trial is better than a
capability database, but it must be able to say why it lost, and a
measurement that never happened is not a loss. Any platform doing
runtime backend selection will meet all three.

Also measured: the remember key carries the build's version code, and so
does the compiled-shader cache — so **every update re-runs the trial on a
cold GPU.** Banked, same device, two consecutive launches: 80ms then
30ms, while CPU read 67ms both times. The decision bar sits inside that
swing.

---

## 6. The OTA rules channel — how it actually behaves

Worth writing down because it is not what anyone assumed, and every
"shipped over OTA" claim before today was verified on the server and
never on a device.

- `refresh()` sleeps **24 hours** after a success (15 minutes after a
  failure). A phone whose process has been alive since before a push will
  not see that push for up to a day.
- The rules are rebuilt from **cache** at startup and the refresh thread
  is spawned afterwards, so a value that arrives mid-session reaches the
  *next* document, not the current one. In practice a pushed dial needs a
  second cold start.
- `raw.githubusercontent.com` caches for minutes. A probe that pushes and
  immediately reads will measure the previous value — which looks exactly
  like "the dial does nothing".
- Unknown keys are DROPPED, not refused, and dropping one does not poison
  the rest of the payload. So a new dial is safe to push to older builds.
- The whitelist is compiled in, which means **a new dial needs a build
  before it can travel**, even though moving it afterwards does not.

Net: a pushed dial is not live. It is "the second cold start, up to a day
later". Design tuning workflows around that, and never verify a rules
change by reading GitHub.

---

## 7. Where the next platform should start

1. Port `app/gaze/src/` unchanged and prove parity on the banked corpus
   before touching anything native. The banks and the scoring harness are
   platform-independent.
2. Decide the image-vs-video asymmetry (§2) deliberately.
3. Implement backend selection with the three arbiter lessons (§5)
   built in from the start rather than discovered again.
4. Accept that the fast find-fix-verify loop does not exist off Android,
   and front-load measurement accordingly.
