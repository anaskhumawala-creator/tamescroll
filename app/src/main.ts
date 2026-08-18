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

// Stage A store (docs/plan.md Phase 4 Stage A): localStorage is enough for
// a single on/off setting. Stage B's three-mode picker replaces this key.
const BLUR_KEY = "tamescroll.blur";

function getBlur(): boolean {
  return localStorage.getItem(BLUR_KEY) === "1";
}

function setBlur(value: boolean) {
  localStorage.setItem(BLUR_KEY, value ? "1" : "0");
  renderBlurToggle();
}

function renderBlurToggle() {
  const on = getBlur();
  blurToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
    const active = btn.dataset.value === (on ? "1" : "0");
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

blurToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
  btn.addEventListener("click", () => setBlur(btn.dataset.value === "1"));
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
    await invoke("open_platform", { id: platform.id, blur: getBlur() });
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
