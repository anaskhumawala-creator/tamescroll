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
var KEEP = { images: 40, stages: 40, slots: 12, reads: 60 };

/**
 * Build one report from a raw snapshot of the in-page diagnostics.
 *
 * PURE: everything it needs is in `snap`, so the whole redaction story
 * is testable without a DOM, a device, or a running pipeline.
 */
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
      life: {
        emptyFrame: num(life.emptyFrame),
        wipeErased: num(life.wipeErased),
        wipeErasedTracks: num(life.wipeErasedTracks),
        wipeErasedBlurred: num(life.wipeErasedBlurred),
        faceNoShape: num(life.faceNoShape),
        bodyFromSlot: num(life.bodyFromSlot),
      },
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
    render: s.render
      ? {
          raf: num(s.render.raf),
          overlayFrames: num(s.render.overlayFrames),
          maskWrites: num(s.render.maskWrites),
          tfWrites: num(s.render.tfWrites),
          sizeWrites: num(s.render.sizeWrites),
          dispWrites: num(s.render.dispWrites),
        }
      : null,
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

function pluck(rows, key) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (typeof rows[i][key] === 'number') out.push(rows[i][key]);
  }
  return out;
}

function num(x) {
  return typeof x === 'number' && isFinite(x) ? Math.round(x * 1000) / 1000 : null;
}

// Version-shaped or nothing. A vendor string that does not look like a
// version is a string we cannot vouch for, and the invariant would
// reject it anyway -- better to drop it here than to fail the whole
// report over a device we have never seen.
function str(x) {
  if (typeof x !== 'string' || !x) return null;
  return VERSIONISH.test(x) ? x : null;
}
