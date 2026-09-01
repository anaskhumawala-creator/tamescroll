// CAN THIS SCORER EVEN MOVE? A replay that reports the same thing
// whatever it is fed measures nothing. Four arms over the SAME banked
// frames, only the decision layer differs.
import fs from 'fs';
import { replay } from './corpus-score.mjs';
import { ROOT } from './corpus-lib.mjs';
const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const arms = {
  'man (his setting)':   { g: 'man' },
  'woman (control arm)': { g: 'woman' },
  'cover-everything':    { g: 'man', tweak: { faceMeta: (u, fs_) => fs_.map(() => ({ flagged: true, certain: false })) } },
  'clear-everything':    { g: 'man', tweak: { faceMeta: (u, fs_) => fs_.map(() => ({ flagged: false, certain: true, instant: true })) } },
};
for (const [name, a] of Object.entries(arms)) {
  let patches = 0, frames = 0, covered = 0;
  for (const f of files) {
    const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`, 'utf8'));
    const out = replay(win, a.g, a.tweak);
    frames += out.length;
    patches += out.reduce((s, x) => s + x.patches.length, 0);
    covered += out.filter((x) => x.patches.length > 0).length;
  }
  console.log(name.padEnd(22), 'patches', String(patches).padStart(5),
    ' frames-with-a-patch', String(covered).padStart(4), '/', frames);
}
