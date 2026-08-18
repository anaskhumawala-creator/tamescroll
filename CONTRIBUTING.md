# Contributing to tamescroll

This project exists so that people can use the platforms they cannot
leave without being manipulated by them. It is free, it is open, and it
is meant to outlive any one maintainer. Contributions are welcome.

## Licensing of contributions

By submitting a contribution you agree to the following.

1. **Code** you contribute is licensed under the Mozilla Public License
   2.0, the same licence as the project.

2. **Rules data** (anything under `rules/`) you contribute is dedicated
   to the public domain under CC0 1.0 Universal, so that any blocker or
   filter list may absorb it freely.

3. You grant the project maintainer a perpetual, worldwide,
   irrevocable, royalty-free licence to use, modify, sublicense and
   **relicense** your contribution as part of this project, including
   under a different open-source licence or under a dual-licensing
   arrangement.

4. You confirm the contribution is your own work, or that you have the
   right to submit it, and that it is not derived from code under a
   licence incompatible with the above.

Point 3 exists for one specific reason. App stores, platform terms and
funding models change. If the project ever has to relicense — for
example to keep iOS distribution possible — it can only do so if the
maintainer holds the rights to every line. Without this, a single
un-relicensable contribution can permanently block a change that the
project's survival depends on. It is not a route to closing the source:
points 1 and 2 keep every contribution open.

## What must never be contributed

**Do not copy code from HaramBlur, or submit patches derived from it.**
HaramBlur is AGPL-3.0. Incorporating its code would place this entire
project under AGPL-3.0, which conflicts with App Store distribution
terms and would end iOS support. We build the gaze module on the same
MIT-licensed libraries HaramBlur itself uses. See `NOTICE`.

The same caution applies to any GPL or AGPL source. Check the licence
before borrowing code.

## What is most useful

**Rules fixes.** Platforms rewrite their pages constantly and this is
what breaks first. A rule fix is the highest-value contribution there
is. Every rule must carry a comment recording what it targets and how
to tell it still works — rules without a stated test cannot be checked
automatically and will not be merged.

**Platform coverage.** Adding a platform should be a change to
`rules/`, not to application code. If it needs code, say so in the
issue first, because it probably means an abstraction leaked.

**Translations of the playbook.** The playbook is a first-class
deliverable and reaches far more people than any feature. Translations
are genuinely wanted.

## What this project will not do

It blocks, hides and blurs content on pages the user views. It never
modifies, repackages or impersonates a platform's own app, never
unlocks paid features, and never nags its own users. Contributions that
cross those lines will be declined regardless of quality.
