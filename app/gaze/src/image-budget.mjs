// The thumbnail drain's four numbers, lifted out of init-entry's closure
// so the OTA channel can reach them (queue item d, 2026-09-05). Fractions
// are of a 1s rolling main-thread window; lanes is how many images may
// be in flight at once. The archive's measurement stands: the scroll
// fraction alone is NOT a lever (0.02/0.15/0.35 gave 0.78/0.75/1.02
// img/s, inside run-to-run variance) -- these travel so the next
// measurement needs no build, not because a better value is known.

export var IMG_BUDGET_SPEND = 0.25;   // still page, player recently active
export var IMG_BUDGET_SCROLL = 0.15;  // while the user is scrolling
export var IMG_BUDGET_IDLE = 0.6;     // still page, player quiet
export var IMAGE_LANES = 2;

export function setImgBudgetSpend(v) { IMG_BUDGET_SPEND = v; }
export function setImgBudgetScroll(v) { IMG_BUDGET_SCROLL = v; }
export function setImgBudgetIdle(v) { IMG_BUDGET_IDLE = v; }
export function setImageLanes(v) { IMAGE_LANES = Math.round(v); }
