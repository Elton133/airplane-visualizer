/**
 * A320-200 (A320ceo, CFM56-5B, sharklets) geometric layout.
 *
 * Aircraft space, metres: +X forward (nose), +Y up, +Z starboard (right).
 * Ground plane is Y = 0.
 *
 * Overall dimensions match the Airbus A320 Aircraft Characteristics (ACAP):
 * length 37.57 m, span 35.80 m (with sharklets), height 11.76 m,
 * fuselage width 3.95 m, wheelbase 12.64 m, track 7.59 m.
 * Detailed shaping (nose curvature, airfoil, surface chords) is an
 * engineering approximation for visualisation and is not certified data.
 */

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const g = (t: number, p: number) => Math.pow(1 - Math.pow(1 - clamp01(t), p), 1 / p);

export const DIM = {
  length: 37.57,
  span: 35.8,
  height: 11.76,
  wheelbase: 12.64,
  track: 7.59,
};

// ─── Fuselage ────────────────────────────────────────────────────────────────

export const FUS = {
  L: DIM.length,
  xNose: DIM.length / 2,
  yc: 3.9,
  rh: 2.07,
  rw: 1.975,
};

export interface FuselageSection {
  cy: number;
  rv: number;
  w: number;
  /** Belly fairing blend 0‥1 */
  b: number;
}

/** d = distance aft of the nose tip (0 … L). */
export function fuselageSection(d: number): FuselageSection {
  const { L, yc, rh, rw } = FUS;
  // Nose: upper line rises slower (windshield), lower line faster.
  const fTop = -0.22 + 1.22 * g(d / 7.2, 2.15);
  const fBot = 0.22 + 0.78 * g(d / 5.2, 2.0);
  const fW = g(d / 6.4, 2.05);
  let top = yc + rh * fTop;
  let bottom = yc - rh * fBot;
  let w = rw * fW;

  // Tail cone: strong lower upsweep, gentler upper descent.
  const sB = clamp01((d - 23.2) / (L - 23.2));
  bottom += (rh + 0.84) * Math.pow(sB, 1.65);
  const sT = clamp01((d - 27.5) / (L - 27.5));
  top -= (rh - 1.27) * Math.pow(sT, 1.8);
  const sW = clamp01((d - 24.5) / (L - 24.5));
  w *= 1 - 0.875 * Math.pow(sW, 1.3);

  const b = smoothstep(10.8, 14.2, d) * (1 - smoothstep(22.2, 26.2, d));
  return { cy: (top + bottom) / 2, rv: (top - bottom) / 2, w, b };
}

/**
 * Point on the fuselage skin. θ = 0 at the keel, π/2 starboard, π crown,
 * 3π/2 port.
 */
export function fuselagePoint(d: number, theta: number, offset = 0): [number, number, number] {
  const s = fuselageSection(d);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const lower = Math.max(ct, 0);
  const rv = s.rv + 0.2 * s.b * Math.pow(lower, 1.5) + offset;
  const w = s.w * (1 + 0.12 * s.b * Math.pow(lower, 0.8)) + offset;
  return [FUS.xNose - d, s.cy - rv * ct, w * st];
}

/** θ on the starboard side where the skin reaches height y at station d. */
export function thetaForY(d: number, y: number): number {
  // Monotonic in θ on [0, π] for the starboard side — bisection.
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p = fuselagePoint(d, mid);
    if (p[1] < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const dToX = (d: number) => FUS.xNose - d;
export const xToD = (x: number) => FUS.xNose - x;

// ─── Wing ────────────────────────────────────────────────────────────────────

export const WING = {
  y0: 2.35,
  dihedral: (5.1 * Math.PI) / 180,
  xLE0: 6.7,
  leSweep: 0.52,
  zKink: 6.3,
  zTip: 17.05,
  rootChord: 6.9,
  tipChord: 1.55,
};

export function wingLE(z: number) {
  return WING.xLE0 - WING.leSweep * z;
}

export function wingTE(z: number) {
  const teRoot = WING.xLE0 - WING.rootChord;
  const teKink = teRoot - 0.05 * WING.zKink;
  const teTip = wingLE(WING.zTip) - WING.tipChord;
  if (z <= WING.zKink) return teRoot - 0.05 * z;
  return lerp(teKink, teTip, (z - WING.zKink) / (WING.zTip - WING.zKink));
}

export const wingChord = (z: number) => wingLE(z) - wingTE(z);

export function wingTC(z: number) {
  if (z <= WING.zKink) return lerp(0.152, 0.122, z / WING.zKink);
  return lerp(0.122, 0.108, (z - WING.zKink) / (WING.zTip - WING.zKink));
}

export const wingTwist = (z: number) => (lerp(2.0, -1.0, clamp01(z / WING.zTip)) * Math.PI) / 180;
export const wingY = (z: number) => WING.y0 + z * Math.tan(WING.dihedral);

/** Normalised airfoil: returns [x/c, y/c] for chord fraction f on upper/lower surface. */
export function airfoil(f: number, tc: number, upper: boolean, camber = 1): [number, number] {
  const s = Math.sqrt(Math.max(f, 0));
  const yt = 5 * tc * (0.2969 * s - 0.126 * f - 0.3516 * f * f + 0.2843 * f ** 3 - 0.1036 * f ** 4);
  const yc = camber * 0.045 * f * (1 - f) * (0.5 + f);
  return [f, upper ? yc + yt : yc - yt];
}

export function camberY(f: number, camber = 1) {
  return camber * 0.045 * f * (1 - f) * (0.5 + f);
}

/**
 * Point on the starboard wing at span station z (≥0), chord fraction f.
 * `n` offsets along the local surface normal (approximate, vertical).
 */
export function wingPoint(z: number, f: number, upper: boolean, n = 0): [number, number, number] {
  const c = wingChord(z);
  const [, ya] = airfoil(f, wingTC(z), upper);
  const tw = wingTwist(z);
  // Rotate about 30 % chord for incidence/twist (LE up for positive twist).
  const s = (f - 0.3) * c;
  const h = ya * c + (upper ? n : -n);
  const ct = Math.cos(tw);
  const st = Math.sin(tw);
  const x = wingLE(z) - 0.3 * c - (s * ct + h * st);
  const y = wingY(z) + h * ct - s * st;
  return [x, y, z];
}

/** Camber-line point (mid-thickness) — used for hinge lines. */
export function wingCamberPoint(z: number, f: number): [number, number, number] {
  const u = wingPoint(z, f, true);
  const l = wingPoint(z, f, false);
  return [(u[0] + l[0]) / 2, (u[1] + l[1]) / 2, z];
}

export function wingThickness(z: number, f: number) {
  return wingPoint(z, f, true)[1] - wingPoint(z, f, false)[1];
}

// Trailing-edge and leading-edge device layout (starboard, z ranges).
export const TE_LAYOUT = {
  flapInner: { z0: 2.25, z1: 6.3, hinge: 0.7 },
  flapOuter: { z0: 6.55, z1: 12.75, hinge: 0.72 },
  aileron: { z0: 12.95, z1: 16.05, hinge: 0.75 },
};

export const SPOILERS: { z0: number; z1: number; hinge: number }[] = [
  { z0: 2.55, z1: 4.35, hinge: 0.7 },
  { z0: 4.45, z1: 6.15, hinge: 0.7 },
  { z0: 6.9, z1: 8.75, hinge: 0.72 },
  { z0: 8.85, z1: 10.7, hinge: 0.72 },
  { z0: 10.8, z1: 12.6, hinge: 0.72 },
];

export const SLATS: { z0: number; z1: number }[] = [
  { z0: 2.3, z1: 5.0 },
  { z0: 6.55, z1: 9.0 },
  { z0: 9.1, z1: 11.5 },
  { z0: 11.6, z1: 13.95 },
  { z0: 14.05, z1: 16.4 },
];

export const SLAT_CHORD = 0.13;

// ─── Engines (CFM56-5B) ──────────────────────────────────────────────────────

export const ENGINE = {
  z: 5.755,
  y: 1.58,
  xInlet: 6.4,
};

// ─── Landing gear ────────────────────────────────────────────────────────────

export const GEAR = {
  mainX: 1.15,
  mainZ: DIM.track / 2,
  noseX: 1.15 + DIM.wheelbase,
  mainTireR: 0.584,
  mainTireW: 0.43,
  mainWheelSpacing: 0.93,
  noseTireR: 0.381,
  noseTireW: 0.226,
  noseWheelSpacing: 0.5,
  /** Tyre deflection under load. */
  squash: 0.018,
};

// ─── Empennage ───────────────────────────────────────────────────────────────

export const FIN = {
  rootLE: -11.4,
  rootY: 5.55,
  rootChord: 6.15,
  tipY: DIM.height,
  tipChord: 1.85,
  leSweep: Math.tan((34 * Math.PI) / 180),
  tc: 0.11,
  rudderHinge: 0.7,
};

export const STAB = {
  rootZ: 0.6,
  tipZ: 12.45 / 2,
  rootLE: -13.55,
  rootChord: 3.9,
  tipChord: 1.3,
  leSweep: Math.tan((32 * Math.PI) / 180),
  dihedral: (6 * Math.PI) / 180,
  tc: 0.105,
  elevatorHinge: 0.7,
};

export const stabY = () => fuselageSection(xToD(-15.2)).cy + 0.05;
