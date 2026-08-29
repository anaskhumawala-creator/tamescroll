from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
print(tab.eval(r"""JSON.stringify({
  url:location.href, mode:window.__TS_GAZE_MODE,
  bundle:window.__TS_GAZE_BUNDLE__, evalMs:window.__TS_GAZE_EVALMS,
  total:window.__TS_GAZE_IMGTOTAL||0, ring:(window.__TS_GAZE_IMGDIAG||[]).length,
  boot:window.__TS_GAZE_BOOT||null,
  wrk:(function(){var w=window.__TS_GAZE_WORKER||{};return {dead:!!w.dead,ready:!!w.ready,
    backend:w.backend||null,up:w.up||null,ms:w.ms||null,readyAt:w.ready||null};})(),
  pending:document.querySelectorAll('.ts-gaze-pending').length,
  flagged:document.querySelectorAll('.ts-gaze-flagged').length,
  prestartRan:window.__TS_PRESTART_RAN||0, hint:window.__TS_PRESTART_HINT||null,
  models:!!window.__TS_GAZE_MODELS})"""))
