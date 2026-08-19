// What the gaze pipeline runs in each launcher mode. The compulsory
// tier (handoff decision #1) makes the pipeline boot in EVERY mode so
// NSFW media can be removed outright; everything else stays mode-gated.
// Pure data so the policy is unit-testable away from the DOM.

/**
 * @param {string|undefined} mode  window.__TS_GAZE_MODE
 * @returns {{boot:boolean, preBlur:boolean, textFilter:boolean,
 *            faceGender:boolean, nsfw:boolean, revealClears:boolean}}
 */
export function planForMode(mode) {
  if (mode === 'smart') {
    return {
      boot: true,
      preBlur: true,
      textFilter: true,
      faceGender: true,
      nsfw: true,
      revealClears: true,
    };
  }
  if (mode === 'off') {
    // Off = no gender blur, but the compulsory tier still runs:
    // blur-first while the NSFW check decides reveal vs remove.
    return {
      boot: true,
      preBlur: true,
      textFilter: true,
      faceGender: false,
      nsfw: true,
      revealClears: true,
    };
  }
  if (mode === 'blur') {
    // The Stage A sheet already blankets every image; the pipeline only
    // adds NSFW removal and must never clear (the sheet owns blur).
    return {
      boot: true,
      preBlur: false,
      textFilter: false,
      faceGender: false,
      nsfw: true,
      revealClears: false,
    };
  }
  return {
    boot: false,
    preBlur: false,
    textFilter: false,
    faceGender: false,
    nsfw: false,
    revealClears: false,
  };
}
