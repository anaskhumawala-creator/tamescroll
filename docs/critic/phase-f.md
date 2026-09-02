# Phase F — critic report, PHASE A (independent)

Range `52f95d7..7dd3e03`. Packet `critic-packet-52f95d7_1` (assembled
2026-09-02 08:19; its diffstat is four files wider than the range —
`iou-where.mjs`, `cadence-pinned.test.mjs`, `crop-geometry.test.mjs` and
`docs/critic/phase-e.md` are 52f95d7's own contents).

Produced with no access to any summary, CLAUDE.md entry or commit body.
Every finding below was reached by running something.

**8 findings — EXPOSURE 1, WRONG-NUMBER 2, DEAD-CHECK 4, NIT 1.**

Working copy for all mutations: a `tar`-copy of `app/gaze` in scratch with
`node_modules` junctioned. `Z:/Apps/Disconnect` was never written to.

---

## F1

```
SEVERITY  WRONG-NUMBER
WHERE     docs/engine-findings.md 16b (headline + measurement table);
          app/gaze/test/unpad-persons.test.mjs, "the flag ships OFF"
          (its justifying comment);
          spikes/gauntlet/movenet-gated-n225.txt (UNTRACKED, uncited)
CLAIM     Through the SHIPPED gate the letterbox admits exactly as many
          persons as the squash -- 373 against 373, +0.000% over 225
          frames -- so 16b's "+22.8% admissions" and "one frame in seven"
          are pre-gate numbers that do not survive parsePersons, and the
          run showing it is untracked and cited by nothing.
FALSIFIER tail -12 spikes/gauntlet/movenet-gated-n225.txt
          # persons admitted   squash 373   letterbox 373   (+0.000%)
          # only ONE arm admits anybody: letterbox 8  squash 1  (of 225)
          # reproduce: cd app/gaze && N=225 node bench/movenet-gated.mjs
COST      Nothing today -- PERSON_LETTERBOX ships false. It costs the
          NEXT session, which reads 16b as a standing +22.8% and flips the
          flag on a number this range's own bench refutes. The gated
          8/225 (1 in 28, against 16b's 1 in 7) and the flat 373 also say
          the pad TAKES pixels: on 640x360 the fit is 256x144, so a
          subject reaches MoveNet at 56% of the height the squash gave it
          -- the same trade E3 measured blinding 3 frames in 241 on the
          face path.
```

Honest limit: `movenet-aspect` (N=241) and `movenet-gated` (N=225) do not
sample the same frames — both walk `withFace` rows on a stride derived
from N — so this is not a paired comparison. The direction is not close
enough for that to matter (+22.8% against +0.000%), but a paired re-run at
one N would settle it outright.

---

## F2

```
SEVERITY  EXPOSURE
WHERE     app/gaze/src/person-gate.mjs, unpadPersons -- the `cl` clamp and
          the comment above it; the same claim restated in
          app/gaze/test/unpad-persons.test.mjs, "a keypoint that lands in
          the black bar is clamped into frame"
CLAIM     "Clamping can only move a point ONTO the frame edge, which for a
          box is the covering direction" is false. The clamp is applied to
          raw coordinates that parsePersons then consumes as DIFFERENCES:
          headW is |lEar.x - rEar.x|, else |lEye.x - rEye.x| * 2.5, else
          |lSh.x - rSh.x| * 0.6, and headH = headW * ar sets the patch's
          TOP edge through HEAD_ANCHOR_UP. A difference of clamped values
          is monotonically SMALLER, so the clamp shrinks the head anchor
          and RAISES the top edge -- the uncovering direction. Measured on
          one synthetic slot, identical input, only the clamp differing:
          headW 0.5133 -> 0.1600, headH 0.2888 -> 0.0900, patch top edge
          y1 0.0000 -> 0.3209.
FALSIFIER cd app/gaze && node --input-type=module -e '
          import {parsePersons,unpadPersons} from "./src/person-gate.mjs";
          import {fitBox} from "./src/crop-geometry.mjs";
          const S=256,SLOT=56,AR=360/640,f0=fitBox(AR,1,S);
          const dw=Math.round(f0.dw),dh=Math.round(f0.dh);
          const F={dx:Math.floor((S-dw)/2),dy:Math.floor((S-dh)/2),dw,dh};
          const nc=d=>{const o=new Float32Array(d.length);o.set(d);
            const ox=F.dx/S,oy=F.dy/S,sx=F.dw/S,sy=F.dh/S;
            for(let p=0;p<6;p++){const b=p*SLOT;
              for(let i=0;i<17;i++){o[b+i*3]=(d[b+i*3]-oy)/sy;o[b+i*3+1]=(d[b+i*3+1]-ox)/sx;}
              o[b+51]=(d[b+51]-oy)/sy;o[b+52]=(d[b+52]-ox)/sx;
              o[b+53]=(d[b+53]-oy)/sy;o[b+54]=(d[b+54]-ox)/sx;}return o;};
          const d=new Float32Array(6*SLOT);
          const M=(x,y)=>({x:(F.dx+x*F.dw)/S,y:(F.dy+y*F.dh)/S});
          const put=(i,x,y,s)=>{const m=M(x,y);d[i*3]=m.y;d[i*3+1]=m.x;d[i*3+2]=s;};
          put(0,.06,.50,.9);put(1,.03,.49,.85);put(2,.10,.49,.85);
          d[9]=M(0,.49).y;d[10]=0.02;d[11]=.80;
          put(4,.16,.49,.80);put(5,-.02,.62,.80);put(6,.24,.62,.80);
          d[51]=M(0,.45).y;d[52]=M(0,.45).x;d[53]=M(0,.95).y;d[54]=M(.30,.95).x;d[55]=.9;
          for(const [n,f] of [["clamped",x=>unpadPersons(x,F,S)],["no clamp",nc]]){
            const p=parsePersons(f(Float32Array.from(d)),undefined,AR,null)[0];
            console.log(n,"headW",p.headW.toFixed(4),"headH",p.headH.toFixed(4),"top",p.y1.toFixed(4));}'
COST      Latent behind PERSON_LETTERBOX=false, and it BLOCKS that flag.
          When it flips: on a padded-x source (a genuine portrait upload
          -- the fit is 144x256 with 56px pillars) a head keypoint
          regressed into the bar shrinks the head anchor by up to 3.2x and
          drops the patch top by up to ~0.32 of frame height. That is hair
          and crown left sharp, the exact class HEAD_ANCHOR_UP 1.1 -> 1.6
          was raised for. headW is also sameHuman's merge TOLERANCE
          (person-track.mjs), whose shrink direction R19 scored as
          EXPOSURE.
```

His own 640x360 regime is the mild case — the bars are horizontal there, x
is untouched, and `parsePersons` re-clamps the box at the push, so I could
not construct a 16:9 frame where it moves. The claim in the comment is
still false as stated, and the flag exists precisely so a non-16:9 arm can
run. Two cheap fixes, either of which makes the comment true: clamp only
the four box floats and leave keypoints mapped-but-unclamped, or compute
the headW ladder before the clamp.

---

## F3

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/test/control-triple.test.mjs, header: "it is the one
          check that fails when ANY shipped constant in the decision layer
          moves"
CLAIM     The whole of person-gate.mjs is invisible to it. Three
          decision-layer constants set to absurd values, each with the
          bench cache verifiably rebuilt to carry the new value, leave
          both assertions green: PATCH_MARGIN 0.045 -> 0.500,
          PERSON_MIN_SCORE 0.35 -> 0.99 (admits nobody), HEAD_ANCHOR_UP
          1.6 -> 0.0 (no hair coverage at all). It IS capable of failing
          -- PTRACK_ASSIGN optimal -> greedy turns it red with man 23.0 /
          woman 24.5 -- so its coverage is person-track.mjs, not "the
          decision layer".
FALSIFIER cd app/gaze
          sed -i 's/^export var PATCH_MARGIN = 0.045;/export var PATCH_MARGIN = 0.500;/' src/person-gate.mjs
          node --test test/control-triple.test.mjs      # throws: cache stale, rebuilds
          grep -oE 'PATCH_MARGIN *= *0\.[0-9]+' bench/.cache/shipped.mjs   # PATCH_MARGIN = 0.5
          node --test test/control-triple.test.mjs      # pass 2  fail 0
          git checkout -- src/person-gate.mjs
COST      person-gate.mjs is on the T3 decision-layer trigger list and is
          one of the two source files 7dd3e03 changes. The staleness
          detector 17c was built for -- a published triple that no longer
          reproduces -- is unguarded for every geometry constant: the
          keypoint cushion, the head anchor, the headW ladder, both score
          floors, LOW_TIER_MAX_SPRAWL. A patch-margin regression ships
          green.
```

Fix is one line of honesty in the header plus, if the coverage is wanted,
an arm that runs `parsePersons` over banked slot buffers — `arch-arms`
already imports it for the slot arm; the default corpus arm never reaches
it.

---

## F4

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/bench/movenet-gated.mjs, the `outOfRange` counter and
          its header line "SANITY: a broken inverse map shows up here
          first, and it is the failure that is worse than the defect"
CLAIM     outOfRange is structurally 0 whatever unpadPersons does, because
          parsePersons emits every box through Math.max(0,...) /
          Math.min(1,...) at the push. Fed a deliberately broken inverse
          (coordinates x3) the person's box moves from x 0.304..0.696 to
          x 0.911..1.000 -- an unmistakably wrong placement -- and
          outOfRange still reads 0. The n225 run's "(the inverse map
          holds)" is therefore not evidence that it holds.
FALSIFIER cd app/gaze && node --input-type=module -e '
          import {parsePersons,unpadPersons} from "./src/person-gate.mjs";
          import {fitBox} from "./src/crop-geometry.mjs";
          const S=256,SLOT=56,fit=fitBox(640,360,S);
          const bad=d=>{const o=new Float32Array(d.length);o.set(d);
            for(let p=0;p<6;p++){const b=p*SLOT;
              for(let i=0;i<17;i++){o[b+i*3]=d[b+i*3]*3;o[b+i*3+1]=d[b+i*3+1]*3;}
              for(const k of [51,52,53,54]) o[b+k]=d[b+k]*3;}return o;};
          const d=new Float32Array(6*SLOT);
          const put=(i,x,y)=>{d[i*3]=y;d[i*3+1]=x;d[i*3+2]=.9;};
          put(0,.5,.55);put(1,.47,.53);put(2,.53,.53);put(5,.42,.65);put(6,.58,.65);
          d[51]=.5;d[52]=.4;d[53]=.9;d[54]=.6;d[55]=.9;
          for(const [n,f] of [["correct",x=>unpadPersons(x,fit,S)],["BROKEN x3",bad]]){
            const q=parsePersons(f(Float32Array.from(d)),undefined,640/360,null)[0];
            const oor=!(q.x1>=-1e-6&&q.y1>=-1e-6&&q.x2<=1+1e-6&&q.y2<=1+1e-6);
            console.log(n,"outOfRange",oor?1:0,"box",q.x1.toFixed(3),q.y1.toFixed(3),q.x2.toFixed(3),q.y2.toFixed(3));}'
COST      The one check standing between a wrong inverse map and every
          person patch on every YouTube video landing in the wrong place
          -- the bench's own words -- cannot fire. The measurement that
          WOULD fire is already in the file and unused: the GEOMETRY
          block's dTop/dBot/dH, which read p50 +0.000 on the n225 run and
          would read a large systematic shift under a broken map.
```

---

## F5

```
SEVERITY  WRONG-NUMBER
WHERE     docs/engine-findings.md 17, "The corrected table" and the
          "Cross-check" line beneath it
CLAIM     The table is the GREEDY arm, labelled "Shipped bundle (CUT_DELTA
          60, PTRACK_IOU_MIN 0.15)" with no mention of the assignment --
          and 1091 ships optimal. Re-run at HEAD, bench/births.mjs gives
          births 141, fresh 38 (27.0%), nearMiss 43, contended 60 (42.6%)
          against the published 147 / 39 (26.5%) / 42 / 65 (44.2%). 17a's
          own delta confirms which arm it is ("contended 65 -> 60"). The
          stated cross-check -- "147 births at IOU 0.15 is exactly what
          10g's independent sweep reports, in both genders" -- is
          contradicted by this range's own iou-ladder-ceiling.txt, which
          reads births 141 (man) and 136 (woman) at 0.15.
FALSIFIER cd app/gaze && node bench/births.mjs | head -3
          # run twice: the first invocation rebuilds .cache and throws
          grep -A4 'IOU_MIN' ../../spikes/gauntlet/iou-ladder-ceiling.txt
COST      The conclusion survives -- contended is still the largest class
          at 42.6% and fresh still the smallest at 27.0% -- so this is
          digits, not a reversal. It costs the same thing 17c and
          control-triple.test.mjs were built to stop: a published table
          that does not reproduce reads as corroboration. control-triple
          pins the exp/fc/phantom triple only; birth counts are outside
          it, which is why this got through the guard added beside it.
```

---

## F6

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/src/assign.mjs:80-85 (OPTIMAL_MAX_SIDE 32); emitted
          bundle app/src-tauri/gaze-page.js: function hj(t,e,r){... if(e>dj
          ||r>dj)return $E(t,e,r) ...} with dj=32
CLAIM     The optimal assignment falls back to greedy above 32 tracks or
          32 observations and NOTHING COUNTS IT. On a device the fallback
          is indistinguishable from the optimal path: birthContended,
          birthFresh, coastExpired and the reads ring all read identically
          either way. This is in the range that added three counters to
          init-entry.js citing, verbatim, that a counter which does not
          exist reads exactly like a counter at zero.
FALSIFIER grep -n 'OPTIMAL_MAX_SIDE' app/gaze/src/assign.mjs
          grep -oE '(dj|Lde|Bde)=[0-9e.+]+' app/src-tauri/gaze-page.js
          grep -c 'IDS\|life\|assignFallback' app/gaze/src/assign.mjs   # 0
COST      Low probability, total blindness if it fires. MoveNet caps at 6
          persons and the face fallback adds a handful, so 32 needs an
          unusual frame -- but videoTracks accumulates and nobody has
          measured its maximum on his phone. If he reports 1091 behaving
          like 1090 on busy footage, no artifact can say whether the
          assignment ran. One (x||0)+1 beside the return.
```

---

## F7

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/test/whole-frame-counter.test.mjs, "the name is new --
          it does not rebase an existing counter"
CLAIM     The test counts occurrences inside init-entry.js only. The
          defect its own comment cites -- clampFired, loop 39 -- was a
          collision BETWEEN region-blur.mjs and body-clamp.mjs, i.e.
          across files, which this cannot see. Verified: appending a
          second, unrelated bump of d.life.wholeFrameSamples to
          src/region-blur.mjs leaves all five assertions green.
FALSIFIER cd app/gaze
          printf '\nexport function _x(d){d.life.wholeFrameSamples=(d.life.wholeFrameSamples||0)+1;}\n' >> src/region-blur.mjs
          node --test test/whole-frame-counter.test.mjs   # pass 5  fail 0
          git checkout -- src/region-blur.mjs
COST      A future counter colliding with one of these three merges two
          unrelated events into one number and silently rebases every
          reading quoted off it -- which is what the test exists to
          prevent and what it cannot detect. Fix: grep src/ rather than
          one file, and assert each name appears in exactly one module.
```

The other four assertions in this file are honest and all turn red on the
obvious edit — deleting one `wholeFrameLife('wholeFrameNoFaces')` call
site gives `pass 4 fail 1`, verified. The counters are also alive on
hardware: `sweep-1091.txt` carries `wholeFrameSamples:1`,
`wholeFrameNoFaces:0`, `wholeFrameCleared:0` in the device report.

---

## F8

```
SEVERITY  NIT
WHERE     app/src-tauri/gaze-page.js (the emitted bundle at HEAD);
          commit 1ede1b6, "rebuild the bundle at a clean tree so the
          marker names a real commit"
CLAIM     Two things, one line apart. (1) The bundle at HEAD predates
          7dd3e03: zero occurrences of unpadPersons, PERSON_LETTERBOX or
          setPersonLetterbox, so no build in the tree carries either
          source file this commit changes, and C4 cannot be run against
          them at all. (2) The marker reads
          __TS_GAZE_BUNDLE__="764da03-dirty" -- still dirty, so the commit
          whose stated purpose was to make the marker name a real commit
          did not achieve it, and neither candidate bundle (0c84079-dirty
          at 764da03, 764da03-dirty at 1ede1b6) resolves to a tree. The
          released 1091 APK therefore carries an identity string that
          names no commit.
FALSIFIER grep -c 'unpadPersons\|PERSON_LETTERBOX' app/src-tauri/gaze-page.js   # 0
          grep -oE '__TS_GAZE_BUNDLE__="[^"]*"' app/src-tauri/gaze-page.js
          for c in 0c84079 764da03 1ede1b6 7dd3e03; do \
            git show $c:app/src-tauri/gaze-page.js | grep -oE '__TS_GAZE_BUNDLE__="[^"]*"'; done
COST      Behaviour-neutral today -- the flag is off and 764da03/1ede1b6
          differ only in the marker line -- so nothing reaches him. It
          costs the verification discipline: "verify constants in the
          build, never the source" needs a build, and the next release
          picks up whatever gaze-page.js happens to be committed. Rebuild
          at HEAD and commit; and make the stamp refuse to emit `-dirty`
          when the only dirty path is gaze-page.js itself.
```

---

## C13 — pre-mortem: he installs 1091 and reports it is worse

Three mechanisms, ranked, each naming what would show it.

**1. More people going sharp, not fewer marks.** 1091 stacks two levers
17b has now shown buy the same thing: optimal matching and
`PTRACK_IOU_MIN` 0.15, which under optimal is the *worst* exposure point
reachable over the air (man 22.5s at 0.15 against 16.0s at 0.35). Optimal
matches strictly more pairs than greedy, and a pair matched onto a man's
CLEARED track is loop 39's largest-exposure mechanism. The corpus already
prices it at +1.0s man / +2.5s woman against 0.20.
*Shows in:* `birthCleared` and `readClearCertain` in the device report,
against `birthContended` falling; source `person-track.mjs` matchTrack.
*Cheapest response:* push `PTRACK_IOU_MIN` 0.20 or 0.25 over OTA — no
install, and the clamp already allows it.

**2. The blur staying up longer, not less.** 1091's phantom win is bought
at the same coast (`PTRACK_MIN_COAST_PASSES` 2, 4000ms), and optimal keeps
alive tracks that greedy used to strand and kill — `coastExpired` 102 → 96
man, 102 → 92 woman on the corpus. A track that no longer dies is a patch
that no longer disappears, which is his loop-40 report ("the blur stays up
longer") arriving from a new cause.
*Shows in:* `coastExpired` against `wipeErased`; source `person-track.mjs`
coastStep.

**3. The assignment silently not running.** F6: above 32 tracks or 32
observations `hj` returns `$E` — greedy — with no counter. If his footage
reaches that on busy frames, 1091 behaves as 1090 there and every artifact
still says "optimal".
*Shows in:* nothing, today. That is the finding.

---

## CHECKED AND CLEAN

- **C4, the assignment.** `Vde="optimal"` and the constant is READ, not
  merely emitted: `(Vde==="optimal"?hj:$E)(i,t.length,e.length)`. Both
  bodies present, the Hungarian not tree-shaken, `Lde=1e3` (the
  cardinality weight 17a describes), `Bde=1e9`, `dj=32`, `Sv=.15`.
- **C1 on every cell of 17b and the tuning.mjs ladder** against
  `spikes/gauntlet/iou-ladder-ceiling.txt`: all eight rows in both genders
  reproduce, and every quoted delta is arithmetically right — ceiling man
  -6.5 / +32.0 / +59.0 and woman -4.5 / +8.5 / +97.0; 0.20 buys back
  1.0/2.5 for 19.0/31.0; 0.30 buys back 5.5/5.5 for 33.5/74.5; births
  141 → 184 man and 136 → 184 woman.
- **17a's greedy row reproduces from a different file than published it.**
  Flipping `PTRACK_ASSIGN` to greedy and running the control arm gives man
  23.0 and woman 24.5 — the published greedy triple.
- **C2/C3 positive controls.** Every new test can be turned red:
  `unpad-persons` by removing the clamp (1 fail) or dropping the y offset
  from the inverse (3 fail); `whole-frame-counter` by deleting a call site
  (1 fail); `control-triple` by flipping the assignment (2 fail).
  `assign-wired.test.mjs` is the strongest of the five — it goes through
  `updatePersonTracks` rather than the pure function (C3), asserts its
  fixture's precondition, and asserts that the two modes actually disagree
  through the tracker.
- **C7 on the three new counters.** Distinct names, seeded together on the
  first sample so absent is distinguishable from never-hooked, both
  detector paths instrumented, the reveal counted apart from the blind
  frame, and all three present in the device report in `sweep-1091.txt`.
- **C8 scope.** Nothing in the range outside the named work. No path
  matching `.env*`, `**/auth/**`, `**/payment*/**`, `**/migrations/**`,
  `*.sql`, `.github/workflows/**`, `src-tauri/capabilities/**`, or any
  filename containing key/secret/token/credential.
- **C9.** No patch is subtracted, split or windowed. The assignment is
  deliberately NOT on the OTA whitelist (code may not travel here), and
  `PTRACK_IOU_MIN`'s clamp is unchanged at [0.10, 0.35].
- **Oracle.** gaze 573/573, 0 skipped, 0 failed; cargo 60/60. The
  control-triple assertions really run — 135ms and 87ms with the corpus
  present — so they are not silently skipping.
