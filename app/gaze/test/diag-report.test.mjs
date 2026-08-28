// The diagnostics report exists to leave the device. These tests are the
// reason that is allowed to be true.
//
// The premise of tamescroll is that nothing about what you watch goes
// anywhere. The in-page diagnostics rings were written for a desktop
// debugger and they carry thumbnail URLs and raw error messages; a
// report built from them naively would carry the exact video the owner
// was watching. So the safety here is a walker over the serialized
// report, and these tests are what make it real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../src/diag-report.mjs';

const HREF = 'https://m.youtube.com/watch?v=NWoT1ZVd1Lo&pp=ygUFbGludXM';

// A snapshot shaped like the real globals, with every field that has
// ever carried a url set to something that does.
function snap(over = {}) {
  return {
    id: 'ab12cd34ef567890',
    t: 1756360000,
    versionCode: 1036,
    versionName: '0.1.36',
    os: 'android',
    osVersion: '12',
    model: 'Redmi 10',
    webview: '126.0.6478.122',
    cores: 8,
    dpr: 2.75,
    vw: 393,
    vh: 851,
    platform: 'youtube',
    kind: 'watch',
    gazeMode: 'smart',
    gender: 'man',
    blurPx: 24,
    ageMs: 184211,
    rulesGen: 'ab12cd34',
    otaLast: 'ok',
    otaAgeH: 3,
    activeRules: 8564,
    cssBytes: 35484,
    seen: 1180,
    blocked: 41,
    evalMs: 2210,
    timing: { face: 900, faceAt: 3100, gender: 1400, genderAt: 4500, person: 4100 },
    worker: {
      up: 812,
      ready: 5210,
      backend: 'webgl',
      'loaded:face': 3300,
      'loaded:gender': 4900,
      'loaded:person': 6100,
    },
    imgTotal: 63,
    imgdiag: [
      {
        t: 42100,
        ms: 61,
        w: 320,
        where: 'worker',
        why: 'face',
        faces: 1,
        flagged: 1,
        src: 'https://i.ytimg.com/vi/NWoT1ZVd1Lo/hqdefault.jpg?sqp=-oaymwE',
      },
      { t: 42400, ms: 55, w: 320, where: 'worker', why: 'clear', faces: 0, flagged: 0 },
    ],
    playerAttached: true,
    ids: {
      stages: [
        { upload: 4, persons: 21, end: 51, v: 1 },
        { upload: 3, persons: 19, end: 24, v: 0 },
      ],
      passFails: 1,
      timeouts: 0,
      luma: [1, 2, 4, 30, 90, 200, 2, 1],
      slots: [{ n: 2, hd: 0, ha: 0 }],
      reads: [{ g: 'male', s: 0.81, a: 33, pc: 0.02, v: 0.812, px: 210 }],
    },
    render: { raf: 5400, overlayFrames: 802, maskWrites: 12, tfWrites: 640 },
    longTasks: 12,
    longTaskMaxMs: 890,
    ...over,
  };
}

test('a report built from real-shaped diagnostics may leave the device', () => {
  const r = d.buildReport(snap());
  assert.deepEqual(d.reportViolations(r, HREF), []);
});

test('the thumbnail url is dropped, not redacted', () => {
  // `src` identifies the exact video. There is no redacted form of it
  // that is worth keeping, so it does not survive the build at all.
  const r = d.buildReport(snap());
  assert.equal('src' in r.images.ring[0], false);
  assert.equal(JSON.stringify(r).includes('ytimg'), false);
  assert.equal(JSON.stringify(r).includes('NWoT1ZVd1Lo'), false);
});

test('an error message carrying a url is scrubbed before it is kept', () => {
  const s = snap();
  s.worker.why = 'failed to fetch https://i.ytimg.com/vi/NWoT1ZVd1Lo/hq.jpg?sqp=x';
  s.ids.lastFail = 'person pass: NetworkError at m.youtube.com/watch';
  const r = d.buildReport(s);
  assert.deepEqual(d.reportViolations(r, HREF), []);
  assert.ok(r.worker.whyR.includes('failed to fetch'));
  assert.equal(r.worker.whyR.includes('ytimg'), false);
  assert.equal(r.player.lastFailR.includes('youtube.com'), false);
});

test('the walker CATCHES a field someone forgets to redact', () => {
  // The whole point: this is not a code review, it is a gate. A future
  // field added straight from a global fails here rather than shipping.
  const r = d.buildReport(snap());
  r.player.note = 'watching https://m.youtube.com/watch?v=NWoT1ZVd1Lo';
  const bad = d.reportViolations(r, HREF);
  assert.ok(bad.length > 0);
  assert.ok(bad.some((b) => b.includes('scheme') || b.includes('free text')));
});

test('a run of the page url anywhere in the report is caught', () => {
  const r = d.buildReport(snap());
  r.page.kindR = 'NWoT1ZVd1Lo';
  assert.ok(d.reportViolations(r, HREF).some((b) => b.includes('location.href')));
});

test('a string outside its enum is caught, and the platform name is not', () => {
  const r = d.buildReport(snap());
  assert.deepEqual(d.reportViolations(r, HREF), []);
  r.page.platform = 'youtube-premium';
  assert.ok(d.reportViolations(r, HREF).some((b) => b.includes('not in its enum')));
});

test('the luma series ships as bins, never as a series', () => {
  // A 10Hz luma-delta series is a shot-boundary signature of the actual
  // footage. Counts answer "how much cutting is in this" and nothing
  // else.
  const r = d.buildReport(snap());
  assert.equal(Array.isArray(r.player.lumaHist), true);
  assert.equal(r.player.lumaHist.length, 6);
  assert.equal(
    r.player.lumaHist.reduce((a, b) => a + b, 0),
    8
  );
  assert.equal(JSON.stringify(r).includes('200'), false);
});

test('redactFreeText strips schemes, hosts and query syntax', () => {
  assert.equal(d.redactFreeText('see https://a.b/c?d=e now'), 'see <url> now');
  assert.equal(d.redactFreeText('host was cdn.example.org here'), 'host was <host> here');
  assert.equal(d.redactFreeText('a=b&c=d'), 'a b c d');
  assert.equal(d.redactFreeText(''), null);
  assert.equal(d.redactFreeText(undefined), null);
  assert.ok(d.redactFreeText('x'.repeat(200)).length <= 80);
});

test('pageKind describes the shape of a path, never the path', () => {
  assert.equal(d.pageKind('youtube', '/watch?v=NWoT1ZVd1Lo'), 'watch');
  assert.equal(d.pageKind('youtube', '/results?search_query=linus'), 'search');
  assert.equal(d.pageKind('youtube', '/@LinusTechTips'), 'channel');
  assert.equal(d.pageKind('youtube', '/'), 'home');
  assert.equal(d.pageKind('reddit', '/r/pics/comments/abc/title'), 'post');
  assert.equal(d.pageKind('reddit', '/r/pics'), 'feed');
});

test('platformOf names the platform without keeping the host', () => {
  assert.equal(d.platformOf('m.youtube.com'), 'youtube');
  assert.equal(d.platformOf('www.reddit.com'), 'reddit');
  assert.equal(d.platformOf('x.com'), 'x');
  assert.equal(d.platformOf('www.instagram.com'), 'instagram');
  assert.equal(d.platformOf('example.net'), 'other');
});

test('the engine block can tell "not wired" from "nothing matched"', () => {
  // The 2026-08-25 finding was that network blocking had NEVER been
  // wired, and it was invisible for weeks because the emulator was never
  // served an ad. `seen` is the field that would have said so in one
  // screenshot.
  const notWired = d.buildReport(snap({ seen: 0, blocked: 0 }));
  assert.equal(notWired.engine.seen, 0);
  const wiredNothingMatched = d.buildReport(snap({ seen: 1180, blocked: 0 }));
  assert.equal(wiredNothingMatched.engine.seen, 1180);
  assert.equal(wiredNothingMatched.engine.blocked, 0);
  const working = d.buildReport(snap());
  assert.equal(working.engine.blocked, 41);
  // And the rules generation travels, so two devices are comparable.
  assert.equal(working.engine.rulesGen, 'ab12cd34');
  assert.deepEqual(d.reportViolations(working, HREF), []);
});

test('gaps are the "it halts" number, and they come from the ring', () => {
  const s = snap();
  s.imgdiag = [{ t: 0 }, { t: 100 }, { t: 120 }, { t: 3000 }];
  const r = d.buildReport(s);
  assert.equal(r.images.gapsP50, 100);
  assert.equal(r.images.gapsP95, 2880);
});

test('a missing or empty snapshot still produces a valid report', () => {
  // Diagnostics run on every page including ones where the pipeline
  // never booted. A report that throws is a report that hides the very
  // failure it was meant to describe.
  const r = d.buildReport(undefined);
  assert.deepEqual(d.reportViolations(r, HREF), []);
  assert.equal(r.v, 1);
});
