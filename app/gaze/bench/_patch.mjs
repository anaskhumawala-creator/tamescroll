// A VARIANT BUNDLE, PATCHED BY CONSTANT NAME INSTEAD OF BY LITERAL TEXT.
//
// THE DEFECT THIS REPLACES, stated accurately: three benches (matrix,
// bar-risk, critic-lowbar) each carried their own hand-written copy of
//
//     src.replace('var GENDER_CLEAR_SCORE = 0.6;', ...)
//
// and loop 39 shipped that constant at **0.45**. So all three have been
// DEAD since -- `String.replace` with a literal that does not occur
// returns the string unchanged, their `if (patched === src) throw`
// guard fires, and the arm exits.
//
// CREDIT WHERE IT IS DUE, because I first wrote the opposite here and it
// is worth the correction: those guards WORK. Nothing published a table
// of one arm against itself; the three files simply stopped running, in
// a repo where a broken instrument usually reports a confident number
// instead. Verified by running all three: "constant patch failed -- the
// bundle changed shape".
//
// What is still wrong is what the failure COSTS and what it SAYS. Three
// copies of one literal must be edited in lockstep every time a number
// moves, and the message blames the bundle's shape when the truth is
// that the value moved -- which sends the next reader to esbuild instead
// of to git log.
//
// So the constant is found by NAME and its current value is READ OUT of
// the built bundle. Nothing here goes stale when a number moves again,
// and a renamed or deleted constant still stops the arm -- refusing
// rather than sweeping a dimension that no longer exists, which is the
// same contract `_build.mjs` holds for the bundle itself.

// NO BACKSLASH ESCAPES IN THIS PATTERN, deliberately. A heredoc eats one
// backslash, and `\s` inside a template literal is just `s` -- which is
// how the first version of this very file silently matched nothing, the
// same failure it exists to prevent. Character classes only.
const decl = (name) => new RegExp('(var ' + name + '[ ]*=[ ]*)([-0-9.]+)[ ]*;');

// The value the built bundle carries today.
export function readConst(src, name) {
  const m = src.match(decl(name));
  if (!m) throw new Error(
    `bench/_patch: no 'var ${name} = <number>;' in .cache/shipped.mjs. `
    + 'The constant was renamed, deleted, or is no longer a plain number '
    + 'literal -- any arm sweeping it is now sweeping nothing.');
  return Number(m[2]);
}

// Returns the patched source. Every name must exist. A value EQUAL to
// the shipped one is allowed and deliberate: that is the control point
// of a sweep, and it must produce a byte-identical bundle.
export function patchConsts(src, values) {
  let out = src;
  for (const name of Object.keys(values)) {
    readConst(out, name);                       // throws if absent
    out = out.replace(decl(name), `$1${values[name]};`);
  }
  return out;
}

// The shipped pair, printed by every arm that moves it. An arm that does
// not say what the baseline was cannot be read a month later.
export const CLEAR_BAR = ['GENDER_CLEAR_SCORE', 'GENDER_CLEAR_SCORE_FEMALE'];
export const shippedBar = (src) =>
  CLEAR_BAR.map((n) => readConst(src, n));
