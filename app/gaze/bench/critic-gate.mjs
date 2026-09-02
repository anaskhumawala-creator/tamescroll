// A LEDGER WITH NO TEETH IS A TODO LIST.
//
// docs/critic-loop.md §7: a critic row closes with an ARTIFACT, never with
// an argument. Nothing enforced that. This does -- while any row of
// severity EXPOSURE or WRONG-NUMBER is still OPEN, it exits non-zero, and
// the release recipe runs it.
//
// WHY ONLY THOSE TWO SEVERITIES. A DEAD-CHECK is a test that cannot fail:
// bad, and it puts nothing on his screen. A SCOPE or NIT row is
// housekeeping. An EXPOSURE row is a person left sharp who should not be,
// and a WRONG-NUMBER row is a figure in shipped source or a test comment
// that the next round will reason from. Both of those TRAVEL -- one to his
// phone, the other into the next decision -- and those are the two that
// may not ride a release while open.
//
// THE VERDICTS THAT CLOSE A ROW, each of which has to be earned:
//   CONFIRMED      a commit fixed it, with a check red before and green after
//   REFUTED        the falsifier was RUN and its raw output is in the row
//   ACCEPTED-COST  cites the engine-findings §9 line that makes it a cost
// Anything else -- including a row edited to say "fixed" -- is OPEN.
//
// Usage: node bench/critic-gate.mjs [--verbose]
import fs from 'fs';

const LEDGER = new URL('../../../docs/critic/ledger.md', import.meta.url);
const BLOCKING = new Set(['EXPOSURE', 'WRONG-NUMBER']);
const CLOSING = ['CONFIRMED', 'REFUTED', 'ACCEPTED-COST'];
const SEVERITIES = ['EXPOSURE', 'WRONG-NUMBER', 'DEAD-CHECK', 'SCOPE', 'NIT'];
const verbose = process.argv.includes('--verbose');

if (!fs.existsSync(LEDGER)) {
  // NO LEDGER IS NOT A PASS. A gate that finds nothing to check is
  // indistinguishable from a gate wired to the wrong path, and this repo
  // has shipped a check that could not fail twice.
  console.error('critic-gate: no ledger at docs/critic/ledger.md.');
  console.error('A missing ledger is not an empty one -- if the critic loop is');
  console.error('deliberately off, delete this gate from the release recipe.');
  process.exit(2);
}

const rows = [];
for (const line of fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/)) {
  // NOT a positional split on "|": a falsifier cell holds shell commands
  // with escaped pipes, so counting cells silently shifts the verdict
  // column into the middle of somebody's grep. Both fields this gate
  // decides on are CLOSED VOCABULARIES, so each is matched by value in
  // its own cell and cannot be shifted by anything a human types.
  // THE SUFFIX IS NOT COSMETIC. `E5b` -- a residual split off a row that
  // otherwise closed -- did not match `[A-Z]\d+`, so the gate SKIPPED it
  // entirely and reported a clean bill on a WRONG-NUMBER row that was
  // open. A row this parser cannot read must never read as no row.
  const id = /^\|\s*([A-Z]\d+[a-z]?)\s*\|/.exec(line);
  if (!id) {
    // ... which is what this second half is for. A line that carries a
    // severity from the closed vocabulary is a findings row whatever its
    // id looks like, so an unparseable one is a hard failure rather than
    // a silent skip.
    if (line.startsWith('|') && SEVERITIES.some((s) => line.includes(`| ${s} |`))) {
      console.error('critic-gate: a row carries a severity but no readable id:');
      console.error(`  ${line.slice(0, 160)}`);
      process.exit(2);
    }
    continue;
  }
  const cell = (words) => words.find((w) => line.includes(`| ${w} |`)) || null;
  rows.push({
    id: id[1],
    // AN UNREADABLE ROW IS A BLOCKING ROW. A ledger typo must never read
    // as a clean bill; that is the exact failure this gate exists for.
    severity: cell(SEVERITIES) || 'UNPARSED-SEVERITY',
    verdict: cell([...CLOSING, 'OPEN']) || 'UNPARSED-VERDICT',
    claim: line.slice(0, 400),
  });
}

if (!rows.length) {
  console.error('critic-gate: the ledger parsed to ZERO rows.');
  console.error('That is a parser failure, not a clean bill -- the table format moved.');
  process.exit(2);
}

const closes = new Set(CLOSING);
const open = rows.filter((r) => !closes.has(r.verdict)
  && (BLOCKING.has(r.severity) || r.severity === 'UNPARSED-SEVERITY'));

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
console.log(`critic-gate: ${rows.length} rows  `
  + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join('  '));
if (verbose) {
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(4)} ${r.severity.padEnd(17)} ${r.verdict.padEnd(14)}`);
  }
}

if (open.length) {
  console.error(`\nBLOCKED: ${open.length} row(s) of blocking severity are still OPEN.\n`);
  for (const r of open) console.error(`  ${r.id}  ${r.severity}`);
  console.error('\nClose each with an ARTIFACT, never an argument:');
  console.error('  CONFIRMED     a commit, plus a check red before and green after');
  console.error('  REFUTED       the falsifier RUN, raw output pasted into the row');
  console.error('  ACCEPTED-COST cite the engine-findings §9 line that makes it a cost');
  process.exit(1);
}
console.log('critic-gate: no blocking row is open. Clear to release.');
