# Gauntlet loop — in-player blur accuracy

**Owner's bar, verbatim (2026-08-25):** "there isn't a single frame that
the other gender is visible and there isn't a single frame where the
wrong gender is blurred up".

Two failure classes, both terminal:
- **EXPOSURE** — an opposite-gender face/body visible unblurred in a frame.
- **FALSE COVER** — a same-gender person carrying a patch.
- (**GHOST** — a patch with no person under it — counts as false cover.)

Secondary, non-negotiable: mobile cost. Every fix is judged on a Helio
G88-class budget as well as on accuracy. A fix that buys a point of
accuracy for double the pass cost is not a fix.

## How a round runs

1. Pick the next `(query, gender)` pair from the rotation below.
   `python gauntlet.py search "<query>" 5` resolves live video ids —
   never hardcode an id.
2. `python gauntlet.py runs/<round>-<gender> <gender> <videoId> <start>
   <count> <step>` captures player-only frames + overlay geometry +
   track state.
3. Score EVERY frame by eye against the two failure classes. Record
   counts and the exact frame files that failed.
4. Spawn a critic agent. **Each round's brief must differ from the last**
   — different lens, different question, fresh evidence. A critic that
   re-asks last round's question returns last round's answer.
5. Apply what survives scrutiny. Rebuild, re-run the same round, confirm
   the specific frames that failed now pass, and confirm no regression
   on the previously-passing set.
6. Commit + push. Append a ROUNDS entry below.

## Rotation (vary BOTH the corpus and the gender setting)

Both directions get tested every round-pair: with `man`, women and
children must be covered and men sharp; with `woman`, the inverse. A fix
that helps one direction and quietly breaks the other is a regression.

| # | query | gender | why this one |
|---|---|---|---|
| 1 | (fixed) NWoT1ZVd1Lo | man | baseline: adult male + child female, known-hard |
| 2 | (fixed) NWoT1ZVd1Lo | woman | same footage, inverted expectation |
| 3 | ted talk full speech | man | single speaker, stage lighting, slow cuts |
| 4 | news panel discussion | woman | 3-5 people, seated, small faces |
| 5 | cooking show episode | man | hands/objects — the phantom-patch trap |
| 6 | conference keynote audience | woman | crowd shots, 10+ people (MoveNet's 6 cap) |
| 7 | sports post match interview | man | motion, back-turned subjects |
| 8 | classroom lecture | woman | mixed ages — the child gate |

Owner constraint: nothing indecent. Queries stay ordinary.

## Standing rules

- Verify by FRAME, never by test suite alone. A green suite has shipped
  three broken releases this week.
- A probe must never be able to throw inside the pipeline. One did, and
  it silently killed every gender verdict for two releases.
- Blur-first: unknown ⇒ covered. Exposure is worse than false cover, but
  the owner counts both as failures, so neither is "acceptable".
- Licences: MIT/Apache/BSD only. Ultralytics YOLO (code AND weights) and
  abewley/SORT are AGPL/GPL — permanently banned. Never copy HaramBlur.

## ROUNDS

- **R0** (2026-08-25) — harness built. Baseline on NWoT1ZVd1Lo/man,
  8 frames @1.5s from t=118: Linus clears (`state=cleared`,
  `lastVerdict=clear-certain`), daughter covered, empty desk shots hold
  0 patches. Known open: one frame carried a patch spanning
  x 0.000-0.551, y 0.000-1.000 — a half-frame ghost with no subject
  under it. That is the owner's "boxes spawn randomly and float around".
