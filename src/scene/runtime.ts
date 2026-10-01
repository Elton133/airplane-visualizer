/**
 * Mutable per-frame scene values. Animated by GSAP / read in useFrame, never
 * stored in React state, so they do not cause re-renders.
 */
export const runtime = {
  /** Overhead fixture rows, 0‥1 each (reveal sequence). */
  fixtures: [] as number[],
  /** Main key light 0‥1. */
  key: 0,
  /** Environment/reflection level 0‥1. */
  env: 0,
  /** Daylight from the partially open door 0‥1. */
  door: 0,
  /** Dark-hangar mode 0 (house lights) ‥ 1 (dark). */
  dark: 0,
  /** Isolation darkening of the hangar 0 (normal) ‥ 1 (dark). */
  hangarDim: 0,
  /** Smoothed control-surface state (shared by every aircraft on the floor). */
  surfaces: { roll: 0, pitch: 0, yaw: 0, slat: 0, flap: 0 },
  /** Smoothed two-state mechanisms 0 (closed) ‥ 1 (open), by key. */
  toggles: {} as Record<string, number>,
  /** Representation attitude for the control lab (radians). */
  attitude: { roll: 0, pitch: 0, yaw: 0 },
  fanSpeed: 0,
  /** Engine study: exploded 0‥1 and cutaway 0‥1. */
  engineExplode: 0,
  engineCut: 0,
  /** Radius the key light's shadow camera must cover (m). */
  shadowRadius: 26,
};

export const FIXTURE_ROWS = 7;
runtime.fixtures = new Array(FIXTURE_ROWS).fill(0);
