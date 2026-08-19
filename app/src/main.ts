import { invoke } from "@tauri-apps/api/core";

type Platform = {
  id: string;
  name: string;
  url: string;
  tint: string;
  ready: boolean;
};

const tiles = document.querySelector<HTMLElement>("#tiles")!;
const status = document.querySelector<HTMLElement>("#status")!;
const blurToggle = document.querySelector<HTMLElement>("#blur-toggle")!;
const blurCaption = document.querySelector<HTMLElement>("#blur-caption")!;
const bringBack = document.querySelector<HTMLElement>("#bring-back")!;
const strengthRow = document.querySelector<HTMLElement>("#blur-strength-row")!;
const strengthToggle = document.querySelector<HTMLElement>("#blur-strength")!;

// Stage B store (docs/plan.md Phase 4): three modes. Stage A only ever
// wrote "1"/"0"; migrate those forward so existing installs keep their
// choice instead of silently reverting to "off".
type GazeMode = "off" | "blur" | "smart";
const BLUR_KEY = "tamescroll.blur";

const CAPTIONS: Record<GazeMode, string> = {
  off: "",
  blur: "Blurs pictures on the pages you browse. What you open plays normally.",
  smart: "Blurs faces and keeps the rest sharp. Runs on your device — nothing leaves it.",
};

function migrate(raw: string | null): GazeMode {
  if (raw === "off" || raw === "blur" || raw === "smart") return raw;
  if (raw === "1") return "blur";
  return "off"; // "0", absent, or unrecognised
}

// Migrate once at startup so every later read is already canonical.
localStorage.setItem(BLUR_KEY, migrate(localStorage.getItem(BLUR_KEY)));

function getMode(): GazeMode {
  return migrate(localStorage.getItem(BLUR_KEY));
}

function setMode(value: GazeMode) {
  localStorage.setItem(BLUR_KEY, value);
  // Mirror into Rust: Android's single webview reads the mode from
  // there on every platform page load (the launcher's localStorage is
  // origin-locked and unreadable from platform pages).
  void invoke("set_gaze_mode", { mode: value }).catch(() => {});
  renderBlurToggle();
}

// Blur strength presets, px. Mirrors the mode's localStorage + Rust
// dance: pages read the value from Rust at injection time, so the pick
// applies to the next page load, never retroactively.
const STRENGTH_KEY = "tamescroll.blurpx";
const STRENGTHS = [8, 16, 28] as const;

function getStrength(): number {
  const px = Number(localStorage.getItem(STRENGTH_KEY));
  return (STRENGTHS as readonly number[]).includes(px) ? px : 16;
}

function setStrength(px: number) {
  localStorage.setItem(STRENGTH_KEY, String(px));
  void invoke("set_blur_strength", { px }).catch(() => {});
  renderBlurToggle();
}

function renderBlurToggle() {
  const mode = getMode();
  blurToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
    const active = btn.dataset.value === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
  blurCaption.textContent = CAPTIONS[mode];
  const px = getStrength();
  strengthRow.hidden = mode === "off";
  strengthToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
    const active = Number(btn.dataset.value) === px;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

blurToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.value as GazeMode));
});

strengthToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
  btn.addEventListener("click", () => setStrength(Number(btn.dataset.value)));
});

renderBlurToggle();
// Sync the stored mode into Rust at startup too, not just on change —
// otherwise a relaunch would leave Rust at "off" until the first toggle.
void invoke("set_gaze_mode", { mode: getMode() }).catch(() => {});
void invoke("set_blur_strength", { px: getStrength() }).catch(() => {});

// Phase 3 (docs/plan.md): per-platform "bring back" toggles — surfaces we
// hide by default, that the user can choose to show again. Defaults stay
// the fully-cleaned experience; this only ever widens what is shown,
// never narrows it further (there is no "hide more" here).
type SurfaceInfo = { id: string; label: string };

const SHOWN_KEY = "tamescroll.shown";

function readShownMap(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getShown(platformId: string): string[] {
  const shown = readShownMap()[platformId];
  return Array.isArray(shown) ? shown : [];
}

function setShown(platformId: string, shown: string[]) {
  const map = readShownMap();
  map[platformId] = shown;
  localStorage.setItem(SHOWN_KEY, JSON.stringify(map));
}

// One Hidden/Shown pill row per surface — same pattern as the blur
// toggle above, just two options instead of three and one row per
// surface instead of one shared control.
function surfaceRow(platformId: string, surface: SurfaceInfo): HTMLElement {
  const row = document.createElement("div");
  row.className = "setting-row";

  const label = document.createElement("span");
  label.className = "setting-label";
  label.textContent = surface.label;

  const toggle = document.createElement("div");
  toggle.className = "toggle";
  toggle.setAttribute("role", "radiogroup");
  toggle.setAttribute("aria-label", surface.label);

  const paint = () => {
    const isShown = getShown(platformId).includes(surface.id);
    toggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
      const active = (btn.dataset.value === "shown") === isShown;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", String(active));
    });
  };

  (["hidden", "shown"] as const).forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toggle-opt";
    btn.setAttribute("role", "radio");
    btn.dataset.value = value;
    btn.textContent = value === "hidden" ? "Hidden" : "Shown";
    btn.addEventListener("click", () => {
      const current = getShown(platformId).filter((id) => id !== surface.id);
      setShown(platformId, value === "shown" ? [...current, surface.id] : current);
      paint();
    });
    toggle.append(btn);
  });

  paint();
  row.append(label, toggle);
  return row;
}

async function renderBringBack(readyPlatforms: Platform[]) {
  for (const platform of readyPlatforms) {
    try {
      const surfaces = await invoke<SurfaceInfo[]>("surfaces", { id: platform.id });
      if (surfaces.length === 0) continue;

      const details = document.createElement("details");
      details.className = "platform-settings";
      const summary = document.createElement("summary");
      summary.textContent = platform.name;
      details.append(summary);
      surfaces.forEach((surface) => details.append(surfaceRow(platform.id, surface)));
      bringBack.append(details);
    } catch {
      // One platform's toggles failing to load must not block the rest
      // of the launcher — the tiles above already work without this.
    }
  }
}

// Chosen platforms (owner decision 2026-08-19): a launcher that shows
// every platform is itself a temptation surface — a hub. So the grid
// only ever shows platforms the user explicitly brought in. Key absent
// = first run → onboarding picker. Adding later is an explicit act in
// "Manage platforms", the same philosophy as Bring back: defaults
// minimal, loosening deliberate. A home-screen shortcut for an
// un-chosen platform counts as its own explicit choice (the user
// created that icon) and adds the platform.
const CHOSEN_KEY = "tamescroll.chosen";

function readChosen(): string[] | null {
  const raw = localStorage.getItem(CHOSEN_KEY);
  if (raw === null) return null; // onboarding not done yet
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeChosen(ids: string[]) {
  localStorage.setItem(CHOSEN_KEY, JSON.stringify(ids));
}

function tile(platform: Platform): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = "tile";
  el.style.setProperty("--tint", platform.tint);
  el.disabled = !platform.ready;

  const dot = document.createElement("span");
  dot.className = "dot";
  dot.textContent = platform.name.charAt(0);

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = platform.name;

  const note = document.createElement("span");
  note.className = "note";
  note.textContent = platform.ready ? "Cleaned" : "Not ready yet";

  el.append(dot, name, note);

  if (platform.ready) {
    el.addEventListener("click", () => {
      void open(platform);
    });
  }

  return el;
}

// The status line's resting text ("N rules active") — kept so opening a
// platform can clear an error without wiping the rules count for good.
let restingStatus = "";

async function open(platform: Platform) {
  try {
    await invoke("open_platform", {
      strength: getStrength(),
      id: platform.id,
      mode: getMode(),
      shown: getShown(platform.id),
    });
    status.textContent = restingStatus;
  } catch (error) {
    status.textContent = `Could not open ${platform.name}: ${String(error)}`;
  }
}

// On Android cold start this module can run before the Rust side has
// finished registering the webview, and the first invoke dies with an
// ACL error ("platforms not allowed. Plugin not found") — seen
// intermittently on emulator cold boots (probe19, 2026-08-19). The
// window is tens of milliseconds wide, so a short bounded retry rides
// it out; a real failure still surfaces after the last attempt.
async function invokeStartup<T>(cmd: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await invoke<T>(cmd);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

function renderTiles(platforms: Platform[], chosen: string[]) {
  tiles.textContent = "";
  platforms
    .filter((p) => chosen.includes(p.id))
    .forEach((platform) => tiles.append(tile(platform)));
  if (!tiles.childElementCount) {
    const empty = document.createElement("p");
    empty.className = "section-hint";
    empty.textContent = "No platforms added. Bring one in below when you need it.";
    tiles.append(empty);
  }
}

// "Manage platforms": every platform as an In/Out row. Out is the
// default state of the world; In is the explicit act.
function renderManage(platforms: Platform[], onChange: (chosen: string[]) => void) {
  const host = document.querySelector<HTMLElement>("#manage-platforms")!;
  host.textContent = "";
  const details = document.createElement("details");
  details.className = "platform-settings";
  const summary = document.createElement("summary");
  summary.textContent = "Manage platforms";
  details.append(summary);

  platforms.forEach((platform) => {
    const row = document.createElement("div");
    row.className = "setting-row";
    const label = document.createElement("span");
    label.className = "setting-label";
    label.textContent = platform.ready ? platform.name : `${platform.name} (not ready yet)`;
    const toggle = document.createElement("div");
    toggle.className = "toggle";
    const paint = () => {
      const inNow = (readChosen() ?? []).includes(platform.id);
      toggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
        btn.classList.toggle("active", (btn.dataset.value === "in") === inNow);
      });
    };
    (["out", "in"] as const).forEach((value) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-opt";
      btn.dataset.value = value;
      btn.textContent = value === "in" ? "In" : "Out";
      btn.disabled = !platform.ready;
      btn.addEventListener("click", () => {
        const current = (readChosen() ?? []).filter((id) => id !== platform.id);
        const next = value === "in" ? [...current, platform.id] : current;
        writeChosen(next);
        paint();
        onChange(next);
      });
      toggle.append(btn);
    });
    paint();
    row.append(label, toggle);
    details.append(row);
  });
  host.append(details);
}

// First-run picker: same tiles, but a tap selects instead of opening.
// Skippable — an empty launcher is a valid, honest starting point.
function renderOnboarding(platforms: Platform[], done: (chosen: string[]) => void) {
  tiles.textContent = "";
  const prompt = document.createElement("p");
  prompt.className = "section-hint";
  prompt.textContent =
    "Which of these do you already use? Only what you pick shows up here — you can change it any time.";
  tiles.append(prompt);

  const selection = new Set<string>();
  const grid = document.createElement("div");
  grid.className = "tiles";
  platforms
    .filter((p) => p.ready)
    .forEach((platform) => {
      const el = tile(platform);
      const fresh = el.cloneNode(true) as HTMLButtonElement; // drop open() listener
      fresh.addEventListener("click", () => {
        const on = selection.has(platform.id);
        if (on) selection.delete(platform.id);
        else selection.add(platform.id);
        fresh.classList.toggle("selected", !on);
        paintCta();
      });
      grid.append(fresh);
    });
  tiles.append(grid);

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "onboard-cta";
  // Say what the button will do — "Start" over an empty selection
  // silently produced an empty launcher (probe33 finding).
  const paintCta = () => {
    cta.textContent = selection.size
      ? `Start with ${selection.size} platform${selection.size === 1 ? "" : "s"}`
      : "Start with none — add later";
  };
  paintCta();
  cta.addEventListener("click", () => {
    const chosen = Array.from(selection);
    writeChosen(chosen);
    done(chosen);
  });
  tiles.append(cta);
}

async function start() {
  try {
    const platforms = await invokeStartup<Platform[]>("platforms");

    const refresh = (chosen: string[]) => {
      renderTiles(platforms, chosen);
      bringBack.textContent = "";
      void renderBringBack(platforms.filter((p) => p.ready && chosen.includes(p.id)));
    };

    const chosen = readChosen();
    renderManage(platforms, refresh);
    if (chosen === null) {
      renderOnboarding(platforms, refresh);
    } else {
      refresh(chosen);
    }

    const counts = await invoke<Record<string, number>>("rules_summary");
    const active = Object.values(counts).reduce((sum, n) => sum + n, 0);
    restingStatus = `${active} rules active`;
    status.textContent = restingStatus;

    // Home-screen shortcut launch (Android). Cold start: MainActivity
    // can't win the URL race against wry's initial load, so the pending
    // platform is PULLED from a one-shot JavascriptInterface bridge.
    // Warm start (onNewIntent) navigates here with ?open=<id> instead.
    // Either way this page's mode/prefs sync ran first, so a shortcut
    // behaves exactly like a tile tap.
    const bridge = (window as unknown as { TsShortcuts?: { consume(): string } })
      .TsShortcuts;
    let requested = "";
    try {
      requested = bridge?.consume() ?? "";
    } catch {
      // bridge absent (desktop) or blocked — fall through to the param
    }
    if (!requested) {
      requested = new URLSearchParams(location.search).get("open") ?? "";
    }
    if (requested) {
      history.replaceState(null, "", location.pathname);
      const target = platforms.find((p) => p.id === requested && p.ready);
      if (target) {
        // The user created this platform's home-screen icon — that is
        // an explicit choice, so it also brings the platform in.
        const current = readChosen() ?? [];
        if (!current.includes(target.id)) {
          writeChosen([...current, target.id]);
          refresh(readChosen() ?? []);
        }
        void open(target);
      }
    }
  } catch (error) {
    status.textContent = `Failed to load: ${String(error)}`;
  }
}

void start();
