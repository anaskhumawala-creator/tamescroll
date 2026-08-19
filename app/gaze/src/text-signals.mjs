// Text-signal matcher for the protection engine (handoff decision #5):
// a cheap pre-filter over creator names, titles, bios and post text that
// runs BEFORE any model. Seed list is the embedded sexual/shock subset of
// dsojevic/profanity-list (MIT); `obscenity` (MIT) supplies the evasion
// normalization (leetspeak, confusables, repeated chars) so "s3ggs"-style
// spellings hit without hand-listing every variant. Whole-word boundaries
// throughout — "Scunthorpe"/"Sussex" must never flag.
import {
  RegExpMatcher,
  englishRecommendedTransformers,
  pattern,
  assignIncrementingIds,
} from 'obscenity';
import { SEED_TERMS } from './keywords-embed.mjs';

// Obscenity's pattern template parses `[ ] ? \ |` as syntax; seed terms
// contain none (checked at generation), user terms could. Stripping beats
// escaping: a metachar in a user term is noise, and stripping cannot
// throw ParserError on malformed input.
function sanitize(term) {
  return String(term).replace(/[[\]?\|]/g, '').trim();
}

function toPatterns(terms) {
  const out = [];
  for (const term of terms) {
    const clean = sanitize(term);
    if (!clean) continue;
    try {
      out.push(pattern`|${clean}|`);
    } catch (e) {
      /* one bad term must never take the matcher down */
    }
  }
  return out;
}

/**
 * Builds a matcher over the seed list plus optional user-added terms.
 * Returns { test(text) } — true when the text carries a signal. Never
 * throws on any input; non-string/empty input is clean.
 */
export function createTextMatcher(userTerms) {
  const terms = SEED_TERMS.concat(Array.isArray(userTerms) ? userTerms : []);
  const matcher = new RegExpMatcher({
    blacklistedTerms: assignIncrementingIds(toPatterns(terms)),
    ...englishRecommendedTransformers,
  });
  return {
    test(text) {
      if (typeof text !== 'string' || !text) return false;
      return matcher.hasMatch(text);
    },
  };
}
