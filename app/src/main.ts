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

async function open(platform: Platform) {
  try {
    await invoke("open_platform", { id: platform.id, mode: getMode() });
    status.textContent = "";
  } catch (error) {
    status.textContent = `Could not open ${platform.name}: ${String(error)}`;
  }
}

async function start() {
  try {
    const platforms = await invoke<Platform[]>("platforms");
    platforms.forEach((platform) => tiles.append(tile(platform)));

    const counts = await invoke<Record<string, number>>("rules_summary");
    const active = Object.values(counts).reduce((sum, n) => sum + n, 0);
    status.textContent = `${active} rules active`;
  } catch (error) {
    status.textContent = `Failed to load: ${String(error)}`;
  }
}

void start();
