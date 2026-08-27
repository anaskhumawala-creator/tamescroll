import { invoke } from "@tauri-apps/api/core";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/500.css";
import "./styles.css";

type Platform = {
  id: string;
  name: string;
  url: string;
  tint: string;
  ready: boolean;
};

// ---------- views ----------

const views = {
  launcher: document.querySelector<HTMLElement>("#view-launcher")!,
  settings: document.querySelector<HTMLElement>("#view-settings")!,
  onboard: document.querySelector<HTMLElement>("#view-onboard")!,
};

function showView(name: keyof typeof views) {
  (Object.keys(views) as (keyof typeof views)[]).forEach((k) => {
    views[k].hidden = k !== name;
  });
}

const tiles = document.querySelector<HTMLElement>("#tiles")!;
const status = document.querySelector<HTMLElement>("#status")!;
const blurToggle = document.querySelector<HTMLElement>("#blur-toggle")!;
const blurCaption = document.querySelector<HTMLElement>("#blur-caption")!;
const bringBack = document.querySelector<HTMLElement>("#bring-back")!;
const strengthRow = document.querySelector<HTMLElement>("#blur-strength-row")!;
const strengthToggle = document.querySelector<HTMLElement>("#blur-strength")!;
const genderToggle = document.querySelector<HTMLElement>("#gender-toggle")!;

// Design tints (board 1A): muted warm letter glyphs, never platform
// brand colors. Falls back to the Rust-side tint for new platforms.
const DESIGN_TINTS: Record<string, string> = {
  youtube: "var(--tint-yt)",
  reddit: "var(--tint-rd)",
  x: "var(--tint-x)",
  instagram: "var(--tint-ig)",
  tiktok: "var(--tint-tt)",
};

// Per-platform launcher captions (board 1A). Fallback: "Cleaned".
const TILE_NOTES: Record<string, string> = {
  youtube: "No Shorts, no autoplay, no sidebar",
  reddit: "Your subreddits only, no Popular",
  x: "Following only, no For You",
  instagram: "No Reels, no Explore",
  tiktok: "Following and search only",
};

// ---------- gaze mode / strength / gender (Rust-mirrored) ----------

type GazeMode = "off" | "blur" | "smart";
const BLUR_KEY = "tamescroll.blur";

const CAPTIONS: Record<GazeMode, string> = {
  off: "",
  blur: "Blurs pictures on the pages you browse. What you open plays normally.",
  smart:
    "Smart blurs faces by your onboarding choice. Blur runs on this device — nothing you view leaves it.",
};

function migrate(raw: string | null): GazeMode {
  if (raw === "off" || raw === "blur" || raw === "smart") return raw;
  if (raw === "1") return "blur";
  return "off"; // "0", absent, or unrecognised
}

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

const GENDER_KEY = "tamescroll.gender";
type UserGender = "man" | "woman" | "unset";

function getGender(): UserGender {
  const g = localStorage.getItem(GENDER_KEY);
  return g === "man" || g === "woman" ? g : "unset";
}

function setGender(g: UserGender) {
  localStorage.setItem(GENDER_KEY, g);
  void invoke("set_user_gender", { gender: g }).catch(() => {});
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
  const gender = getGender();
  genderToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
    const active = btn.dataset.value === gender;
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
genderToggle.querySelectorAll<HTMLButtonElement>(".toggle-opt").forEach((btn) => {
  btn.addEventListener("click", () => setGender(btn.dataset.value as UserGender));
});

renderBlurToggle();
// Sync stored state into Rust at startup too, not just on change —
// otherwise a relaunch would leave Rust at defaults until first touch.
void invoke("set_gaze_mode", { mode: getMode() }).catch(() => {});
void invoke("set_blur_strength", { px: getStrength() }).catch(() => {});
void invoke("set_user_gender", { gender: getGender() }).catch(() => {});

// ---------- filter terms (Settings -> Filters) ----------

const TERMS_KEY = "tamescroll.terms";

function readTerms(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TERMS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function writeTerms(terms: string[]) {
  localStorage.setItem(TERMS_KEY, JSON.stringify(terms));
  void invoke("set_user_terms", { terms }).catch(() => {});
  renderTermChips();
}

function renderTermChips() {
  const host = document.querySelector<HTMLElement>("#term-chips")!;
  host.textContent = "";
  const terms = readTerms();
  if (!terms.length) {
    const hint = document.createElement("p");
    hint.className = "section-hint";
    hint.style.textAlign = "left";
    hint.textContent = "No terms of your own yet.";
    host.append(hint);
    return;
  }
  terms.forEach((term) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    const label = document.createElement("span");
    label.textContent = term;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${term}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      writeTerms(readTerms().filter((t) => t !== term));
    });
    chip.append(label, remove);
    host.append(chip);
  });
}

document.querySelector<HTMLFormElement>("#term-form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#term-input")!;
  const term = input.value.trim();
  if (!term) return;
  const terms = readTerms();
  if (!terms.includes(term)) writeTerms([...terms, term]);
  input.value = "";
});

renderTermChips();
void invoke("set_user_terms", { terms: readTerms() }).catch(() => {});

// ---------- rules refresh (Settings -> About) ----------
// Rules also refresh silently on launch + every 24h (Rust side); this
// button is the owner-visible "do it now" for when a platform breaks
// something and a fix just landed.

const refreshForm = document.querySelector<HTMLFormElement>("#rules-refresh-form")!;
const refreshBtn = document.querySelector<HTMLButtonElement>("#rules-refresh")!;
const refreshStatus = document.querySelector<HTMLElement>("#rules-refresh-status")!;

refreshForm.addEventListener("submit", (e) => {
  e.preventDefault();
  refreshBtn.disabled = true;
  refreshStatus.textContent = "Checking…";
  invoke<string>("refresh_rules")
    .then((msg) => {
      refreshStatus.textContent =
        msg === "rules up to date" ? "Already up to date." : `${msg}. Reopen a platform to apply.`;
    })
    .catch(() => {
      refreshStatus.textContent = "Couldn't reach the update server. Current rules stay active.";
    })
    .finally(() => {
      refreshBtn.disabled = false;
    });
});

// ---------- app update (Settings -> About) ----------
// Checks a signed manifest on launch; only reveals the card when a newer
// build exists (no nag when up to date). The actual download + install is
// Android-native (MainActivity TsUpdater bridge, user-confirmed by the
// system installer). Desktop has no in-app install — the card stays
// hidden there and the check is a harmless no-op.

type UpdateStatus = {
  available: boolean;
  versionName: string;
  notes: string;
  apkUrl: string;
};

const updateCard = document.querySelector<HTMLElement>("#app-update-card")!;
const updateNotes = document.querySelector<HTMLElement>("#app-update-notes")!;
const updateBtn = document.querySelector<HTMLButtonElement>("#app-update-btn")!;
const updateStatus = document.querySelector<HTMLElement>("#app-update-status")!;

// Android bridge pushes progress here (see MainActivity UpdateBridge.report).
(window as unknown as { __tsUpdateStatus?: (m: string) => void }).__tsUpdateStatus = (
  m: string,
) => {
  updateStatus.textContent = m;
};

const hasInstaller = typeof (window as unknown as { TsUpdater?: unknown }).TsUpdater !== "undefined";

updateBtn.addEventListener("click", () => {
  const u = window as unknown as { TsUpdater?: { install: () => void } };
  if (u.TsUpdater) {
    updateStatus.textContent = "Checking…";
    u.TsUpdater.install();
  }
});

invoke<UpdateStatus>("app_update_check")
  .then((s) => {
    if (!s.available) return;
    updateNotes.textContent = s.notes
      ? `Version ${s.versionName} is available. ${s.notes}`
      : `Version ${s.versionName} is available.`;
    // Only Android can install in place; desktop just gets told it exists.
    updateBtn.hidden = !hasInstaller;
    if (!hasInstaller) {
      updateStatus.textContent = "Get the new build from the releases page.";
    }
    updateCard.hidden = false;
  })
  .catch(() => {
    /* offline / no manifest: stay hidden, never nag */
  });

// ---------- bring back (surfaces) ----------

type SurfaceInfo = { id: string; label: string; default_shown: boolean };

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

// SEED THE DEFAULTS ONCE. (owner 2026-08-27: "no recommendations did we
// remove them keep the option but don't disable right on")
//
// The stored map is the user's own choice and must never be overwritten
// by a later build's opinion, so this runs exactly once per install and
// only for platforms the user has never touched. Everything after that
// is theirs: flipping a default-shown surface to Hidden persists an
// empty list, which is a real stored choice and is left alone.
const SEEDED_KEY = "tamescroll.shown.seeded";

async function seedDefaultShown(platformIds: string[]) {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return;
    const map = readShownMap();
    for (const id of platformIds) {
      if (Array.isArray(map[id])) continue;
      const list = await invoke<SurfaceInfo[]>("surfaces", { id });
      const defaults = list.filter((s) => s.default_shown).map((s) => s.id);
      if (defaults.length) map[id] = defaults;
    }
    localStorage.setItem(SHOWN_KEY, JSON.stringify(map));
    localStorage.setItem(SEEDED_KEY, "1");
  } catch (error) {
    // A failed seed must not stop the launcher rendering: the user simply
    // gets the fully-cleaned default and can turn the surface on himself.
    console.warn("tamescroll: could not seed default surfaces", error);
  }
}

function setShown(platformId: string, shown: string[]) {
  const map = readShownMap();
  map[platformId] = shown;
  localStorage.setItem(SHOWN_KEY, JSON.stringify(map));
}

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
  bringBack.textContent = "";
  if (!readyPlatforms.length) {
    const hint = document.createElement("p");
    hint.className = "section-hint";
    hint.textContent = "Add a platform first — its surfaces show up here.";
    bringBack.append(hint);
    return;
  }
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
      // One platform's toggles failing to load must not block the rest.
    }
  }
}

// ---------- chosen platforms ----------

// Chosen platforms (owner decision 2026-08-19): a launcher that shows
// every platform is itself a temptation surface — a hub. The grid only
// ever shows platforms the user explicitly brought in, and adding one
// is type-to-match: we match only what the user types, never list or
// suggest (design board 1D; also the no-circumvention stance — the
// launcher must not advertise platforms someone removed from their life).
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

function glyphFor(platform: Platform): HTMLElement {
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.color = DESIGN_TINTS[platform.id] ?? platform.tint;
  dot.textContent = platform.name.charAt(0);
  return dot;
}

function tile(platform: Platform): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = "tile";
  el.disabled = !platform.ready;

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = platform.name;

  const note = document.createElement("span");
  note.className = "note";
  note.textContent = platform.ready
    ? TILE_NOTES[platform.id] ?? "Cleaned"
    : "Not ready yet";

  el.append(glyphFor(platform), name, note);

  if (platform.ready) {
    el.addEventListener("click", () => {
      void open(platform);
    });
  }

  return el;
}

// Type-to-match: reveal a platform only after the user types its name.
// Never a list, never a suggestion (board 1D step 2).
function matchPlatforms(platforms: Platform[], query: string, exclude: string[]): Platform[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  // Not-ready platforms still match — "we don't support that" would be a
  // lie for one we know but haven't finished; the row says so instead.
  return platforms.filter(
    (p) => !exclude.includes(p.id) && p.name.toLowerCase().startsWith(q)
  );
}

function matchRow(platform: Platform, query: string, onAdd: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "match-row";
  const grow = document.createElement("span");
  grow.className = "grow";
  const bold = document.createElement("b");
  bold.textContent = platform.name.slice(0, query.trim().length);
  const dim = document.createElement("span");
  dim.className = "dim";
  dim.textContent = platform.name.slice(query.trim().length);
  grow.append(bold, dim);
  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn-solid";
  if (platform.ready) {
    add.textContent = "Add";
    add.addEventListener("click", onAdd);
  } else {
    add.textContent = "Not ready yet";
    add.disabled = true;
    add.classList.remove("btn-solid");
    add.classList.add("link-btn");
  }
  row.append(glyphFor(platform), grow, add);
  return row;
}

// ---------- launcher rendering ----------

let restingStatus = "";

async function open(platform: Platform) {
  try {
    await invoke("open_platform", {
      strength: getStrength(),
      id: platform.id,
      mode: getMode(),
      gender: getGender(),
      shown: getShown(platform.id),
    });
    status.textContent = restingStatus;
  } catch (error) {
    status.textContent = `Could not open ${platform.name}: ${String(error)}`;
  }
}

function renderTiles(platforms: Platform[], chosen: string[]) {
  tiles.textContent = "";
  platforms
    .filter((p) => chosen.includes(p.id))
    .forEach((platform) => tiles.append(tile(platform)));

  // "Add a platform" tile: expands into the type-to-match input.
  const add = document.createElement("button");
  add.className = "tile add";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.textContent = "+";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = "Add a platform";
  const note = document.createElement("span");
  note.className = "note";
  note.textContent = "Only ones you already use";
  add.append(dot, name, note);
  add.addEventListener("click", () => {
    add.replaceWith(addMatchBox(platforms));
  });
  tiles.append(add);
}

function addMatchBox(platforms: Platform[]): HTMLElement {
  const box = document.createElement("div");
  box.className = "add-match";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type a platform name...";
  input.autocomplete = "off";
  const result = document.createElement("div");
  box.append(input, result);

  input.addEventListener("input", () => {
    result.textContent = "";
    const chosen = readChosen() ?? [];
    const q = input.value;
    const matches = matchPlatforms(platforms, q, chosen);
    if (matches.length) {
      result.append(
        matchRow(matches[0], q, () => {
          writeChosen([...chosen, matches[0].id]);
          refreshAll();
        })
      );
    } else if (q.trim().length >= 3) {
      const none = document.createElement("p");
      none.className = "match-none";
      none.textContent = "We don't support that.";
      result.append(none);
    }
  });

  setTimeout(() => input.focus(), 0);
  return box;
}

// "Manage platforms": every chosen platform as an In/Out row, inside
// Settings. Out is the default state of the world; In is the explicit
// act (and arrives via type-to-match, never a listing).
function renderManage(platforms: Platform[]) {
  const host = document.querySelector<HTMLElement>("#manage-platforms")!;
  host.textContent = "";
  const chosen = readChosen() ?? [];
  if (!chosen.length) return;

  const details = document.createElement("details");
  details.className = "platform-settings";
  const summary = document.createElement("summary");
  summary.textContent = "Your platforms";
  details.append(summary);

  platforms
    .filter((p) => chosen.includes(p.id))
    .forEach((platform) => {
      const row = document.createElement("div");
      row.className = "setting-row";
      const label = document.createElement("span");
      label.className = "setting-label";
      label.textContent = platform.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "link-btn";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        writeChosen((readChosen() ?? []).filter((id) => id !== platform.id));
        refreshAll();
      });
      row.append(label, remove);
      details.append(row);
    });
  host.append(details);
}

// ---------- settings view ----------

const PANES = ["bringback", "filters", "blur", "protection", "about"] as const;

function showPane(name: (typeof PANES)[number]) {
  PANES.forEach((p) => {
    document.querySelector<HTMLElement>(`#pane-${p}`)!.hidden = p !== name;
  });
  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pane === name);
  });
}

document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => showPane(btn.dataset.pane as (typeof PANES)[number]));
});

document.querySelector<HTMLButtonElement>("#open-settings")!.addEventListener("click", () => {
  showView("settings");
  showPane("bringback");
});

document.querySelector<HTMLButtonElement>("#settings-back")!.addEventListener("click", () => {
  showView("launcher");
});

// ---------- onboarding (board 1D, 5 steps) ----------

function runOnboarding(platforms: Platform[], done: () => void) {
  showView("onboard");
  const steps = document.querySelectorAll<HTMLElement>(".ob-step");
  const dots = document.querySelectorAll<HTMLElement>(".ob-dots i");
  const chosen = new Set<string>();
  let obGender: UserGender = "unset";
  let obMode: GazeMode = "smart";

  function goto(step: number) {
    steps.forEach((el) => {
      el.hidden = Number(el.dataset.step) !== step;
    });
    dots.forEach((el) => {
      el.classList.toggle("on", Number(el.dataset.dot) <= step);
    });
  }

  document.querySelector<HTMLButtonElement>("#ob-start")!.addEventListener("click", () => goto(2));

  // Step 2: type-to-match platform entry.
  const chips = document.querySelector<HTMLElement>("#ob-chips")!;
  const input = document.querySelector<HTMLInputElement>("#ob-input")!;
  const match = document.querySelector<HTMLElement>("#ob-match")!;
  const cont = document.querySelector<HTMLButtonElement>("#ob-continue")!;

  const paintChips = () => {
    chips.textContent = "";
    chosen.forEach((id) => {
      const p = platforms.find((x) => x.id === id);
      if (!p) return;
      const chip = document.createElement("span");
      chip.className = "chip";
      const label = document.createElement("span");
      label.textContent = `${p.name} ✓`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${p.name}`);
      remove.addEventListener("click", () => {
        chosen.delete(id);
        paintChips();
      });
      chip.append(label, remove);
      chips.append(chip);
    });
    cont.textContent = chosen.size
      ? `Continue with ${chosen.size} platform${chosen.size === 1 ? "" : "s"}`
      : "Continue with none — add later";
  };

  input.addEventListener("input", () => {
    match.textContent = "";
    const q = input.value;
    const matches = matchPlatforms(platforms, q, [...chosen]);
    if (matches.length) {
      match.append(
        matchRow(matches[0], q, () => {
          chosen.add(matches[0].id);
          input.value = "";
          match.textContent = "";
          paintChips();
        })
      );
    } else if (q.trim().length >= 3) {
      const none = document.createElement("p");
      none.className = "match-none";
      none.textContent = "We don't support that.";
      match.append(none);
    }
  });
  paintChips();
  cont.addEventListener("click", () => goto(3));

  // Step 3: the gender question (compulsory stop, skippable answer).
  document.querySelectorAll<HTMLButtonElement>(".ob-card[data-gender]").forEach((btn) => {
    btn.addEventListener("click", () => {
      obGender = btn.dataset.gender as UserGender;
      goto(4);
    });
  });
  document.querySelector<HTMLButtonElement>("#ob-skip-gender")!.addEventListener("click", () => {
    obGender = "unset";
    goto(4);
  });

  // Step 4: blur mode.
  document.querySelectorAll<HTMLButtonElement>("#ob-blur-cards .ob-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      obMode = btn.dataset.mode as GazeMode;
      // Step 5 summary reflects the actual picks.
      const names = [...chosen]
        .map((id) => platforms.find((p) => p.id === id)?.name)
        .filter(Boolean);
      const summary = document.querySelector<HTMLElement>("#ob-summary")!;
      summary.textContent = names.length
        ? `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} set up. Everything starts hidden — bring back what you want in Settings.`
        : "No platforms yet — add one from the home screen when you need it. Everything starts hidden.";
      const glyphs = document.querySelector<HTMLElement>("#ob-glyphs")!;
      glyphs.textContent = "";
      [...chosen].forEach((id) => {
        const p = platforms.find((x) => x.id === id);
        if (p) glyphs.append(glyphFor(p));
      });
      goto(5);
    });
  });

  // Step 5: commit everything and land on the launcher.
  document.querySelector<HTMLButtonElement>("#ob-open")!.addEventListener("click", () => {
    writeChosen([...chosen]);
    setGender(obGender);
    setMode(obMode);
    done();
  });

  goto(1);
}

// ---------- startup ----------

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

let allPlatforms: Platform[] = [];

function refreshAll() {
  const chosen = readChosen() ?? [];
  renderTiles(allPlatforms, chosen);
  renderManage(allPlatforms);
  void renderBringBack(allPlatforms.filter((p) => p.ready && chosen.includes(p.id)));
}

async function start() {
  try {
    allPlatforms = await invokeStartup<Platform[]>("platforms");
    await seedDefaultShown(allPlatforms.map((p) => p.id));

    const chosen = readChosen();
    if (chosen === null) {
      runOnboarding(allPlatforms, () => {
        showView("launcher");
        refreshAll();
      });
    } else {
      showView("launcher");
      refreshAll();
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
      const target = allPlatforms.find((p) => p.id === requested && p.ready);
      if (target) {
        // The user created this platform's home-screen icon — that is
        // an explicit choice, so it also brings the platform in.
        const current = readChosen() ?? [];
        if (!current.includes(target.id)) {
          writeChosen([...current, target.id]);
        }
        showView("launcher");
        refreshAll();
        void open(target);
      }
    }
  } catch (error) {
    showView("launcher");
    status.textContent = `Could not load platforms: ${String(error)}`;
  }
}

void start();
