// THE DIAGNOSTICS REPORT, AND THE RULE THAT MAKES IT SAFE TO EXIST.
//
// Owner 2026-08-28: "can't you implement a diagnostics feature in the app
// so that it automatically gets reported and such so you can always check
// the logs", and then, deciding the shape himself: "or give me the
// control of reporting".
//
// WHY THIS EXISTS. Every performance number this project has ever had
// came from a desktop under a 6x CPU throttle. His phone is a Helio G88
// on the other side of the country with no adb to it, so the two
// complaints he has made most often -- "it halts" and "you said it was
// done and it wasn't" -- have never once been measured where they
// happen. This module turns the diagnostics the pipeline already keeps
// in memory into something that can leave the page.
//
// WHY IT IS ALSO THE MOST DANGEROUS THING IN THIS REPO. The premise of
// the app is that nothing about what you watch goes anywhere. A
// diagnostics channel is exactly how that promise gets broken by
// accident, one convenient field at a time -- the image ring already
// carries the thumbnail URL, which identifies the exact video.
//
// So the safety is MECHANICAL, not editorial: `reportViolations` walks
// the serialized report and rejects anything that is not a number or a
// value from a closed set, with free text allowed only in fields whose
// key ends in `R` (mnemonic: Redacted) and only after passing through
// `redactFreeText`. It is a unit test, and it is also run at runtime
// before a report is handed over. A field added later that forgets the
// redactor fails the test rather than shipping.

/** Free text is the only place a URL can hide, so it is the only place
 * that gets scrubbed. Error messages routinely embed the request that
 * failed, which is how a thumbnail url would reach a log file. */
export function redactFreeText(s) {
  if (typeof s !== 'string' || !s) return null;
  var out = s
    // Anything with a scheme, and anything protocol-relative.
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, '<url>')
    .replace(/\/\/\S*/g, '<url>')
    // A dotted token is a hostname or a filename; neither is worth the
    // risk of being a hostname.
    .replace(/\b[a-z0-9-]+(\.[a-z0-9-]+)+\b/gi, '<host>')
    // Query syntax carries search terms and ids.
    .replace(/[?&=%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!out) return null;
  return out.length > 80 ? out.slice(0, 80) : out;
}

/** p-th percentile of an array of numbers, or null when there is none. */
export function pctl(values, p) {
  if (!values || !values.length) return null;
  var a = values.slice().sort(function (x, y) {
    return x - y;
  });
  var i = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)));
  return Math.round(a[i]);
}

/** A CONTENT-DERIVED TIME SERIES IS A FINGERPRINT; A HISTOGRAM IS NOT.
 *
 * The scene gate keeps 600 luma deltas at 10Hz. That series is a
 * signature of the actual footage -- it would survive a shot-boundary
 * comparison against a known video. Binned counts answer the only
 * question a diagnostic asks of it ("how much cutting is in this?")
 * and answer nothing else. */
export function histogram(values, edges) {
  var bins = new Array(edges.length + 1).fill(0);
  if (!values) return bins;
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (typeof v !== 'number' || !isFinite(v)) continue;
    var b = edges.length;
    for (var e = 0; e < edges.length; e++) {
      if (v <= edges[e]) {
        b = e;
        break;
      }
    }
    bins[b]++;
  }
  return bins;
}

// Every string the report is allowed to carry OUTSIDE an `R` field.
// Closed sets only: a platform id, a page kind, a mode. If a value is
// not in here and not a number, the report does not go.
var ENUMS = {
  platform: ['youtube', 'reddit', 'x', 'instagram', 'facebook', 'other'],
  kind: ['home', 'watch', 'search', 'channel', 'post', 'feed', 'other'],
  gazeMode: ['off', 'blur', 'smart', 'none'],
  gender: ['man', 'woman', 'none'],
  os: ['android', 'windows', 'other'],
  where: ['page', 'worker', 'cache'],
  why: ['face', 'nsfw', 'text', 'clear', 'pending', 'error', 'other'],
  g: ['male', 'female', 'unknown'],
  backend: ['webgl', 'cpu', 'none'],
  otaLast: ['ok', 'fail', 'never'],
  codec: ['av01', 'vp09', 'avc1', 'other', 'none'],
  nativeBackend: ['npu', 'gpu', 'cpu', 'none'],
  npu: ['ok', 'failed', 'pending', 'absent', 'disabled', 'none'],
  // O10: the auto-test row keeps a per-model backend as three flat
  // fields (`faceBackend`/`genderBackend`/`personBackend`) rather than
  // nesting them under `nativeBackend` the way `native.models` above
  // does, so a row off the phone and a row off probe_drops_ab.py stay
  // the same shape. The walker looks a string up by the KEY it sits
  // under, so each flat name needs its own entry here -- the same
  // closed set nativeBackend already uses.
  faceBackend: ['npu', 'gpu', 'cpu', 'none'],
  genderBackend: ['npu', 'gpu', 'cpu', 'none'],
  personBackend: ['npu', 'gpu', 'cpu', 'none'],
};

/** The version string of a WebView or an OS is free-form vendor text,
 * but it is not content, and it is the single most useful field for
 * reproducing a device-only bug. Allowed, and constrained to the shape
 * a version actually has. */
var VERSIONISH = /^[0-9A-Za-z][0-9A-Za-z ._-]{0,39}$/;
var VERSION_KEYS = ['versionName', 'osVersion', 'model', 'webview', 'rulesGen'];
// The report's own random id: hex, fixed length, carries nothing.
var HEXISH = /^[0-9a-f]{8,32}$/;

/**
 * Walks the report and returns the list of reasons it may not leave the
 * device. Empty list = safe. This is the invariant; everything else in
 * this file exists to satisfy it.
 *
 * @param {object} report
 * @param {string} href  the page's own location.href, so the check can
 *   prove no piece of it survived into the report.
 */
export function reportViolations(report, href) {
  var bad = [];
  var json;
  try {
    json = JSON.stringify(report);
  } catch (e) {
    return ['not serializable'];
  }
  if (json.indexOf('://') !== -1) bad.push('contains a scheme');
  if (json.indexOf('//') !== -1) bad.push('contains a protocol-relative url');
  var dotted = json.match(/[a-z0-9-]+\.[a-z]{2,}/i);
  // A version string legitimately looks dotted ("126.0.6478.122"), so
  // the hostname test is letters-after-the-dot only.
  if (dotted) bad.push('contains a hostname-shaped token: ' + dotted[0]);

  // No run of the page's own url may survive. 9 characters is short
  // enough to catch a video id (11) and long enough not to trip on
  // "youtube" appearing as a platform name.
  if (typeof href === 'string' && href.length >= 9) {
    for (var i = 0; i + 9 <= href.length; i++) {
      var run = href.slice(i, i + 9);
      if (ENUMS.platform.indexOf(run) !== -1) continue;
      if (json.indexOf(run) !== -1) {
        bad.push('contains a run of location.href');
        break;
      }
    }
  }

  walk(report, '', bad);
  return bad;
}

function walk(node, key, bad) {
  if (node === null || node === undefined) return;
  var t = typeof node;
  if (t === 'number') {
    if (!isFinite(node)) bad.push(key + ': non-finite number');
    return;
  }
  if (t === 'boolean') return;
  if (t === 'string') {
    if (/R$/.test(key)) {
      if (node.length > 80) bad.push(key + ': redacted field over 80 chars');
      return;
    }
    if (key === 'id') {
      if (!HEXISH.test(node)) bad.push('id: not a report id');
      return;
    }
    if (VERSION_KEYS.indexOf(key) !== -1) {
      if (!VERSIONISH.test(node)) bad.push(key + ': not version-shaped');
      return;
    }
    var allowed = ENUMS[key];
    if (!allowed) {
      bad.push(key + ': free text outside an R field');
      return;
    }
    if (allowed.indexOf(node) === -1) bad.push(key + ': "' + node + '" not in its enum');
    return;
  }
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) walk(node[i], key, bad);
    return;
  }
  if (t === 'object') {
    var keys = Object.keys(node);
    for (var k = 0; k < keys.length; k++) walk(node[keys[k]], keys[k], bad);
    return;
  }
  bad.push(key + ': unsupported type ' + t);
}

/** Which platform this is, from a hostname, WITHOUT keeping the
 * hostname. The report names the platform we already know we opened;
 * it never carries the url that named it. */
export function platformOf(host) {
  var h = String(host || '').toLowerCase();
  if (h.indexOf('youtube') !== -1) return 'youtube';
  if (h.indexOf('reddit') !== -1) return 'reddit';
  if (h === 'x.com' || h.indexOf('twitter') !== -1 || h.indexOf('.x.com') !== -1) return 'x';
  if (h.indexOf('instagram') !== -1) return 'instagram';
  if (h.indexOf('facebook') !== -1) return 'facebook';
  return 'other';
}

/** The SHAPE of the path, never the path. "watch" tells us a player is
 * involved; the video id tells us what he watched, and is exactly what
 * must never be here. */
export function pageKind(platform, path) {
  var p = String(path || '');
  if (platform === 'youtube') {
    if (/^\/watch/.test(p)) return 'watch';
    if (/^\/results/.test(p)) return 'search';
    if (/^\/(@|channel|c|user)/.test(p)) return 'channel';
    if (/^\/feed\//.test(p)) return 'feed';
    if (p === '/' || p === '') return 'home';
    return 'other';
  }
  if (platform === 'reddit') {
    if (/\/comments\//.test(p)) return 'post';
    if (/^\/r\//.test(p)) return 'feed';
    if (/^\/search/.test(p)) return 'search';
    if (p === '/' || p === '') return 'home';
    return 'other';
  }
  if (p === '/' || p === '') return 'home';
  if (/^\/(search|explore)/.test(p)) return 'search';
  return 'other';
}

// How much of each ring survives into a report. Rings are for spotting a
// pattern, not for replaying a session, and a bigger report is a bigger
// thing to get wrong.
var KEEP = { images: 40, stages: 40, slots: 12, reads: 60, gate: 40 };

/**
 * Build one report from a raw snapshot of the in-page diagnostics.
 *
 * PURE: everything it needs is in `snap`, so the whole redaction story
 * is testable without a DOM, a device, or a running pipeline.
 */
function gateEntry(e) {
  // `cov` is the one that decides whether a refusal MATTERS: 1 means a
  // blurred track was already covering that spot when the gate threw
  // the face away, 0 means it was an uncovered person.
  // `g`/`s` only exist in a __TS_GATE_AUDIT run and are numbers, never
  // labels: 0 unknown, 1 male, 2 female, with the certainty beside it.
  // In a shipped run they are absent and read null.
  return {
    ms: num(e.ms),
    c: num(e.c),
    px: num(e.px),
    k: num(e.k),
    cov: num(e.cov),
    g: num(e.g),
    s: num(e.s),
    // The landmark geometry, flattened: nine numbers, no nesting, so the
    // report invariant checks each one the same way it checks the rest.
    // Absent on a detection with no landmarks (the in-page fallback and
    // any synthetic face-from-body), and absent is `null`, never a guess.
    m: e.m ? {
      es: num(e.m.es), md: num(e.m.md), nd: num(e.m.nd), ea: num(e.m.ea),
      ti: num(e.m.ti), as: num(e.m.as), ib: num(e.m.ib), sp: num(e.m.sp),
      dg: num(e.m.dg),
    } : null,
  };
}

export function buildReport(snap) {
  var s = snap || {};
  var timing = s.timing || {};
  var worker = s.worker || {};
  var ids = s.ids || {};
  var life = ids.life || {};
  var imgs = (s.imgdiag || []).slice(-KEEP.images);

  // Gaps between finished images. This one number is the owner's "it
  // processes some, then it halts" -- p95 is the halt.
  var gaps = [];
  for (var i = 1; i < imgs.length; i++) {
    var a = imgs[i - 1].t;
    var b = imgs[i].t;
    if (typeof a === 'number' && typeof b === 'number' && b >= a) gaps.push(b - a);
  }

  var stages = (ids.stages || []).slice(-KEEP.stages);
  var verdicts = [];
  var positions = [];
  for (var v = 0; v < stages.length; v++) {
    var e = stages[v].end;
    if (typeof e !== 'number') continue;
    if (stages[v].v) verdicts.push(e);
    else positions.push(e);
  }

  return {
    v: 1,
    id: s.id || null,
    t: s.t || null,
    app: {
      versionCode: num(s.versionCode),
      versionName: str(s.versionName),
      os: ENUMS.os.indexOf(s.os) === -1 ? 'other' : s.os,
      osVersion: str(s.osVersion),
      model: str(s.model),
      webview: str(s.webview),
      cores: num(s.cores),
      dpr: num(s.dpr),
      vw: num(s.vw),
      vh: num(s.vh),
    },
    page: {
      platform: s.platform || 'other',
      kind: s.kind || 'other',
      gazeMode: s.gazeMode || 'none',
      gender: s.gender || 'none',
      blurPx: num(s.blurPx),
      ageMs: num(s.ageMs),
    },
    engine: {
      rulesGen: str(s.rulesGen),
      otaLast: ENUMS.otaLast.indexOf(s.otaLast) === -1 ? 'never' : s.otaLast,
      otaAgeH: num(s.otaAgeH),
      activeRules: num(s.activeRules),
      cssBytes: num(s.cssBytes),
      // seen == 0 means page request interception is not wired at all;
      // seen > 0 with blocked == 0 means it is wired and nothing
      // matched. Four "ads came back" reports could not tell those
      // apart, and one of them turned out to be the first.
      seen: num(s.seen),
      blocked: num(s.blocked),
      // WHICH TUNED NUMBERS HIS PHONE IS ACTUALLY RUNNING.
      //
      // The OTA tuning channel exists so a threshold moves without an
      // install. Until now the artifact could not say whether a pushed
      // number REACHED his device, was CLAMPED to a range edge, or was
      // REFUSED -- so a tuned phone and an untuned one produced
      // identical reports, and every ring read since the channel shipped
      // was unattributable to a set of constants.
      tuning: tuningBlock(ids.tuning),
    },
    boot: {
      evalMs: num(s.evalMs),
      face: num(timing.face),
      faceAt: num(timing.faceAt),
      gender: num(timing.gender),
      genderAt: num(timing.genderAt),
      nsfw: num(timing.nsfw),
      person: num(timing.person),
      personAt: num(timing.personAt),
    },
    // THE FIRST QUESTION A PHONE REPORT ANSWERS. If the Android worker
    // lands on the CPU backend, the player path silently never left the
    // main thread on his device and every number this session produced
    // describes a machine he does not own.
    worker: {
      up: num(worker.up),
      ready: num(worker.ready),
      backend: ENUMS.backend.indexOf(worker.backend) === -1 ? 'none' : worker.backend,
      loadedFace: num(worker['loaded:face']),
      loadedGender: num(worker['loaded:gender']),
      loadedNsfw: num(worker['loaded:nsfw']),
      loadedPerson: num(worker['loaded:person']),
      // ASKED, not just loaded. `loadedPerson` alone could not separate a
      // model requested late from one that answered slowly, and his
      // 78,807ms report was exactly that ambiguity -- the difference
      // between a scheduling bug and a slow parse.
      askedPerson: num(worker['asked:person']),
      dead: !!worker.dead,
      whyR: redactFreeText(worker.why),
      bannedR: redactFreeText(worker.videoBanned),
    },
    images: {
      n: num(s.imgTotal),
      shown: imgs.length,
      gapsP50: pctl(gaps, 0.5),
      gapsP95: pctl(gaps, 0.95),
      msP50: pctl(pluck(imgs, 'ms'), 0.5),
      msP95: pctl(pluck(imgs, 'ms'), 0.95),
      // DID THE THUMBNAIL NULL GUARD FIRE ON HIS PHONE, AND ON WHAT.
      //
      // Two aggregates, no per-read data. `nullRefused` is the guard's
      // own count summed over the ring; `faces` minus `flagged` cannot
      // substitute for it, because a same-gender clear subtracts there
      // too. `nmP50` is the median descriptor magnitude, which says
      // whether the refusals are landing on GRAPHICS (finding 52: junk
      // p50 3.44 against a floor of 5) or on people.
      //
      // Without these his Share cannot answer whether 1104 did anything,
      // and his phone is the only phone that matters and reports only
      // this way. Aggregates deliberately -- the ring stays free of
      // per-face rows.
      nullRefused: sum(pluck(imgs, 'nr')),
      // NOT `pctl`, deliberately: it rounds to an integer, which is
      // right for milliseconds and destroys this number. The floor is 5
      // and finding 52's junk median is 3.44 -- rounding sends 3.44 to 3
      // and 4.6 to 5, i.e. across the very bar this reports on. One
      // decimal.
      nmP50: median1(imgs.reduce(function (a, r) {
        var rs = r.reads || [];
        for (var i = 0; i < rs.length; i++) {
          if (typeof rs[i].n === 'number') a.push(rs[i].n);
        }
        return a;
      }, [])),
      // The ring itself, minus the one field that identifies the video.
      ring: imgs.map(function (r) {
        return {
          t: num(r.t),
          ms: num(r.ms),
          w: num(r.w),
          where: ENUMS.where.indexOf(r.where) === -1 ? 'page' : r.where,
          why: ENUMS.why.indexOf(r.why) === -1 ? 'other' : r.why,
          faces: num(r.faces),
          flagged: num(r.flagged),
          msgR: redactFreeText(r.msg),
        };
      }),
    },
    // WHICH CODEC, WHICH ENGINE (research 2026-09-03). The codec family
    // the player opened its buffer with -- AV1 on a phone with no AV1
    // decoder is software decode on the page's own cores -- and where
    // each native model landed once the NPU auto-try ran.
    // Field NAMES are enum keys: the violation walker looks a string up
    // by the key it sits under, so every enum-valued field here is named
    // after its enum.
    codec: {
      codec: enumOr('codec', s.codec && s.codec.codec, 'none'),
      changes: num(s.codec && s.codec.codecChanges),
      // 0 = the wrappers never installed, so 'none' above says nothing
      // (phase-n N13); 1 = installed, so 'none' means no video buffer.
      hooked: num(s.codec && s.codec.hooked),
    },
    native: {
      nativeBackend: enumOr('nativeBackend', s.native && s.native.backend, 'none'),
      npu: enumOr('npu', s.native && s.native.npu, 'none'),
      // HOW MUCH of the engine the worst-of `nativeBackend` above is
      // hiding. One model on CPU paints that field 'cpu', which on his
      // 1104 share meant "faceres alone is on CPU" and read as "nothing
      // is on the GPU". -1 = an engine too old to say.
      nGpu: num(s.native && s.native.nGpu),
      models: {
        face: {
          nativeBackend: enumOr('nativeBackend', s.native && s.native.backends && s.native.backends['1'], 'none'),
          gpu: gpuNote(s.native && s.native.gpu, '1'),
          npuWhyR: npuWhy(s.native && s.native.npuWhy, '1'),
        },
        gender: {
          nativeBackend: enumOr('nativeBackend', s.native && s.native.backends && s.native.backends['2'], 'none'),
          gpu: gpuNote(s.native && s.native.gpu, '2'),
          npuWhyR: npuWhy(s.native && s.native.npuWhy, '2'),
        },
        person: {
          nativeBackend: enumOr('nativeBackend', s.native && s.native.backends && s.native.backends['3'], 'none'),
          gpu: gpuNote(s.native && s.native.gpu, '3'),
          npuWhyR: npuWhy(s.native && s.native.npuWhy, '3'),
        },
      },
      dead: !!(s.native && s.native.dead),
    },
    perf: {
      slowed: num(s.perf && s.perf.slowed),
      restored: num(s.perf && s.perf.restored),
      // av01 capability answers the document-start wrappers refused.
      av1Refused: num(s.perf && s.perf.av1Refused),
    },
    // The presenter's own paint counters (phase-n N10): repaints and
    // patchesDrawn move with BLUR_IN_FRAME, gl with PRESENTER_GL, lost
    // is 1 once the GL presenter handed the video back.
    paint: {
      repaints: num(s.paint && s.paint.repaints),
      patchesDrawn: num(s.paint && s.paint.patchesDrawn),
      gl: num(s.paint && s.paint.gl),
      lost: s.paint && s.paint.lost ? 1 : 0,
      errors: num(s.paint && s.paint.errors && s.paint.errors.length),
    },
    player: {
      attached: !!s.playerAttached,
      verdictP50: pctl(verdicts, 0.5),
      verdictP95: pctl(verdicts, 0.95),
      passP50: pctl(positions, 0.5),
      // The ring's length saturates; these two do not.
      passes: num(ids.passesTotal),
      verdicts: num(ids.verdictsTotal),
      passesRing: stages.length,
      passFails: num(ids.passFails),
      timeouts: num(ids.timeouts),
      lastFailR: redactFreeText(ids.lastFail),
      // Cut/static classification as counts, and the luma series only
      // ever as bins -- see `histogram`.
      lumaHist: histogram(ids.luma, [3, 10, 28, 60, 120]),
      slots: (ids.slots || []).slice(-KEEP.slots).map(function (x) {
        return { n: num(x.n), hd: num(x.hd), ha: num(x.ha) };
      }),
      // THE ERASER AND THE GATES THAT FEED IT. These counters existed
      // in the page and reached NO report, so the artifact he sends
      // could not have shown the 1070 regression -- a held
      // `noHumanShape` making `wipeIfEmpty` erase a woman's patch while
      // faces were plainly detected. All numeric, so they cost the
      // violation walker nothing.
      // A WHITELIST IS THE SAME DEFECT AGAIN. Loop 34 shipped these six
      // because `buildReport` had no life block at all; loop 37 then
      // added counters in the page that STILL never reached a report,
      // because adding a counter and adding it here are two edits and
      // only one of them is obvious. So every numeric counter passes
      // through and the SHAPE is what bounds it -- see lifeCounters,
      // which does not assume anything about who wrote the bag.
      life: lifeCounters(life),
      // WHAT THE GHOST GATE SPLIT, both sides. Three numbers per entry:
      // the face's own confidence, its native pixel size, and the frame
      // keypoint maximum PFF_FRAME_KP_FLOOR was compared against. If the
      // refused population looks like the kept one, the floor is
      // refusing people rather than graphics -- and on his phone it
      // takes about three faces in four.
      gateRefused: (ids.gateRefused || []).slice(-KEEP.gate).map(gateEntry),
      gateKept: (ids.gateKept || []).slice(-KEEP.gate).map(gateEntry),
      reads: (ids.reads || []).slice(-KEEP.reads).map(function (r) {
        return {
          g: ENUMS.g.indexOf(r.g) === -1 ? 'unknown' : r.g,
          s: num(r.s),
          a: num(r.a),
          pc: num(r.pc),
          v: num(r.v),
          px: num(r.px),
        };
      }),
    },
    // THE SAME WHITELIST, IN THE SAME FILE, ONE BLOCK DOWN. Every hide
    // counter added to video-region -- hideNoVr, hideZeroVr, hideClipped,
    // rectsNoBoxes, drawnZero, clipRebuilt -- would have stopped here and
    // never reached the artifact he sends, which is exactly the defect
    // `player.life` was just fixed for. Same shape check, so the same
    // guarantee.
    render: s.render ? lifeCounters(s.render, 'renderDropped') : null,
    // WHAT HE CHANGED ON THE PHONE, AND WHAT IT MEASURED.
    //
    // `engine.tuning` above answers "which numbers arrived over the
    // air". It cannot answer "which numbers is this phone running",
    // because the in-player panel writes a LOCAL override that wins over
    // the pushed value for that key -- so without this block a phone
    // with four dials moved by hand reports as a stock one, and every
    // ring read off it is unattributable in exactly the way the OTA
    // channel already taught us to care about.
    //
    // `autotest` is the on-device A/B: the same fields
    // probe_drops_ab.py prints, so a row off his phone and a row off the
    // Redmi are comparable. `arm` is an INDEX into auto-test.ARMS, which
    // is append-only for this reason.
    //
    // `applied` carries our own constant names as object KEYS, which the
    // violation walker never inspects -- only values are checked, and
    // every value here is a number by construction. That is why this
    // block needs no new enum: the two string fields are named after the
    // enums they already had.
    tune: tuneBlock(s.tune),
    // `ours` means one of our own recorded main-thread segments fell
    // inside that task -- overlap, not authorship. A 360ms task can be
    // the page's with 20ms of ours in it. Zero overlaps would settle the
    // question the other way outright.
    main: {
      longTasks: num(s.longTasks),
      longTaskMaxMs: num(s.longTaskMaxMs),
      longTasksOurs: num(s.longTasksOurs),
      longTaskOursMaxMs: num(s.longTaskOursMaxMs),
    },
  };
}

// A count, not a percentile: how many times a rule fired across the
// ring. Absent stays 0 rather than null -- "the guard never fired" and
// "no images yet" are told apart by `n`/`shown` right beside it.
function sum(values) {
  var t = 0;
  for (var i = 0; i < values.length; i++) t += values[i];
  return t;
}

// A median kept to one decimal. See `nmP50` for why `pctl` cannot be
// used here.
function median1(values) {
  if (!values || !values.length) return null;
  var a = values.slice().sort(function (x, y) { return x - y; });
  return Math.round(a[Math.floor((a.length - 1) / 2)] * 10) / 10;
}

function pluck(rows, key) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (typeof rows[i][key] === 'number') out.push(rows[i][key]);
  }
  return out;
}

// Every own key of IDS.life whose value is a finite number, restricted
// to identifier-shaped keys and bounded in count.
//
// THE SHAPE IS THE GUARANTEE, NOT THE WRITER. `__TS_GAZE_IDS` lives on
// `window` in the PAGE world, which YouTube's own script shares, so
// "only our code writes it" is not something this function may assume --
// it is checked here. A key that is not a plain identifier, a key ending
// `R` (the report invariant reserves those for redacted free text), or a
// value that is not a finite number is dropped rather than carried.
//
// AND A CAP THAT SILENTLY EVICTS IS THE DEFECT IT REPLACED. Sorting and
// truncating at N means 96 keys named `aFlood*` push every real counter
// out and the report still looks healthy -- executed, and it kept 96 of
// 102 with none of the six eraser counters among them. So the cap is
// generous against the ~49 keys that exist, and what it drops is
// COUNTED: `lifeDropped` is itself a number, so it survives the
// invariant and a truncated report says so out loud.
export var LIFE_MAX_KEYS = 256;
export function lifeCounters(life, dropKey) {
  var out = {};
  if (!life || typeof life !== 'object') return out;
  var keys = Object.keys(life).sort();
  var n = 0;
  var dropped = 0;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(k)) { dropped++; continue; }
    if (k.charAt(k.length - 1) === 'R') { dropped++; continue; }
    var v = life[k];
    if (typeof v !== 'number' || !isFinite(v)) { dropped++; continue; }
    if (n >= LIFE_MAX_KEYS) { dropped++; continue; }
    out[k] = Math.round(v * 1000) / 1000;
    n++;
  }
  if (dropped) out[dropKey || 'lifeDropped'] = dropped;
  return out;
}

// Numbers only, BY CONSTRUCTION: a value that is not finite is dropped
// rather than coerced, so a hostile or malformed window value cannot put
// a string into the report. `applied` is the tuning whitelist's own
// output and could only hold known numeric keys -- it is filtered anyway,
// because the report's guarantee is its shape check and never an
// assumption about who wrote the object it read.
// `coastMs` and `toldMs` are DERIVED, not pushed, and that is why they
// are here: the same pushed PTRACK_MIN_COAST_PASSES means two different
// coast windows at two different cadences (phase-D D1), so `applied`
// alone cannot say what a device is running. Stamped on every verdict
// pass by init-entry; null on a page whose player never ran a pass.
function tuningBlock(t) {
  var out = {
    refused: num(t && t.refused),
    clamped: num(t && t.clamped),
    coastMs: num(t && t.coastMs),
    toldMs: num(t && t.toldMs),
    applied: {},
  };
  var a = t && t.applied;
  if (a && typeof a === 'object') {
    for (var k in a) {
      if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
      if (typeof a[k] === 'number' && isFinite(a[k])) out.applied[k] = a[k];
    }
  }
  return out;
}

// How many measured arms survive into a report. Six arms is one full
// run; twelve is a run plus the one before it, which is as much history
// as a comparison is worth.
export var AUTOTEST_MAX_ROWS = 12;

// The local override layer plus the on-device A/B table. Same rule as
// tuningBlock and lifeCounters: the SHAPE is the guarantee, never an
// assumption about who wrote the object -- both of these are read back
// out of browser storage, which any script on the page can write.
//
// O12 (phase-o): this used to filter VALUES only and cap nothing, while
// claiming lifeCounters' standard for itself in the comment above. Keys
// are not enum-checked here -- walk() never inspects an object key --
// but they ARE in the serialized scan reportViolations runs first
// (:130-135), so a hostile key does not leak; it makes the whole report
// unshareable instead, which is a correctness gap, not a safety one.
// lifeCounters' key regex + cap close that gap the same way it already
// closed it for `player.life` -- widened to allow the underscore every
// tuning constant name carries (BLUR_IN_FRAME, CUT_DELTA, ...), which
// lifeCounters' own key space (camelCase counters) never needed.
var TUNE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
function tuneBlock(t) {
  var out = { overrides: num(t && t.count), applied: {}, autotest: [] };
  var a = t && t.applied;
  if (a && typeof a === 'object') {
    var keys = Object.keys(a).sort();
    var n = 0, dropped = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!TUNE_KEY.test(k)) { dropped++; continue; }
      if (k.charAt(k.length - 1) === 'R') { dropped++; continue; }
      if (typeof a[k] !== 'number' || !isFinite(a[k])) { dropped++; continue; }
      if (n >= LIFE_MAX_KEYS) { dropped++; continue; }
      out.applied[k] = a[k];
      n++;
    }
    if (dropped) out.tuneDropped = dropped;
  }
  var rows = t && t.autotest;
  if (Array.isArray(rows)) {
    var keep = rows.slice(-AUTOTEST_MAX_ROWS);
    for (var i = 0; i < keep.length; i++) {
      var r = keep[i] || {};
      out.autotest.push({
        arm: num(r.arm),
        dropPct: num(r.dropPct),
        rafHz: num(r.rafHz),
        mediaSecs: num(r.mediaSecs),
        wallSecs: num(r.wallSecs),
        nativeBackend: enumOr('nativeBackend', r.nativeBackend, 'none'),
        // O10: the same three fields that told 1098's per-model table
        // apart from a bare `backend: gpu`, named after the nativeBackend
        // enum so the violation walker checks them the same way. `dead`
        // is a number by construction (pushResult already coerces it to
        // 0/1) -- a row measured with native dead is a different engine
        // and must not read like a clean one.
        nativeDead: num(r.nativeDead),
        faceBackend: enumOr('faceBackend', r.faceBackend, 'none'),
        genderBackend: enumOr('genderBackend', r.genderBackend, 'none'),
        personBackend: enumOr('personBackend', r.personBackend, 'none'),
        codec: enumOr('codec', r.codec, 'none'),
        gl: num(r.gl),
        // O5: what the row was actually measuring, alongside the drop
        // percentage -- a run that spent half its window paused or
        // backgrounded is not a clean read of the arm.
        blurOn: num(r.blurOn),
        overrides: num(r.overrides),
        paused: num(r.paused),
        mini: num(r.mini),
        hidden: num(r.hidden),
      });
    }
  }
  return out;
}

/** WHY a model is on the backend it is on (1101). `listed` is what
 * TFLite's frozen device database claimed, `tried` whether a delegate
 * was built at load, and `ran`/`agree`/`won`/`gpuMs`/`cpuMs` what the
 * post-ready trial measured. Null when the engine never reported --
 * an older build, or native never came up. -1 ms means not measured. */
/** WHY the NNAPI arm did not take this model (1105). `npu` alone is
 * one word for four different outcomes, and "lost the race fairly" is
 * not the same fact as "the delegate refused to build". Null when the
 * arm never ran or the engine predates the field. */
export function npuWhy(why, id) {
  var w = why && typeof why === 'object' ? why[id] : null;
  return typeof w === 'string' ? redactFreeText(w) : null;
}

export function gpuNote(gpu, id) {
  var g = gpu && typeof gpu === 'object' ? gpu[id] : null;
  if (!g || typeof g !== 'object') return null;
  return {
    listed: !!g.listed,
    remembered: !!g.remembered,
    tried: !!g.tried,
    ran: !!g.ran,
    agree: !!g.agree,
    won: !!g.won,
    gpuMs: num(g.gpuMs),
    cpuMs: num(g.cpuMs),
    whyR: redactFreeText(g.whyR),
  };
}

function num(x) {
  return typeof x === 'number' && isFinite(x) ? Math.round(x * 1000) / 1000 : null;
}

/** A value from a closed ENUMS set, or the fallback. */
function enumOr(key, x, fallback) {
  var allowed = ENUMS[key];
  return allowed && allowed.indexOf(x) !== -1 ? x : fallback;
}

// Version-shaped or nothing. A vendor string that does not look like a
// version is a string we cannot vouch for, and the invariant would
// reject it anyway -- better to drop it here than to fail the whole
// report over a device we have never seen.
function str(x) {
  if (typeof x !== 'string' || !x) return null;
  return VERSIONISH.test(x) ? x : null;
}

/**
 * ONE image-diagnostic read row, built the same way on both image paths.
 *
 * init-entry had two hand-written copies of this literal -- one for the
 * worker reply, one for the in-page verdict -- and they had already
 * drifted in the direction that matters least visibly: a field added to
 * fix one path leaves the other reporting the old shape, so a probe or a
 * Share reads a difference between two populations that is really a
 * difference between two literals. Same remedy as `person-gate` and
 * `crop-geometry`: one module, called from both sides.
 *
 * `n` is the descriptor magnitude, and it is here because the image null
 * guard now DECIDES on it (finding 52: junk marks read nm p50 3.44
 * against a floor of 5). R15 turned a size gate on and the artifact
 * promptly lost the very quantity it decided on; this is that lesson
 * applied before the fact rather than after.
 */
export function imgDiagRead(r, faceBox, naturalWidth) {
  return {
    g: r.gender,
    s: Math.round((r.score || 0) * 100) / 100,
    a: typeof r.age === 'number' ? Math.round(r.age) : null,
    c: typeof r.childP === 'number' ? Math.round(r.childP * 100) / 100 : null,
    // The DETECTOR's own confidence, and the native pixel size the
    // gender head actually saw. A covered thumbnail with no person in it
    // and one with a weakly-read man look identical without these two.
    k: faceBox && typeof faceBox.confidence === 'number' ? Math.round(faceBox.confidence * 100) / 100 : null,
    p: faceBox ? Math.round((faceBox.x2 - faceBox.x1) * (naturalWidth || 0)) : null,
    n: r.shape && typeof r.shape.norm === 'number' ? Math.round(r.shape.norm * 100) / 100 : null,
  };
}
