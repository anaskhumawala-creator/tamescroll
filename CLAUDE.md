## Session state (update every session)

**Last updated:** 2026-09-04 (**1103 IS STILL THE PUBLISHED RELEASE, sha
6de12c09.** **1104 IS BUILT, TESTED AND STAGED BUT NOT SHIPPED AND NOT
PUSHED -- THE NETWORK IS DOWN.** Outbound HTTPS fails from this machine
AND from the Redmi on the same WiFi: `git push`, `gh release create` and
`curl https://example.com` all time out at port 443, and the phone gets
`000` on every host. Nothing is wrong with the repo. **FIRST ACTION NEXT
SESSION: `git push`, then finish the release recipe from step 6.** The
APK is at `dist-apk/tamescroll-v0.1.104.apk` (94,847,816 bytes,
gitignored), installed and running clean on the Redmi as versionCode
1104.)

**WHAT 1104 IS:** the image path's null guard shipped DEAD and nobody
noticed for five builds. `flaggedFaceIndices` has refused a no-signal
read since finding 45 -- live on the in-page image path, dead on the
WORKER one, because worker-entry trimmed each read to
`{gender, score, age, childP, px}` and BOTH of the guard's predicates
fail OPEN on a missing field (`isNullRead` trusts a read with no `raw`,
`mayNotMint` refuses nothing with no `shape.norm`). No throw, no log.

**REPLAYED ON FINDING 52'S OWN 370 THUMBNAILS**, through the SHIPPED rule
(`bench/image-guard-shipped.mjs` imports from `src/`, so it cannot drift):

    marks total   258 -> 198   -60  (-23.3%)
      JUNK         47 ->  16   -31  (-66.0%)
      real        211 -> 182   -29  (-13.7%)
    thumbnails covered -> COMPLETELY UNCOVERED:  16 of 370  (4.3%)

Finding 52 predicted -32 junk / -24 real and could NOT compute that last
row. **That row is the exposure and it is his ruling.** 4.3% of
thumbnails lose their only mark. `GENDER_IMAGE_NM_FLOOR` ships at 5 and
is clamped [0, 6] on the OTA channel, so **0 reverts the thumbnail half
alone without giving up the video path's guard** -- they used to share
one number and they are not the same trade (the video floor refuses a
BIRTH, so a face inside an admitted person box stays covered).

**VERIFIED IN THE EMITTED BUNDLE, NOT THE SOURCE:** the trimmer is READ
(`reads:P.map(RR)`), it carries `raw:t.raw,shape:t.shape?{norm:...}`, the
guard is `function iZ(t){return!!t&&q_(t)&&iw(t)&&gve(t)}` and `gve`
reads `.shape.norm` against the image floor `lw`. Bundle marker
`869d457` is inside the stripped `libapp_lib.so` in the APK.

**WHAT IS NOT VERIFIED:** the guard firing on live thumbnails on a phone.
The Redmi cannot reach YouTube (same network fault), so
`spikes/gauntlet/probe_imgnull_1104.py` and `probe_imgnull_slow.py` are
written and unrun. They read `nr` (the guard's own count, new on both
image paths) and `n` (nm) off `__TS_GAZE_IMGDIAG`. **`faces` minus
`flagged` cannot substitute for `nr` -- a same-gender clear subtracts
there too.**

**HONEST LIMIT ON HIS SHARE:** `nr` and `n` land in the page-side ring a
cabled probe reads. The Share report's image block carries only
`faces`/`flagged` and no per-read data, so his Share still cannot show
nm. Not widened this session.

**WHAT TO READ OFF HIS NEXT SHARE:** whether he still reports women
missed and random marks. Grey (1103) is measured to help both, and
finding 49 says it does NOT close the gap -- at 48px a Black woman still
reads male 51.9% of the time. The 5x fix is finding 50 and it needs a
student model. His phone still owes ONE SHARE on 1101/1102/1103 -- the
`native.models.*.gpu` block is the only thing that says why his Adreno
stayed on CPU.

**STILL NOT BUILT, and it is NOT a one-liner:** finding 48's sub-40px
abstention floor (3.2% of video patches). A detection under
`FACE_MIN_NATIVE_PX` 40 abstains WITHOUT running faceres
(`init-entry.js:3019`), so there is no `nm` to test -- applying the floor
there means running the gender model on the smallest faces purely to get
one number. That is added per-frame compute on his phone, unmeasured,
and it was deliberately not batched into 1104 rather than stacking an
unpriced cost onto a clean win.

## HANDOFF 2026-09-04 (late) -- HIS TWO COMPLAINTS ARE ONE PROBLEM, AND
## THE MODEL THAT FIXES IT IS 5x BETTER AND CANNOT SHIP

**HIS OPENING QUESTION, ANSWERED:** *"maybe I don't know if this is to be
treated separately or together, the random mark patches."* **TOGETHER.
They are the same wall.** Finding 48, over 3,809 whole frames at his
player's own 640x360 through the full shipped chain:

    read the OPPOSITE gender           47.0% of video patches
    read HIS gender but too weakly     46.2%
    too small to ask, fails closed      6.8%
    detector fired on NO human shape    0.1%   <- 5 of 5,451

**The detector is innocent.** The largest single source of his "random
blur marks" is a REAL man, corroborated by MoveNet, at an ordinary 76px,
that faceres cannot commit to. Not text, not a graphic. So there is no
separate "stop blurring text" project -- accuracy work fixes both.

### THE FOUR NUMBERS THAT MATTER, all on his own corpus, matched exposure

    arm                    <=1.6%     AUC
    SHIPPED head            21.8%   0.9808
    SHIPPED + GREY          18.2%   0.9855
    dima806 ViT-base         4.2%   0.9974   <- 5x, and it cannot ship
    ours retrained          58-69%   0.92-0.94  <- dead, see 51

**FINDING 50 IS THE ROUND'S RESULT.** dima806
(`dima806/fairface_gender_image_detection`, **Apache-2.0 read from the
repo's own metadata this session**) is 5x better than what ships, best or
tied in 7 of 8 videos, and wins hardest exactly where finding 49 says
ours collapses (32-48px: women wrong 36.9% -> 12.1%).

**THE CONFOUND THAT HAD TO DIE FIRST, and it nearly took the round:** the
model is *named* `fairface_gender_image_detection`, so FairFace is its
TRAINING domain and its numbers there may be memorisation. **His corpus
settles it** -- 52 identities, ten real videos, nothing in the comparison
has ever seen it -- and it wins there by MORE. Also verified on DEGRADED
crops before anything was built on it: better at 24px (20.0% women wrong)
than ours at 224px (33.8%).

**THIS CORRECTS THE EARLIER 2026-09-04 HANDOFF IN HIS FAVOUR.** That one
wrote *"distillation CANNOT fix accuracy"*. True of faceres as teacher,
and **that was the wrong teacher**. With a 5x-better Apache-2.0 teacher,
distillation is exactly the accuracy fix -- which is what he asked about
in his first message.

**WHY IT CANNOT SHIP: ViT-base is ~86M parameters against faceres' 3.5M**,
and finding 43 already refused a 1.96x speedup of the smaller model at 9.3%
decision flips. **The route is a STUDENT** and none of that project is
measured: architecture, size, in-domain data, per-frame cost, whether the
win survives the shrink.

### BOTH CHEAP ROUTES ARE DEAD, FROM OPPOSITE DIRECTIONS

- **Finding 50's retrain arm:** 10,580 FairFace faces, TRUE labels, scale-
  augmented to 24-192px through the player's own degradation, split BY
  FACE. Wins on held-out FairFace at every size (AUC +0.025 at 24px) and
  **loses on his corpus: 18.9% vs grey's 18.2%.** FairFace portraits are
  not video frames; his corpus is the EASY domain (AUC 0.98 vs 0.89) and
  a head tuned for the hard one gives back accuracy on the easy one.
- **Finding 51's pseudo-label arm:** label his footage with dima806,
  retrain our head on our descriptors, zero extra inference. **68.5% with
  PERFECT labels, 58.0% with dima's** -- both far worse than shipped.
  **The pseudo arm BEATING the true arm is the tell:** that is noise, not
  a result about labels. Cause is countable -- 2,159 reads but only **51
  clusters over ten videos, so each fold fits 1,024 inputs on ~46 distinct
  people.** Written up as "his corpus cannot train a head", NOT "the trunk
  is the ceiling"; those need opposite next steps and only the first is
  supported.

**A third attempt needs THOUSANDS of in-domain identities -- a labelling
run over real video, not a re-slice of what is on disk. Do not start it
until someone decides it is cheaper than the student.**

### GREY IS IN THE SOURCE AT LAST, BEHIND `GENDER_GREY` AT 0

Six independent confirmations (39, 41, 44, 45, 47, 49) and it had never
shipped. One line after `cropAndResize` in `classifyFaceGenders`, covering
the video AND thumbnail paths. **`GENDER_GREY` clamped [0,1], ships 0**, so
the switch and the revert both travel over OTA -- but the whitelist is
compiled in, **so 1102 will REFUSE the key and a build is needed before
the dial can travel.** He is tired of installing, so batch it.

**FINDING 49, why grey is not optional:** the full FairFace validation
split (**10,580 faces -- the 1,400 we lived on was a CPU-era decision**)
degraded to each native size:

    women read as men, shipped head
    size    Black  Indian   White
    224px   53.6%   47.4%   29.8%
     48px   64.9%   53.2%   37.3%
     24px   90.5%   82.3%   64.9%

His faces read px p50 76, so **a Black woman is read as a man about two
times in three on his hardware.** And it is NOT a threshold effect -- AUC
decays 0.8913 -> 0.7695, so no dial recovers it, which is why he was right
to refuse *"blur everyone"*. **Grey is better in 35 of 35 (race x size)
cells and worse in none**, helps most where it is worst (Black -15.4 pts
at 24px), and its AUC gain GROWS as faces shrink. Grey at 48px still reads
a Black woman wrong 51.9% -- ship it AND do not read it as a solution.

### THE INSTRUMENT DEFECTS THIS ROUND, all self-caught, all recorded

1. **`nPersons === 0` is not "nobody is here".** The false-fire bench
   first reported **388 candidates (7.1% of detections)**; its own "open
   these frames" section showed the worst were **385-435px faces at conf
   0.85-0.90 with maxKp 0.67** -- close-ups the person GATE refused, which
   is what `PFF_CLOSEUP_H` exists for. Keyed on the quantity the shipped
   ghost gate uses it is **5, not 388**. *A bench reporting a bound must
   name the rows behind it.*
2. **The nm floor's cost column overstated by 572.** It counted
   corroborated faces as exposure; the floor refuses a BIRTH, never a
   refresh, so a face inside an admitted person box is already covered.
3. **Per-race error read at the raw 0.5 boundary** made the augmented head
   look 6.7 points WORSE on Black women while every other cell said
   better. At each arm's own bar solved to a common cost it is 2.1 points
   BETTER. *The matched-exposure rule, relearned for the sixth time.*
4. **The ceiling probe overfit** (1,024 params on 1,348 rows; 60 epochs
   scored worse than 6) and read as "the trunk is the wall". Fixed with a
   validation split, early stopping and a grid selected on the TRAINING
   domain only.

### WHAT IS ON DISK NOW, and it makes the next round cheap

    gpu-fairfull-desc.json        10,580 FairFace, descriptors + reads
    gpu-ff-s{24..192}.json        the same faces at 8 native sizes
    gpu-frames-detect.json        3,809 whole frames, full shipped chain
    dima-degraded.json            76,678 dima806 reads, 7 sizes
    dima-corpus.json              dima806 on his own corpus
    frames-scan/                  3,809 ppm frames off the ten videos

`bench/head-train.mjs` is now the ONE trainer, shared by `head-ceiling`,
`head-scale` and `pseudo-label` -- two copies would drift, which is the
phase-g G1 failure. **torch+CUDA and transformers live in a venv on
`Z:/ml`** (C: is at 98%; HF cache is on Z: too).

### NEXT, in order

1. **His ruling on grey.** It is an exposure trade so it is his, and it
   needs a build (1103) before the dial can travel.
2. **The student**, if he wants the 5x. Nothing is measured; it is a real
   project. dima806 is Apache-2.0 and the teacher is verified on degraded
   in-domain crops, which is the part that is usually missing.
3. **The thumbnail half of finding 48 is UNMEASURED.** That bench used
   video frames from videos that CONTAIN people. His words were
   *"randomly just blur some text"* on THUMBNAILS, and a gaming or tech
   thumbnail often has no person at all. Finding 45's image numbers stay
   conditional on detection.
4. `NULL_MINT_NM_FLOOR` applied to sub-40px abstentions is worth **3.2%
   of video patches** -- real, small, not built.

**REFUSED ON PRINCIPLE, do not re-open:** per-race calibration. Inferring
skin tone to correct the model is biometric categorisation on a sensitive
characteristic -- the same clause (AI Hub Model License 2.c) that killed
the Qualcomm NPU delegate in loop 47.

**GOTCHAS THIS ROUND:** `movenet-multipose.json`'s weightsManifest names
`weights.bin`, which the app never reads (it loads through
`embeddedIoHandler`) but a plain URL load does -- the 404 body decodes as a
3-value tensor and reads like a corrupt model; person objects are FLAT
(`{x1,y1,x2,y2}`, person-gate.mjs:1004) not `{box:{...}}`; the Bash
heredoc still breaks on long bench bodies (use the Write tool); `pip`
ignores POSIX `TMPDIR` on Windows and spends C: (set `TEMP`); and two GPU
jobs at once need different `--port`.

## HANDOFF 2026-09-04 -- THE BENCHES RUN ON THE GPU NOW (127x), AND
## THAT CHANGES WHAT IS WORTH TRYING NEXT

**READ `docs/gpu-bench.md` BEFORE RUNNING ANY BENCH.** Every bench in
this repo before today ran on tfjs' pure-JS CPU backend at **0.15
crops/second** -- that is why rounds took nights and samples were 140
instead of 1,400.

    node app/gaze/bench/gpu/run.mjs --pop=corpus --backend=webgl --arms=rgb,grey --out=NAME

`bench/gpu/` runs the SHIPPED `detectFaceBoxes`/`classifyFaceGenders` in
a headless Chrome page on the RTX 3060 Ti through ANGLE/D3D11 and keeps
the scoring in node off banked rows, exactly as before. **No CUDA
toolkit** (there is none on this machine and `tfjs-node` does not build
on node v24 here). No CDP -- the page fetches its own job and POSTs its
own rows, so a page-side failure arrives as `ok:false` with a stack.
Nothing is ever shown on his screen: `--headless=new` against 127.0.0.1,
local crops and models only.

    tfjs CPU (pure JS)      0.15 crop/s     2,159 crops ~ 4 hours
    WebGL, 3060 Ti         11-26 crop/s     2,159 crops = 139 seconds

**PARITY IS GATED, NOT ASSUMED** (`bench/gpu/parity.mjs`): 60 crops both
backends, raw |delta| p50 **2.4e-7**, and **0 of 60 decisions flip** at
the label boundary or the shipped clear bar. The gate REFUSES to print a
verdict if an arm's output spans under 0.2 -- the finding-43 saturation
shape. Findings 25 is why: tfjs-WebGL on an Adreno read MoveNet at 0.03
where every other backend read 0.8, and six loops described a regime
that did not exist.

**THE HARNESS SHIPPED A BUG ON ITS FIRST RUN AND IT READ AS A RESULT.**
**Detector boxes are NORMALISED [0,1], not pixels** -- they go straight
to `tf.image.cropAndResize`. `mirrorBox` flipped by pixel width, so the
mirrored crop landed off the face and mirror "fixed 0 of 235 women".
**The tell generalises: a bad crop looks exactly like a bad arm**,
because a crop of nothing reads as the model's male-leaning prior
(mirror read 66% of small women male against rgb's 36.9%). Caught
because grey touches no box and reproduced finding 41 to the digit.

**FINDING 47, the corrected stack** (2,159 labelled reads, matched
exposure, false cover on men at exposure <= 1.6%):

    rgb 21.8%   grey 18.2% (-3.6)   rgbMir 21.5% (-0.2)   greyMir 17.2% (-4.6)

- **MIRROR ALONE IS WORTH ~NOTHING ON HIS OWN FOOTAGE** -- a partial
  retraction of finding 40's 18.0% -> 12.3%, which was FairFace.
- It adds **1.0 point on top of grey** and they overlap on only 13 of 74
  women, so the stack is SUPER-additive (119%). But that 1.0 point is
  **seven women** and costs 1.4-1.6x of the gender inference.
- **GREY IS FREE AND DOES 78% OF THE COMBINED WIN. Ship grey alone.**

**FINDING 46: THE DESCRIPTOR VETO IS DEAD.** The one-way veto finding 33
flagged (head proposes a clear, the [1024] fingerprint may only refuse
it -- monotone toward covering, zero runtime cost) **loses at every
matched-exposure operating point to the shipped head alone** (4.6% vs
6.0/12.2/32.3% false cover). The mechanism is measured:
**pearson(head raw, probe) = 0.893** -- it is the same signal read off an
earlier layer, not a second opinion. Finding 33's per-group error split
looked independent and that was Simpson's paradox.
**CONSEQUENCE THAT NARROWS THE SEARCH: every remaining idea that
re-reads another head, layer or view of faceres is drawing from one
well. Grey works precisely because it changes the INPUT instead.**

### HIS QUESTION ABOUT DISTILLATION, ANSWERED -- AND IT IS TWO DIFFERENT
### PROJECTS WEARING ONE NAME

1. **"Distill all three models into one" is a LATENCY project and
   CANNOT fix accuracy.** A student trained on teacher outputs
   reproduces the teacher's errors -- it would inherit faceres' 25.8%
   error on women exactly. Findings 37/38/43 are three independent
   routes to "the gender model is the wall". Distillation makes the wall
   cheaper to hit, not further away.
2. **The accuracy route is NOT distillation -- it is supervised
   fine-tuning of the gender head on FairFace's REAL LABELS, trunk
   frozen.** No backprop through the trunk, same single forward pass,
   ~4KB of changed weights, zero extra inference. That is the one-day
   job he was asking about, and it only became one-day because banking
   descriptors is now minutes.
3. **HONEST CAVEAT, and it is finding 46:** a LINEAR head on this
   descriptor is 0.893 correlated with the head that ships, so it may
   not beat it. FairFace is far better powered (thousands of identities
   against the corpus' 52) and a non-linear head is untested, so it is
   worth the run -- but it is a TEST, not a plan.

**READY FOR THAT TEST, banked this session, 141 seconds of GPU:**
`Z:/tamescroll-corpus/bank/gpu-fairface-desc.json` (1,348 rows) and
`gpu-corpus-desc.json` (2,159 rows), each carrying `rgbDesc`/`greyDesc`
[1024] L2-normalised vectors plus who/race/px. **The decisive experiment
is train on FairFace, evaluate on HIS corpus at matched exposure** --
different people, different footage, so it cannot flatter itself.

**WHAT THE GPU UNLOCKS, all previously unaffordable:** full FairFace in
53s instead of a night; whole-range dial sweeps in one run; bootstrap
confidence intervals (they need the population resampled); descriptor
banking for head work.

**FIELD NAMES THAT COST TIME:** the descriptor is `face.desc` (NOT
`descriptor`) and nm is `face.shape.norm` (NOT `face.nm`) --
`face-decode.mjs:237`.

**HIS OPEN RULINGS, none pushed, all exposure trades:** grey (build,
recommended); mirror (compute, marginal); `NULL_MINT_NM_FLOOR` 5 -> 5.5
(OTA) or 6 (build); `GENDER_IMAGE_MIN_SCORE` 0.40 -> 0.35; decision
boundary 0.50 -> 0.65; `PTRACK_MIN_COAST_PASSES` 2 -> 1.33; `DELAY_MS`
1500 -> 0; 720p; the child gate by policy.

**IF GREY SHIPS (44), READ THIS FIRST.** One line after `cropAndResize`
in `classifyFaceGenders`, covering video AND thumbnail paths for ~zero
compute. Ship it the 1098 way: `GENDER_GREY` at 0, clamped [0,1], so the
switch and the revert travel over OTA. **AND IT SILENTLY CHANGES THE
IDENTITY MEMORY** -- the same pass produces the [1024] descriptor matched
at `MEM_SIM` 0.6, already near its edge. A grey build owes a
descriptor-separability bench first, and both descriptor banks above now
make that a ten-minute job.

**THE RULE THAT INVALIDATES MOST NAIVE BENCHES:** the clear bar sits far
above the label boundary -- `GENDER_CLEAR_SCORE` 0.45 male means **raw
>= 0.725** -- so a label flip between 0.50 and 0.725 changes NOTHING that
ships. And any arm wins an accuracy column by leaning female, which is a
threshold move in disguise. **Tune each arm's own bar to a COMMON
EXPOSURE and read false cover.** Findings 29, 40, 41, 45 and 47 all turn
on this.

**REFUSED ON PRINCIPLE, do not re-open:** per-race calibration.
Inferring skin tone to correct the model is biometric categorisation on
a sensitive characteristic -- the same clause (AI Hub Model License 2.c)
that killed the Qualcomm NPU delegate in loop 47.

**GOTCHAS:** `execFileSync` cannot spawn a `.cmd` on Windows without a
shell (use esbuild's JS API); repo files are CRLF so a python patch must
normalise before matching; the Bash heredoc breaks on long bench bodies
-- use the Write tool; two GPU jobs at once need different `--port`;
FairFace `sample.json` is GROUPED BY RACE so a head-N slice is one race
(run.mjs interleaves); and **re-read a bank after a re-run** -- scoring a
still-running job silently reports the previous run's numbers, which
happened once today.

**Last updated:** 2026-09-04 07:10 (**1102 IS STILL THE RELEASE, sha
0a495cfa. NOTHING SHIPPED OVERNIGHT AND NO CONSTANT MOVED.** HEAD
pushed, tree clean. The deliverable is eleven findings, 34-44, in
`docs/engine-findings.md`. His phone still owes ONE SHARE on 1101/1102
-- the `native.models.*.gpu` block is the only thing that says why his
Adreno stayed on CPU.)

## HANDOFF 2026-09-04 -- THE ACCURACY ROUND: GREY WINS, THE CROP IS
## ALREADY RIGHT, AND THE BIGGEST PERF LEVER IS DEAD

**HIS STANDING COMPLAINT, and it is what the round was aimed at:** "the
random blur marks are pretty pretty annoying on random places on random
thumbnails, like randomly just blur some text."

**THE ONE RULE THAT INVALIDATES MOST NAIVE BENCHES, and it caught two
of mine:** the clear bar sits far above the label boundary --
`GENDER_CLEAR_SCORE` 0.45 male means **raw >= 0.725** -- so a label flip
anywhere between 0.50 and 0.725 changes NOTHING that ships. And an arm
can win any accuracy column by simply leaning female, which is a
threshold move in disguise. **Every comparison must tune each arm's own
bar to a COMMON EXPOSURE and read false cover.** Findings 29, 40 and 41
were each nearly reported wrong for exactly this.

**WHAT WON:**
- **GREY (41, 42).** Rec.601 luma into faceres. FairFace 1,348 faces:
  women 36.0% -> 30.0% wrong, z 4.16. **HIS OWN CORPUS, 2,159 labelled
  reads off ten real videos: 25.8% -> 19.0%, z 5.56**, and it lands in
  his own 38-62px band (32-48px: 36.9% -> 24.8%). At matched exposure it
  buys **3.7-5.8 points of false cover** and beats rgb at every operating
  point. Costs men 0.2% -> 1.0%. **NOBODY HAS A MECHANISM** -- every one
  proposed has been tested and refused (tone equalisation worse; the
  between-group gap does not move, 27.3 -> 27.2; and blueOnly, which
  should strip tone best, is the WORST arm at z 2.25 AGAINST while
  redOnly is the best single channel). `invert` collapses women to 84.5%
  wrong while preserving all structure, so **faceres reads tone and
  polarity, not geometry**. Ship it on the measurement or not at all.
- **MIRROR-AVERAGING (40).** 18.0% -> 12.3% false cover at matched
  exposure. Zoom and rotate are worse; if it ships it is MIRROR ONLY.
  Costs ~1.4-1.6x of the gender inference (one batch of 2N crops, not
  two calls -- readback count unchanged).

**WHAT DIED, all cleanly:**
- **CROP ALIGNMENT (34).** Shipped 15.8% wrong on women against 29.1%
  eye-rect and 28.8% full-align; loses on 8 of 10 videos, z ~8.5.
  `src/face-align.mjs` is dead code. The eye-target sweep is CANCELLED.
- **FACERES AT A SMALLER INPUT (43).** Runs at 160/112/96 for
  1.96x/3.82x/5.38x and flips 9.3% / 10.7% / 28.6% of decisions. Loop 34
  refused a requant of this model at 8 flips per 100. Refused.
- **THE DETECTOR AS THE CULPRIT (38).** 0.4% missed at 48px, under 2%
  across his whole band, no race or sex bias. The gender model is the
  wall -- third independent route to that.
- **RESOLUTION (37).** 720p buys 4.7 points; the model costs 34.3.

**HIS BLUR MARKS, MEASURED AT LAST (35):** 194 non-person reads, 96.9%
would mint, the null guard refuses 77.8%, **19.1% still get through**.
Escapees read nm p50 5.11 against a floor of 5, and **89.2% are WEAK
MALE reads** -- the model shrugging, and a shrug fails closed into a
patch. Floor 5 -> 6 cuts junk 19.1% -> 11.9% for +1.1 pts woman exposure.
**The OTA clamp stops at 5.5 (`tuning.mjs:84`), so 6 needs a build.**
From the labels: 3.90% of everything BlazeFace reports is not a person,
so **junk patches are ~0.74% of all detections** -- that bounds the win.
HONEST: all of it is conditional on detection; how often the detector
fires on text in the first place is still unmeasured.

**THE INSTRUMENT FAILURE WORTH CARRYING (43), because it looked exactly
like success:** the size bench fed faceres `x/255` where it wants a
**0..255 float** (`detector.js:797`, `:825`). The network saturated to
0.6262-0.6284 across 140 faces -- three distinct values -- and the run
printed **100.0% agreement at every size** beside **50.0% accuracy at
the 224 reference that ships**. A constant output agrees with itself
perfectly and scores exactly chance. **ANY AGREEMENT METRIC NEEDS A
SPREAD CHECK BESIDE IT** or 100% means "identical" and "dead"
indistinguishably; the bench now refuses to print a table below spread
0.2. This repo shipped a saturated gender model once already
(mini-Xception, 2026-08-23).

**IF GREY SHIPS (44), READ THIS FIRST.** It is one line after
`cropAndResize` in `classifyFaceGenders`, so it covers the video AND
thumbnail paths at once for essentially no compute. Ship it the 1098
way: `GENDER_GREY` at 0, clamped [0,1], so the switch and the revert
travel over OTA. **AND IT SILENTLY CHANGES THE IDENTITY MEMORY** --
faceres is multi-head, the same pass produces the [1024] descriptor
matched at `MEM_SIM` 0.6, which that module records as already close to
its edge. A grey build owes a descriptor-separability bench first.

**RUNNING AT HANDOFF, results NOT yet read** (logs in
`Z:/Apps/Disconnect/.overnight/`): `grey-mirror-stack.mjs` (do grey and
mirror ADD UP, or attack the same errors -- 2,159 reads x 4),
`image-junk.mjs` (his blur marks on the IMAGE rule, never measured:
`flaggedFaceIndices` patches unless a read is CONFIDENTLY his gender, so
a weak read IS a mark -- the opposite direction to the video rule), and
`faceres-input-size` re-swept at 208/192/176/160 for a usable knee
(speed 1.19x / 1.41x / 1.68x / 2.08x).

**GOTCHAS THIS ROUND:** the Bash heredoc broke on long bench bodies
twice -- use the Write tool; a python-injected `\n` lands as a real
newline and splits a JS string literal -- use `String.fromCharCode(10)`;
`sample.json` in the FairFace bank is GROUPED BY RACE so any subset run
is biased; tfjs here is the pure-JS CPU backend, so run benches SERIALLY
-- five in parallel only divide the same cores; and piping a background
job to `| tail` swallows every live progress line.

**HIS OPEN RULINGS, none pushed, all exposure trades:**
`NULL_MINT_NM_FLOOR` 5 -> 5.5 (OTA) or 6 (build); grey (build); mirror
(compute); `GENDER_IMAGE_MIN_SCORE` 0.40 -> 0.35; the decision boundary
0.50 -> 0.65; the coast dial `PTRACK_MIN_COAST_PASSES` 2 -> 1.33;
`DELAY_MS` 1500 -> 0; 720p; the child gate by policy.

**REFUSED ON PRINCIPLE, do not re-open:** per-race calibration. Inferring
skin tone to correct the model is biometric categorisation on a sensitive
characteristic -- the same clause (AI Hub Model License 2.c) that killed
the Qualcomm NPU delegate in loop 47.

**Last updated:** 2026-09-03 17:20 (**1102 IS THE RELEASE, sha
0a495cfa**, served APK re-downloaded and hashed against the raw
manifest, isDraft false. HEAD pushed, tree clean. The old Redmi runs
1102. HIS phone: installed 1101, reports "still using the CPU" but "the
video somehow feels smoother" -- STILL OWES ONE SHARE; the gpu block is
the only thing that says why his Adreno stayed on CPU.)

## HANDOFF 2026-09-03 17:20 -- 1102: THE PILL AND GEAR STOP RIDING THE FEED

**HIS REPORT:** "turn on the home screen and try to scroll down ... each
of the videos just when I am just scrolling it gets highlighted and
whatnot."

**WHAT IT ACTUALLY WAS, found by screenshotting the Redmi's home feed:**
our own blur pill ("Blur on", 99x36) and the tuning gear (36x36) sitting
at the top right of the FEED with no player behind them, so every
thumbnail scrolling under them wore the badge in turn. m.youtube SHARES
`#player-container-id` between the watch player and the feed's autoplay
previews, and an SPA nav off /watch collapses it to **823x0** at the top
of the feed instead of removing it -- the `<video>` inside stays
CONNECTED, so the pill teardown (which only fires on a disconnected or
failed video) never ran.

**FIXED:** `setChrome(feedPreview())` at attach and on a 250ms tick
(was 1000ms, teardown-only). Hidden, not destroyed -- the same player
returns on the next watch page and rebuilding the panel would drop his
overrides. Gate is `feedPreview()`, the ONE copy of that rule already in
scope, and it fails SHOWN so an unreadable path cannot take his escape
hatch away. **`installTuneUi` now returns its `gear` element**: a class
query against the separately-resolved host read NULL on the device and
the gear rode the feed while the pill hid correctly -- caught only
because the device probe checked both.

**VERIFIED ON THE REDMI, five states** (`spikes/gauntlet/probe_pill_scope.py`):
cold home both hidden; /watch both visible, panel opens; SPA off /watch
both hidden and an open panel closes; SPA back both return; pill still
toggles Blur on/off/on. Home screenshot clean (deleted).

**THREE THINGS RULED OUT ON THE WAY, do not re-chase:** (1) no
non-passive listener touches the feed -- 18 touchmoves, `prevented 0`,
scroll started at 91ms and ran 240px; (2) YouTube's own
`yt-touch-feedback-shape` adds `...ShapeDown` for ~80ms on touchstart
and removes it when the scroll is recognised, and its fill measured
**opacity 0 on every one of 122 frames** -- their ripple does NOT fire
on a scroll; (3) `filter: brightness(0.9)` on every feed thumbnail is
YOUTUBE'S, not ours (grep: we ship no brightness anywhere).

**PROBES ADDED:** `probe_home_highlight.py` (per-frame :active +
defaultPrevented + scroll offset + mutation log under a driven touch
scroll), `probe_feed_wash.py` (per-item filter/class/patch changes
during a scroll), `probe_pill_scope.py`, `probe_feedpill.py`,
`probe_touchfb.py`, `probe_flash.py`.

gaze **863/863** (5 new in `test/pill-watch-scope.test.mjs`, red-proved
3/4 against the pre-fix source), cargo 63/63.



**Last updated:** 2026-09-03 16:55 (**1101 IS THE RELEASE, sha
2b2cce27**, served APK re-downloaded and hashed against the raw
manifest, isDraft false. HEAD pushed, tree clean. The old Redmi runs
1101; HIS phone gets it in-app and OWES ONE SHARE -- that report answers
whether his Adreno 613 now runs on GPU.)

## HANDOFF 2026-09-03 16:55 -- 1101: THE GPU IS MEASURED, NOT ASSUMED

**HIS RULING:** "I want it so that any mobile would work fine with this,
instead of it missing my phone's GPU completely."

**THE DEFECT.** `CompatibilityList.isDelegateSupportedOnThisDevice`
answers out of `gpu_compatibility.bin`, a device database frozen when
tensorflow-lite-gpu 2.16.1 was built. His Redmi 13 (SM4450 / Adreno 613,
2023) is absent, so every model landed on CPU with **no throw and no log
line** -- invisible in the report, and the same silent fallback awaits
every phone newer than that database.

**WHAT SHIPPED** (plan: `docs/superpowers/plans/2026-09-03-gpu-delegate-measured.md`):
an unlisted device is refused a GPU at LOAD (three cold delegates are
1.4-3.9s of shader compile each; that is the 1098 NNAPI-in-loadAll
defect) and given a MEASURED trial after ready on the trial thread --
agree with a shadow CPU copy on every output head within 2% AND beat it
by 10% on the last real frame, or CPU stays. `shouldSwap` is in the
companion object and JVM-tested. A win is remembered per
asset+versionCode+bytes, so only the first launch on a build pays. The
NNAPI arm now waits for the GPU arm. A driver segfault is not catchable
from Kotlin, so a breadcrumb (`commit`, not `apply`) is written before
the driver is touched and cleared after; still there next launch = that
model never tries again on this build.

**THE REPORT NOW SAYS WHY:** `native.models.*.gpu {listed, remembered,
tried, ran, agree, won, gpuMs, cpuMs, whyR}`. One Share from any phone
answers "why is this phone on this backend" with no cable.

**REDMI SMOKE** (`spikes/gauntlet/probe_gpu_note.py`, ~40s, banked
`gpu-note-*.json`). Listed path UNCHANGED: gpu x3, `ran` false -- a
listed device still takes the fast load and pays for no trial. Forced
unlisted (`adb shell touch
/sdcard/Android/data/app.tamescroll.client/files/force-gpu-unlisted` --
a debug switch that exists because the only phone on a cable here IS
listed, so the new path could not otherwise be exercised):

  | model | gpu ms | cpu ms | agree | outcome |
  |---|---|---|---|---|
  | blazeface (cold) | 80.1 | 67.3 | yes | **CPU kept** -- GPU was slower |
  | faceres | 52.3 | 141.3 | yes | swapped to gpu |
  | movenet-heads | 140.6 | 254.8 | yes | swapped to gpu |
  | blazeface (2nd launch, warm shader cache) | 30 | 67 | yes | swapped to gpu |

  Ready **2597ms** on the trial path against **6816ms** loading GPU up
  front -- the page gets a working engine 4s sooner, then upgrades,
  which also helps the 15s ready timeout. Second launch: the two winners
  loaded straight on GPU (`remembered` true, `ran` false). **The arbiter
  refuses a GPU that would have been SLOWER, which the listed path never
  checked** -- 1100 put BlazeFace on GPU at 80ms where CPU does 67.

**CORRECTIONS TO THE 16:30 HANDOFF, both from re-reading
`phone-diag-1100.jsonl`:** (1) native never came ready in **4 of 9**
distinct 1100 watch documents, not 3 of 11. (2) **"dead native = the
slow path" is NOT supported**: verdict p50 on native-cpu documents
611/657/760/763/805 against dead-native documents 478/531/584/828 --
overlapping, and the worker was sometimes faster. n=5 vs 4, different
videos, uncontrolled. So the native engine on CPU was buying close to
nothing on his phone and the GPU is its whole remaining value.

**WHAT HIS SHARE ANSWERS NEXT:** `native.models.*.gpu` on 1101. `won`
true = fixed. `agree` false = his driver returns different numbers (the
arbiter did its job, and the reason is a real finding). `whyR` set = the
delegate refused, with the message. `ran` false with `listed` false =
the trial never got a real frame.

**STILL NOT STARTED, his call each:** the "native never came ready"
reason field (step 2, needs the page-side failure reason, not the
engine's); the startup-stutter lever (attach the delay presenter after
the FIRST verdict); 1101-era thumbnail hide + stricter image bars;
single-frame crops; HaramBlur side-by-side on the old Redmi; coast dial
2 -> 1.33. He also asked for "the mode the other apps use" (video
untouched, boxes on top) -- **that is DELAY_MS 0 and already shipped**:
gear -> Blur delay -> 0, no build needed.

---

**Everything before 2026-09-03 16:30 has moved to
`docs/handoffs-archive.md`** -- ~6,400 lines of superseded session logs
that were loading in full at every session start and consuming the
context window before any work began. Nothing was deleted; the durable
rules from them are distilled below and the narrative is one file away.

---

# STANDING RULES -- distilled 2026-09-04 from ~40 stacked handoffs

Everything before 2026-09-03 16:30 lives in `docs/handoffs-archive.md`.
It was moved, not deleted -- this file loads in full at every session
start, and 6,900 lines of superseded session logs were consuming the
context window before any work began. **When a fact below stops being
true, fix it here; do not append a new handoff on top.**

## THE MEASUREMENT RULES, each earned by a wrong published number

**MATCHED EXPOSURE OR THE NUMBER IS MEANINGLESS.** The clear bar sits far
above the label boundary -- `GENDER_CLEAR_SCORE` 0.45 male means **raw >=
0.725** -- so a label flip between 0.50 and 0.725 changes NOTHING that
ships. And any arm wins an accuracy column by leaning female, which is a
threshold move in disguise. **Tune each arm's own bar to a COMMON
EXPOSURE and read false cover.** Findings 29, 40, 41, 45, 47 and 50 each
turned on this, and the last one was caught the same day it was written.
Print AUC beside the table: a bar solver can move a matched-exposure
cell, nothing can move AUC.

**AN INSTRUMENT THAT RE-DERIVES A SHIPPED RULE IS A CHECK THAT CANNOT
FAIL** -- phase-g caught three of them in one session, each written after
the rule forbidding it. The remedy worked all three times: move the rule
into a module, call it from BOTH sides, delete the copy. `person-gate`,
`crop-geometry`, `host-scale` and `bench/head-train.mjs` all exist for
this reason.

**PIN THE CADENCE.** ~30 benches build options by hand; passing no
`fixedCadence` tells the tracker the 500ms BANK interval and derives a
1250ms coast where his phone is told 2000 and coasts 4000. Four published
tables were measured that way and THREE REVERSED. Pass `hisRegimeOpts(g)`
and `thinFrames(w, K_HIS)`. `arch-arms.CONTROL` is the single source of
the control triple and `test/control-triple.test.mjs` runs the shipped
arm over the corpus to assert it.

**A NUMBER WHOSE SHAPE LOOKS FAMILIAR IS A CLAIM ABOUT THE INSTRUMENT.**
`face-recall.mjs` printed 31%, which is 1/3, the thinning ratio.

**COUNT PEOPLE, NOT ROWS.** His corpus is 2,159 reads but only 51
clusters over ten videos, so a leave-one-video-out fit sees ~46 distinct
identities. Finding 51's arm looked like a result about labels and was a
result about n.

**A BENCH THAT REPORTS A BOUND MUST NAME THE ROWS BEHIND IT.** Finding
48's "open these frames" section is what caught its own 388-vs-5 error.

**BREAK AN ASSERTION TO PROVE A NEW TEST CAN FAIL.** This repo has
shipped a check that could not fail more than once, including a `#[test]`-
less function in lib.rs holding ten dead assertions.

**VERIFY A CONSTANT IN THE EMITTED BUNDLE, NEVER THE SOURCE**, and verify
it is READ rather than merely emitted. `app/src-tauri/gaze-page.js`. A
constant once shipped dead as `var IY;` for six rounds.

**RESTART THE EMULATOR BEFORE BELIEVING A FAILURE OR A TIMING NUMBER.**
The stale-emulator trap has invented a regression five times.

## PROTECTION DECISIONS ARE HIS, ALWAYS

Anything that trades exposure -- a bar, a floor, a coast, grey, a
resolution -- is his call, not a judgement call. Report the trade with
both columns and wait.

**Blur patches are SOLID** (he said it twice): never punch holes,
windows, cut-outs or sharp regions into a patch, and never split one
around somebody. `subtractBox` and the R24 mask hole were both shipped
and both rejected. *"Blur the subject so well that its shape is not
visible"*, qualified as *"slight shape visible is fine, it just shouldn't
be super tight"*. A silhouette-tight mask is the wrong direction too.
The cost is accepted and must not be re-litigated: a cleared person
inside someone else's patch gets covered. Fix that upstream -- better
association, refusing a merge, tighter observation geometry -- never by
cutting a window in the blur.

**REFUSED ON PRINCIPLE, do not re-open:**
- **Per-race calibration.** Inferring skin tone to correct the model is
  biometric categorisation on a sensitive characteristic -- the same
  clause (AI Hub Model License 2.c) that killed the Qualcomm NPU delegate
  in loop 47. TFLite's own NNAPI delegate is the legal route.
- **Reading HaramBlur's code.** AGPL-3.0; vendoring relicenses the app
  and ends App Store distribution. Running it and scoring its output is
  fine.
- **Patching YouTube's bytecode** (the ReVanced approach). Hard rule, and
  it is what got ProTube removed.

## THE MACHINES

- **His phone: 23122PCD1I** (Redmi 13, SM4450 / Adreno 613, Android 16).
  Not on a cable here. Reaches builds through the in-app updater. Its
  reports arrive via Settings -> About -> Share.
- **Old Redmi `1ec2c48e0621`** (M2010J19SI, Helio G85, Mali): the arm64
  smoke device, on adb, CDP over `adb forward`. It lies LANDSCAPE -- lock
  rotation and read `innerWidth` before believing any rect.
- **x86_64 emulator**: fallback. Relaunch with `-no-snapshot-load` when a
  restart does not come back.
- Use `$ANDROID_HOME/platform-tools/adb.exe` (37.0.0). The `adb` on PATH
  is a stray 28.0.3 with no `mdns`.
- **C: is nearly full.** Everything bulky goes on Z:. torch/transformers
  live in a venv at `Z:/ml`; the HF cache is there too. `pip` ignores
  POSIX `TMPDIR` on Windows -- set `TEMP`.

## THE RELEASE RECIPE

1. Bump `app/src-tauri/gen/android/app/tauri.properties` versionCode (+1)
   and versionName, and `appupdate.rs` `CURRENT_VERSION_CODE` to match.
   tauri.properties is GITIGNORED/autogen -- the lockstep that is
   tracked lives in `tauri.conf.json` version + `appupdate.rs`.
2. `node app/gaze/build/build.js` FIRST -- `tauri android build` does NOT
   rebuild the gaze bundle, and an APK built without it silently carries
   the previous bundle. Check `window.__TS_GAZE_BUNDLE__`.
3. `npx tauri android build --debug --target aarch64`.
4. STRIP before packaging: `llvm-strip --strip-unneeded` the .so (NDK
   27.1) into `jniLibs/arm64-v8a`.
5. `gradlew :app:clean :app:assembleArm64Debug -x :app:rustBuildArm64Debug`.
   **gradlew exits 0 on that task failing -- check the APK mtime, never
   the exit code.** Check APK size against the entry sum: incremental
   packaging has shipped an orphaned duplicate .so.
6. `gh release create app-vX.Y.Z <apk> --repo anaskhumawala-creator/tamescroll`.
   The asset is named after the FILE -- do not upload from a temp path.
7. `node scripts/gen-app-manifest.mjs <apk> <releaseDownloadURL> "<notes>"`,
   commit and push `updates/app-manifest.json`.
8. **Verify: re-download the served APK and hash it against the raw
   manifest, and check `isDraft` is false.** A failed `gh release create`
   can leave a draft that `gh release view` reports happily while the
   download URL 404s.

The manifest URL is hardcoded in `appupdate.rs` AND `MainActivity.kt` --
keep them in lockstep.

**`assets/models/*.tflite` are GITIGNORED** (33MB). Regenerate with
`spikes/native/convert.py` before an Android build on a fresh clone, or
the engine reports `native-failed` and everything silently runs on the
worker.

**A constant changed in source and not in `rules/tuning.json` silently
REVERTS on every device the moment the OTA lands.** `test/tuning.test.mjs`
is the only thing standing between here and that; it refuses a tunable
missing from its SHIPPED map. `tune-overlay.test.mjs` likewise refuses a
dial with no plain-language label in his gear panel.

**CODE MAY NEVER TRAVEL OVER OTA** -- it runs inside YouTube's page. JSON
is handed over JSON-ESCAPED as a STRING and parsed page-side, never as an
object literal (a `${` reaching an injected template was remotely lethal
once).

**Rules OTA:** rerun `scripts/gen-rules-manifest.mjs` and commit after ANY
`rules/` edit or shipped apps never see it. **The OTA cache in app-data
SHADOWS local `rules/` edits, so a rules change cannot be verified
locally -- only after pushing.**

## RECURRING GOTCHAS

- **The Bash heredoc breaks on long bench bodies.** Use the Write tool.
- Repo files are CRLF; a python patch must normalise before matching, and
  a python text-mode read turns CRLF into LF.
- `execFileSync` cannot spawn a `.cmd` on Windows without a shell (use
  esbuild's JS API).
- Two GPU bench jobs at once need different `--port`.
- **Re-read a bank after a re-run** -- scoring a still-running job
  silently reports the previous run's numbers.
- FairFace `sample.json` and `full.json` are GROUPED BY RACE, so a head-N
  slice is one race. `run.mjs` interleaves.
- The descriptor is `face.desc` (NOT `descriptor`); nm is
  `face.shape.norm` (NOT `face.nm`) -- `face-decode.mjs:237`.
- Person objects are FLAT `{x1,y1,x2,y2,confidence}` (person-gate.mjs:1004),
  not `{box:{...}}`.
- `movenet-multipose.json`'s weightsManifest names `weights.bin`, which
  the app never reads (it loads through `embeddedIoHandler`). A plain URL
  load does read it, and the 404 body decodes as a 3-value tensor -- which
  looks exactly like a corrupt model.
- A probe that CDP-navigates straight to m.youtube never calls
  `open_platform`, so the sheet is built from DEFAULTS and his toggles are
  not what you are measuring. Drive the launcher first.
- `elementsFromPoint` CANNOT see a `pointer-events: none` element, and
  every patch we draw is one. Set `pointerEvents = 'auto'` first or the
  probe is blind -- this retracted three "verified" claims.
- A `display:none` overlay is still in the DOM with a 0x0 rect; a patch
  count with no display check overstates coverage, which is the dangerous
  direction.
- After a compaction, `git diff` the files a summary calls "edited"
  before trusting them -- a pre-compaction edit was once lost and the
  build shipped the old code.

## HIS OPEN RULINGS, all exposure trades, none pushed

`NULL_MINT_NM_FLOOR` 5 -> 5.5 (OTA) or 6 (build) · mirror-averaging
(compute, marginal -- 7 women for 1.4-1.6x of the gender inference) ·
`GENDER_IMAGE_MIN_SCORE` 0.40 -> 0.35 · decision boundary 0.50 -> 0.65 ·
`PTRACK_MIN_COAST_PASSES` 2 -> 1.33 · `DELAY_MS` 1500 -> 0 (the
boxes-on-top technique, already shippable via gear -> Blur delay -> 0) ·
720p · the child gate by policy.
