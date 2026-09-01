// Re-export the shipped decision + detection surface for offline benches.
export * from '../src/detector.js';
export * from '../src/gender-verdict.mjs';
export * from '../src/crop-geometry.mjs';
export * from '../src/person-track.mjs';
export * from '../src/person-gate.mjs';
export { clampAway, clampBodies, BODY_CLAMP_PAD } from '../src/body-clamp.mjs';
export * from '../src/scene-gate.mjs';
