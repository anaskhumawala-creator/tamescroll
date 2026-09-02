"""Event-level probe for the three owner reports of 2026-09-02 evening:
"linus still gets covered sometimes", "some random patches", and "the
opposite gender visible for less than a second".

    python probe_events.py <cdpPort> <label> [secs] [videoId] [seekTo]

Joins, per rAF frame, on the device (the Redmi over CDP, nothing on the
owner's desktop):
  - presented media time + latest timeline snapshot media time + `late`
  - every visible player patch normalized to the video rect
  - the reads ring (gender, score, raw, abstained, face box) tagged with
    the media time of the pass that produced it
  - the per-pass track ring (id, state, streaks, missMs, fromFace, box)
    tagged the same way
  - life counter deltas, and the media time of every cut
Then classifies offline:
  EXPOSURE  a track born BLURRED at m0: presented frames in
            (m_prev, m0) with no patch over its birth box, split by
            late (no B yet), cutOmitted, other; plus births whose
            subject was already READ (female / abstained) at m_prev.
  FALSECOVER a confident same-gender (male, man mode) read whose face
            centre sits under a presented patch, split by the covering
            track's state: pendingClear (born blurred, streak short),
            revoked (flagStreak), otherTrack (a different track's box,
            e.g. a synthetic body), unknown.
  PHANTOM   blurred tracks that missed this pass (missMs > 0), their
            coast time, and abstained reads.
Banks events-<label>.json beside this file.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
LABEL = sys.argv[2] if len(sys.argv) > 2 else "unlabelled"
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 180.0
VIDEO = sys.argv[4] if len(sys.argv) > 4 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[5]) if len(sys.argv) > 5 else 55.0
GENDER = os.environ.get("TS_GENDER", "man")
HERE = os.path.dirname(os.path.abspath(__file__))

COLLECT_JS = r"""(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  if(v){ try{ v.muted=true; v.currentTime=%f; v.play(); }catch(e){} }
  var st=window.__TS_EV={frames:[],reads:[],tracks:[],cuts:[],life0:null,stop:0,raf:0};
  var lastR=null, lastT=null, lastLife={};
  var LIFE=['cutDetected','passDropped','nullDropped','nullMintedHeld','delayVerdictLate','birthFresh','birthContended','birthNearMiss','coastExpired','wipeErased','wipeErasedBlurred','personPassSkipped','positionPassSkipped','genderReadSkipped','readAbstain','readClearCertain','readUncertain','bodyClampFired','faceNoShape','memClear','memHit','memMiss','memStore','memInstant','birthCleared','birthBlurred','nullMatched','cutCoastExpired'];
  function vis(){
    var vr=v?v.getBoundingClientRect():null; var out=[];
    if(!vr||vr.width<1||vr.height<1) return out;
    var nodes=document.querySelectorAll('.ts-gaze-vregion-clip > *');
    for(var i=0;i<nodes.length;i++){ var n=nodes[i]; if(getComputedStyle(n).display==='none') continue;
      var r=n.getBoundingClientRect(); if(r.width<1||r.height<1) continue;
      out.push([ (r.left-vr.left)/vr.width,(r.top-vr.top)/vr.height,(r.right-vr.left)/vr.width,(r.bottom-vr.top)/vr.height ].map(function(x){return Math.round(x*1000)/1000;})); }
    return out;
  }
  (function loop(){
    if(st.stop) return; st.raf++;
    try{
      var now=Math.round(performance.now());
      var d=window.__TS_GAZE_IDS||{};
      var ds=null; try{ ds=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null; }catch(e){}
      var pm=ds&&ds.presentedMediaTime!=null?Math.round(ds.presentedMediaTime*1000)/1000:null;
      var lm=ds&&ds.snapshots?Math.round(ds.snapshots.mediaTime*1000)/1000:null;
      var late=ds&&ds.stats?ds.stats.late:null;
      var vt=v?Math.round(v.currentTime*1000)/1000:null;
      var lf=d.life||{};
      if(!st.life0){ st.life0={}; for(var q=0;q<LIFE.length;q++){ st.life0[LIFE[q]]=lf[LIFE[q]]||0; lastLife[LIFE[q]]=lf[LIFE[q]]||0; } }
      if((lf.cutDetected||0)>(lastLife.cutDetected||0)){ st.cuts.push({ms:now,vt:vt,n:(lf.cutDetected||0)-(lastLife.cutDetected||0)}); lastLife.cutDetected=lf.cutDetected||0; }
      st.frames.push({ms:now,vt:vt,pm:pm,lm:lm,late:late,p:vis()});
      // BOTH RINGS ARE CAPPED (reads shift() at 300, tracks slice(-200)),
      // so a length watermark stops seeing new entries once the ring is
      // full -- the first run of this probe recorded exactly 200 track
      // snapshots and then went blind for the last 30s. New entries are
      // whatever follows the last OBJECT seen (identity, not index).
      var r=d.reads||[];
      var ri=lastR?r.lastIndexOf(lastR):-1;
      if(r.length){ for(var i=ri+1;i<r.length;i++){ var e=r[i]||{}; st.reads.push({ms:now,lm:lm,vt:vt,g:e.g,s:e.s,v:e.v,ab:e.ab,px:e.px,fc:e.fc,b:e.b,nm:e.nm,a:e.a,pc:e.pc}); } lastR=r[r.length-1]; }
      var tk=d.tracks||[];
      var ti=lastT?tk.lastIndexOf(lastT):-1;
      if(tk.length){ for(var j=ti+1;j<tk.length;j++){ var snap=tk[j]||[];
          st.tracks.push({ms:now,lm:lm,vt:vt,tr:snap.map(function(x){return {id:x.id,st:x.st,cs:x.cs,fs:x.fs,cm:x.cm,lv:x.lv,mm:x.mm,f:x.f,b:x.b,as:x.as,co:x.co,cf:x.cf,hf:x.hf};})}); }
        lastT=tk[tk.length-1]; }
      var rs=null; try{ rs=window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null; }catch(e){}
      st.frames[st.frames.length-1].tf=rs?rs.timelineFallback:null;
    }catch(e){ st.err=(st.err||0)+1; }
    requestAnimationFrame(loop);
  })();
  return JSON.stringify({t:v?Math.round(v.currentTime):null,bundle:window.__TS_GAZE_BUNDLE__});
})()"""

DUMP_JS = r"""(function(){
  var st=window.__TS_EV||{}; st.stop=1;
  var d=window.__TS_GAZE_IDS||{}; var lf=d.life||{}; var delta={};
  for(var k in (st.life0||{})) delta[k]=(lf[k]||0)-st.life0[k];
  var nat=window.__TS_GAZE_NATIVE||{};
  var dm=null; try{ dm=(window.__TS_DELAY_STATS&&window.__TS_DELAY_STATS()||{}).delayMs; }catch(e){}
  return JSON.stringify({frames:st.frames,reads:st.reads,tracks:st.tracks,cuts:st.cuts,lifeDelta:delta,raf:st.raf,err:st.err||0,
    gender:window.__TS_GAZE_GENDER,delayMs:dm,nativeDead:nat.dead,slots:(d.slots||[]).map(function(s){return s.n;})});
})()"""


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round((len(xs) - 1) * p)))]


def iou(a, b):
    ix1, iy1, ix2, iy2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def contains(p, box):
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    return p[0] - 0.01 <= cx <= p[2] + 0.01 and p[1] - 0.01 <= cy <= p[3] + 0.01


def covered_by(frame, box, iou_min=0.3):
    for p in frame.get("p", []):
        if iou(p, box) >= iou_min or contains(p, box):
            return True
    return False


def classify(d, gender):
    frames = [f for f in d["frames"] if f.get("pm") is not None]
    frames.sort(key=lambda f: f["ms"])
    snaps = [s for s in d["tracks"] if s.get("lm") is not None]
    reads = d["reads"]
    cuts = [c["vt"] for c in d["cuts"] if c.get("vt") is not None]
    same = "male" if gender == "man" else "female"

    # ---- EXPOSURE: births at m0, frames in (m_prev, m0) uncovered ----
    seen = set()
    births = []
    for i, s in enumerate(snaps):
        for t in s["tr"]:
            if t["id"] not in seen and t["st"] == "blurred" and t.get("b"):
                births.append({"id": t["id"], "m0": s["lm"], "box": t["b"], "i": i, "f": t.get("f"), "lv": t.get("lv")})
        seen |= set(t["id"] for t in s["tr"])
    exp_rows = []
    for b in births:
        prev = snaps[b["i"] - 1]["lm"] if b["i"] > 0 else None
        if prev is None or prev >= b["m0"]:
            continue
        win = [f for f in frames if prev < f["pm"] < b["m0"]]
        unc = [f for f in win if not covered_by(f, b["box"])]
        late = sum(1 for f in unc if f.get("lm") is not None and f["lm"] < f["pm"])
        cutom = sum(1 for f in unc if any(f["pm"] < c <= b["m0"] for c in cuts))
        pr = [r for r in reads if r.get("lm") == prev and r.get("b") and iou(r["b"], b["box"]) > 0.05]
        earlier = None
        if pr:
            earlier = {"g": pr[0].get("g"), "s": pr[0].get("s"), "ab": pr[0].get("ab"), "v": pr[0].get("v"), "nm": pr[0].get("nm")}
        exp_rows.append({"id": b["id"], "m0": b["m0"], "prev": prev, "gapMs": round((b["m0"] - prev) * 1000), "f": b["f"], "lv": b["lv"],
                         "framesInWindow": len(win), "uncovered": len(unc), "late": late, "cutOmitted": cutom,
                         "other": len(unc) - late - cutom, "readAtPrev": earlier})
    exp_bad = [r for r in exp_rows if r["uncovered"] > 0]
    late_frames = sum(1 for f in frames if f.get("lm") is not None and f["lm"] < f["pm"])

    # ---- FALSE COVER: confident same-gender read under a patch ----
    fc_rows = []
    for r in reads:
        if r.get("g") != same or r.get("ab") or r.get("s") is None or r["s"] < 0.45 or not r.get("b"):
            continue
        m = r.get("lm")
        if m is None:
            continue
        near = [f for f in frames if abs(f["pm"] - m) <= 0.25]
        if not near:
            continue
        cov = [f for f in near if any(contains(p, r["b"]) for p in f["p"])]
        if not cov:
            continue
        snap = next((s for s in snaps if s["lm"] == m), None)
        why = "unknown"
        info = None
        if snap:
            own = [t for t in snap["tr"] if t.get("b") and contains(t["b"], r["b"])]
            bl = [t for t in own if t["st"] == "blurred"]
            if bl:
                t = bl[0]
                info = {"id": t["id"], "cs": t["cs"], "fs": t["fs"], "cm": t["cm"], "lv": t["lv"], "f": t["f"], "as": t.get("as")}
                if t["fs"] and t["fs"] > 0:
                    why = "revoked"
                elif (t["cs"] or 0) < 2 and (t["cm"] or 0) < 1500:
                    why = "pendingClear"
                elif len(own) > 1:
                    why = "otherTrack"
                else:
                    why = "blurredDespiteClear"
            elif own:
                why = "timelineOnly"
                info = {"id": own[0]["id"], "st": own[0]["st"]}
            else:
                why = "noTrackContainsFace"
        fc_rows.append({"m": m, "s": r["s"], "v": r.get("v"), "px": r.get("px"), "coveredFrames": len(cov), "nearFrames": len(near), "why": why, "track": info})
    same_reads = [r for r in reads if r.get("g") == same and not r.get("ab") and (r.get("s") or 0) >= 0.45]

    # ---- PHANTOM ----
    coast = 0
    blurredTrackPasses = 0
    coastMs = []
    for s in snaps:
        for t in s["tr"]:
            if t["st"] != "blurred":
                continue
            blurredTrackPasses += 1
            if (t.get("mm") or 0) > 0:
                coast += 1
                coastMs.append(t["mm"])
    ab_reads = [r for r in reads if r.get("ab")]
    frames_with_patch = sum(1 for f in frames if f["p"])

    return {
        "frames": len(frames), "framesWithPatch": frames_with_patch, "lateFrames": late_frames,
        "snapshots": len(snaps), "reads": len(reads), "cuts": len(cuts),
        "exposure": {"births": len(exp_rows), "birthsWithUncoveredFrames": len(exp_bad),
                     "uncoveredFramesTotal": sum(r["uncovered"] for r in exp_rows),
                     "late": sum(r["late"] for r in exp_rows), "cutOmitted": sum(r["cutOmitted"] for r in exp_rows),
                     "other": sum(r["other"] for r in exp_rows),
                     "readAtPrevRefused": sum(1 for r in exp_rows if r["readAtPrev"]),
                     "rows": exp_bad[:40]},
        "falseCover": {"sameGenderConfidentReads": len(same_reads), "coveredReads": len(fc_rows),
                       "why": {k: sum(1 for r in fc_rows if r["why"] == k) for k in set(r["why"] for r in fc_rows)},
                       "rows": fc_rows[:40]},
        "phantom": {"blurredTrackPasses": blurredTrackPasses, "coastingPasses": coast,
                    "coastMsP50": pct(coastMs, 0.5), "coastMsP95": pct(coastMs, 0.95), "coastMsMax": max(coastMs) if coastMs else None,
                    "abstainedReads": len(ab_reads)},
        "lifeDelta": d.get("lifeDelta"), "slots": d.get("slots"), "nativeDead": d.get("nativeDead"), "delayMs": d.get("delayMs"),
    }


def main():
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    if "tauri.localhost" not in (t.eval("location.href") or ""):
        t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
        t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',shown:['watch_recs']}); return 1;})()""" % GENDER)
    time.sleep(7)
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VIDEO)
    time.sleep(30)
    t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
    print("ARM", t.eval(COLLECT_JS % SEEK))
    time.sleep(SECS)
    raw = t.eval(DUMP_JS)
    d = json.loads(raw) if isinstance(raw, str) else raw
    out = classify(d, d.get("gender") or GENDER)
    name = os.path.join(HERE, "events-%s.json" % LABEL)
    with open(name, "w") as f:
        json.dump({"label": LABEL, "video": VIDEO, "seek": SEEK, "secs": SECS, "summary": out, "raw": d}, f)
    s = dict(out); s.pop("exposure"); s.pop("falseCover")
    print("SUMMARY", json.dumps(s))
    e = dict(out["exposure"]); rows = e.pop("rows"); print("EXPOSURE", json.dumps(e))
    for r in rows:
        print("  X", json.dumps(r))
    fc = dict(out["falseCover"]); rows = fc.pop("rows"); print("FALSECOVER", json.dumps(fc))
    for r in rows:
        print("  F", json.dumps(r))
    print("banked", name)


if __name__ == "__main__":
    main()
