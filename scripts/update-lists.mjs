#!/usr/bin/env node
// Refreshes rules/vendor/ with current snapshots of the upstream filter
// lists and scriptlet resources the engine is built from. Node only, no
// deps — these are plain HTTP GETs written straight to disk.
//
// Run with: node scripts/update-lists.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = path.join(__dirname, "..", "rules", "vendor");

// Destination filename -> upstream URL. Keep filenames stable; lib.rs /
// rules.rs include them by path.
const SOURCES = {
  "easylist.txt": "https://easylist.to/easylist/easylist.txt",
  "easyprivacy.txt": "https://easylist.to/easylist/easyprivacy.txt",
  "ubo-filters.txt":
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
  "ubo-quick-fixes.txt":
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt",
  "ubo-unbreak.txt":
    "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt",
  "resources.json":
    "https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json",
};
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function main() {
  await mkdir(VENDOR_DIR, { recursive: true });

  const all = { ...SOURCES, ...PINNED_SOURCES };
  for (const [filename, url] of Object.entries(all)) {
    process.stderr.write(`fetching ${filename} from ${url}\n`);
    const body = await fetchText(url);
    await writeFile(path.join(VENDOR_DIR, filename), body, "utf8");
  }

  process.stderr.write(`done: ${Object.keys(all).length} files written to ${VENDOR_DIR}\n`);
}

main().catch((err) => {
  process.stderr.write(`update-lists failed: ${err.message}\n`);
  process.exitCode = 1;
});
