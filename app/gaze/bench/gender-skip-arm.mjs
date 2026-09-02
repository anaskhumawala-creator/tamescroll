// GENDER ONLY FOR TRACKS THAT NEED A READ -- PRICED ON THE CORPUS.
//
// Task 4 of docs/superpowers/plans/2026-09-02-latency-restructure-and-delay-line.md.
// A crop + gender read costs ~536ms of faceres on the arm64 Redmi; a
// track whose verdict is already SETTLED -- a flag-certain blur, or a
// cleared track re-confirmed inside GENDER_REFRESH_MS -- gains nothing
// from paying for another one this pass. init-entry.js now finds each
// picked person's existing track by best IoU and, when
// `trackNeedsRead(track, now)` is false, pushes a positionOnly
// observation instead of running the crop + gender read.
//
// THE SHIPPED CALL, NOT A BENCH REIMPLEMENTATION OF IT (same rule
// mnbody-ab.mjs, cut-value.mjs and every other arm in this directory
// follow after being burned by the opposite). This file does not
// reimplement the skip decision -- it wraps the SHIPPED
// `updatePersonTracks` so the transformation runs on the exact tracks
// the shipped tracker itself would see, using the shipped
// `trackNeedsRead` / `iou` / `PTRACK_IOU_MIN`. `arch-arms.mjs` has no
// option for this (it is not a geometry or cadence lever, it is a
// decision about whether to pay for a read at all), so the hook is the
// one seam `makeArms` already exposes: it destructures
// `mod.updatePersonTracks` from whatever module object it is handed,
// so a module object whose `updatePersonTracks` is wrapped runs the
// wrapper on every frame with no change to arch-arms.mjs at all.
//
// THE WALL CLOCK. Observations built by arch-arms never carry `obs.at`
// (the app-side field this repo's `at` plumbing is Task 4, not
// arch-arms' business), so the wrapper stamps one itself: a per-window
// clock that starts at 0 and advances by `dt` (the corpus's own
// 1000/fps) on every call -- the same "one tick per replayed frame"
// convention `inferCadence`'s `stride` and `vdt` are already built on.
// Reset once per window, synchronously, before that window's replay
// runs (JS is single-threaded and `arm(win, g)` finishes one window
// before the next is handed to it, so there is no reentrancy hazard).
//
// RED-PROOF, BUILT IN: `setGenderRefreshMs(0)` makes
// `nowMs - t.readAt >= GENDER_REFRESH_MS` true for every track that has
// ever been read (the clock only ever advances, so `readAt` -- stamped
// from an earlier or equal tick -- can never be ahead of `nowMs`), and
// `!(t.readAt > 0)` catches every track that has not. So at 0 the skip
// can never fire and the arm must reproduce CONTROL byte for byte --
// asserted below, not merely printed.
import { loadWin, makeArms, thinFrames, hisRegimeOpts, K_HIS, CONTROL } from './arch-arms.mjs';
import { score } from './corpus-score.mjs';
import { ROOT, winFiles } from './corpus-lib.mjs';
import fs from 'fs';

const S = await import('./.cache/shipped.mjs');

const K = Number(process.env.K || K_HIS);
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);

let skipFired = 0;

/**
 * A module object identical to the shipped one except that
 * `updatePersonTracks` is wrapped to apply the Task-4 gender-skip
 * decision on the way in. Returns the wrapper's clock alongside it so
 * the caller can reset it between windows.
 */
function skipModule() {
  const clock = { ms: 0 };
  const real = S.updatePersonTracks;
  function wrapped(tracks, obs, dt, held) {
    const nowMs = clock.ms;
    clock.ms += dt;
    const out = obs.map((o) => {
      // Every observation gets a stamp, positionOnly ones included --
      // newTrack reads `obs.positionOnly ? 0 : (obs.at || 0)`, so a
      // positionOnly stamp is inert, but a bare object without one
      // would make readAt silently depend on call order instead of on
      // this arm's clock.
      const stamped = o.at != null ? o : { ...o, at: nowMs };
      if (stamped.positionOnly) return stamped;
      let matched = null, bestIou = 0;
      for (const t of tracks) {
        const v = S.iou(stamped.box, t.box);
        if (v >= S.PTRACK_IOU_MIN && v > bestIou) { bestIou = v; matched = t; }
      }
      if (matched && !S.trackNeedsRead(matched, nowMs)) {
        skipFired++;
        return { box: stamped.box, positionOnly: true, at: nowMs };
      }
      return stamped;
    });
    return real(tracks, out, dt, held);
  }
  return { mod: { ...S, updatePersonTracks: wrapped }, clock };
}

function runControl(g) {
  const arm = makeArms(S)(hisRegimeOpts(g));
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  for (const w of wins) {
    const s = score(arm(thinFrames(w, K), g), g, (crop) => cropLabel.get(crop));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return agg;
}

function runSkip(g, refreshMs) {
  S.setGenderRefreshMs(refreshMs);
  const { mod, clock } = skipModule();
  const arm = makeArms(mod)(hisRegimeOpts(g));
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  skipFired = 0;
  for (const w of wins) {
    clock.ms = 0;
    const s = score(arm(thinFrames(w, K), g), g, (crop) => cropLabel.get(crop));
    for (const k of Object.keys(agg)) agg[k] += s[k];
  }
  return { agg, skipFired };
}

function checkControl(g, r) {
  const want = CONTROL[g];
  const ok = Object.keys(want).every((k) => r[k] === want[k]);
  if (!ok) {
    console.error(`\nCONTROL does not reproduce (${g}): got ${JSON.stringify(r)} `
      + `want ${JSON.stringify(want)}. Refusing to print a table outside his regime.`);
    process.exit(2);
  }
}

function row(name, r, base) {
  const d = (k) => (base === r ? '' : ` (${r[k] - base[k] >= 0 ? '+' : ''}${(r[k] - base[k]).toFixed(1)})`);
  return name.padEnd(28)
    + r.exposureS.toFixed(1).padStart(10) + d('exposureS')
    + r.falseCoverS.toFixed(1).padStart(10) + d('falseCoverS')
    + r.phantomS.toFixed(1).padStart(10) + d('phantomS');
}

console.log(`18 windows, k=${K} (${(K * 0.5).toFixed(1)}s/verdict), his regime`);
console.log(`CONTROL must read ${CONTROL.config}`);
console.log('');

let allWithinBudget = true;
for (const g of ['man', 'woman']) {
  console.log(`-- ${g.toUpperCase()} --`);
  console.log('arm'.padEnd(28) + '  exposure  falseCover     phantom');

  const control = runControl(g);
  checkControl(g, control);
  console.log(row('CONTROL', control, control));

  // RED-PROOF: refresh 0 must be BYTE-IDENTICAL to CONTROL. This is the
  // property the whole design rests on -- a floor of 0 can never skip a
  // read -- so it is asserted, not eyeballed.
  const zero = runSkip(g, 0);
  const zeroMatches = Object.keys(control).every((k) => zero.agg[k] === control[k]);
  console.log(row('skip @ GENDER_REFRESH_MS=0', zero.agg, control)
    + `  fired=${zero.skipFired}`);
  if (!zeroMatches || zero.skipFired !== 0) {
    console.error(`\nRED-PROOF FAILED for ${g}: GENDER_REFRESH_MS=0 must reproduce `
      + `CONTROL exactly and fire the skip zero times. Got skip=${JSON.stringify(zero.agg)} `
      + `fired=${zero.skipFired} against CONTROL=${JSON.stringify(control)}. `
      + 'This is a defect in the arm or the predicate, not a tuning question.');
    process.exit(2);
  }

  const shipped = runSkip(g, 2000);
  console.log(row('skip @ GENDER_REFRESH_MS=2000 (shipped)', shipped.agg, control)
    + `  fired=${shipped.skipFired}`);

  const exposureDelta = shipped.agg.exposureS - control.exposureS;
  const withinBudget = exposureDelta <= 1.0;
  allWithinBudget = allWithinBudget && withinBudget;
  console.log(`  exposure delta vs CONTROL: ${exposureDelta >= 0 ? '+' : ''}${exposureDelta.toFixed(1)}s `
    + `(acceptance: <= +1.0s) -- ${withinBudget ? 'PASS' : 'FAIL'}`);
  console.log('');
}

console.log(allWithinBudget
  ? 'ACCEPTANCE MET on both modes: exposure moved by no more than +1.0s of CONTROL.'
  : 'ACCEPTANCE NOT MET on at least one mode. Reporting the numbers above and '
    + 'stopping -- no constant here is tuned on this instrument\'s say-so; the '
    + 'ruling is his.');
