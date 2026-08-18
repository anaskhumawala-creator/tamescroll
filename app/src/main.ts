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
}

blurToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.value as GazeMode));
});

renderBlurToggle();

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
      id: platform.id,
      mode: getMode(),
      shown: getShown(platform.id),
    });
    status.textContent = restingStatus;
  } catch (error) {
    status.textContent = `Could not open ${platform.name}: ${String(error)}`;
  }
}

async function start() {
  try {
    const platforms = await invoke<Platform[]>("platforms");
    platforms.forEach((platform) => tiles.append(tile(platform)));
    void renderBringBack(platforms.filter((p) => p.ready));

    const counts = await invoke<Record<string, number>>("rules_summary");
    const active = Object.values(counts).reduce((sum, n) => sum + n, 0);
    restingStatus = `${active} rules active`;
    status.textContent = restingStatus;
  } catch (error) {
    status.textContent = `Failed to load: ${String(error)}`;
  }
}

void start();
