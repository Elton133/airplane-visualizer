import * as THREE from "three";
import {
  canvas,
  fbmOverlay,
  heightToNormal,
  packORM,
  rng,
  roundRect,
  toTexture,
  type Ctx,
} from "../texture-kit";
import { FUS, fuselagePoint, thetaForY, WING } from "./layout";

export interface PBRSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

const PAINT = "#e9eae8";
const CHARCOAL = "#2a2c2f";

// ─── Fuselage livery ─────────────────────────────────────────────────────────
// UV: u = d / L (nose → tail), v = θ / 2π (keel → starboard → crown → port).
// Neutral fictional "HANGAR research" livery: white, charcoal details.

type Side = "right" | "left";

export function fuselageTextures(res: number): PBRSet {
  const W = res;
  const H = Math.round(res * 0.34);
  const col = canvas(W, H, PAINT);
  const hgt = canvas(W, H, "#808080");
  const rgh = canvas(W, H, "#585858"); // ≈0.35 roughness

  const U = (d: number) => (d / FUS.L) * W;
  const Vt = (theta: number) => (1 - theta / (Math.PI * 2)) * H;
  const th = (side: Side, d: number, y: number) => {
    const t = thetaForY(d, y);
    return side === "right" ? t : Math.PI * 2 - t;
  };
  const pxPerM = W / FUS.L;

  // Subtle large-scale paint variation, slightly darker belly.
  fbmOverlay(col.x, W, H, { seed: 11, octaves: 4, base: 5, alpha: 0.05, mode: "multiply" });
  fbmOverlay(rgh.x, W, H, { seed: 23, octaves: 5, base: 8, alpha: 0.22, mode: "overlay" });
  {
    const g = col.x.createLinearGradient(0, 0, 0, H);
    // v = 0 (keel) at canvas bottom, v = 1 (keel again) at top.
    g.addColorStop(0, "rgba(70,66,60,0.10)");
    g.addColorStop(0.12, "rgba(70,66,60,0.0)");
    g.addColorStop(0.88, "rgba(70,66,60,0.0)");
    g.addColorStop(1, "rgba(70,66,60,0.10)");
    col.x.fillStyle = g;
    col.x.fillRect(0, 0, W, H);
  }

  const groove = (x: Ctx, w: number) => {
    x.strokeStyle = "#5c5c5c";
    x.lineWidth = w;
  };

  // Radome joint and circumferential skin joints.
  const frames = [1.72, 4.65, 7.1, 9.85, 12.3, 14.9, 17.05, 19.45, 21.95, 24.4, 26.85, 29.1, 31.55, 33.9, 35.9];
  for (const d of frames) {
    for (const [x, w, s] of [
      [hgt.x, 2, "#5a5a5a"],
      [col.x, 1.2, "rgba(120,124,128,0.35)"],
    ] as const) {
      x.strokeStyle = s;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(U(d), 0);
      x.lineTo(U(d), H);
      x.stroke();
    }
  }
  // Longitudinal lap joints.
  const laps = [0.62, 1.2, 2.18, 2.66];
  for (const t of laps) {
    for (const theta of [t, Math.PI * 2 - t]) {
      for (const [x, w, s] of [
        [hgt.x, 1.6, "#606060"],
        [col.x, 1, "rgba(120,124,128,0.22)"],
      ] as const) {
        x.strokeStyle = s;
        x.lineWidth = w;
        x.beginPath();
        x.moveTo(U(2.5), Vt(theta));
        x.lineTo(U(34.5), Vt(theta));
        x.stroke();
      }
    }
  }
  // Rivet rows along joints (height only, very faint).
  hgt.x.fillStyle = "#737373";
  const rivetStep = Math.max(2.5, pxPerM * 0.045);
  for (const d of frames) {
    for (const off of [-0.035, 0.035]) {
      for (let py = 0; py < H; py += rivetStep) hgt.x.fillRect(U(d + off) - 0.6, py, 1.2, 1.2);
    }
  }

  // Radome: slightly different white and roughness.
  col.x.fillStyle = "rgba(228,228,224,1)";
  col.x.fillRect(0, 0, U(1.72), H);
  rgh.x.fillStyle = "#6a6a6a";
  rgh.x.fillRect(0, 0, U(1.72), H);

  const panel = (
    side: Side,
    d0: number,
    d1: number,
    y0: number,
    y1: number,
    r: number,
    opts: { fill?: string; gap?: boolean; rough?: string; recess?: string; line?: string } = {},
  ) => {
    const dm = (d0 + d1) / 2;
    const ta = th(side, dm, y0);
    const tb = th(side, dm, y1);
    const cx = (U(d0) + U(d1)) / 2;
    const cy = (Vt(ta) + Vt(tb)) / 2;
    const w = U(d1) - U(d0);
    const h = Math.abs(Vt(ta) - Vt(tb));
    const rp = r * pxPerM;
    if (opts.fill) {
      roundRect(col.x, cx, cy, w, h, rp);
      col.x.fillStyle = opts.fill;
      col.x.fill();
    }
    if (opts.recess) {
      roundRect(hgt.x, cx, cy, w, h, rp);
      hgt.x.fillStyle = opts.recess;
      hgt.x.fill();
    }
    if (opts.rough) {
      roundRect(rgh.x, cx, cy, w, h, rp);
      rgh.x.fillStyle = opts.rough;
      rgh.x.fill();
    }
    if (opts.gap) {
      roundRect(hgt.x, cx, cy, w, h, rp);
      groove(hgt.x, 3);
      hgt.x.stroke();
      roundRect(col.x, cx, cy, w, h, rp);
      col.x.strokeStyle = opts.line ?? "rgba(70,74,78,0.75)";
      col.x.lineWidth = 1.6;
      col.x.stroke();
    }
    return { cx, cy, w, h };
  };

  const text = (
    side: Side,
    d: number,
    y: number,
    str: string,
    sizeM: number,
    opts: { color?: string; weight?: number; tracking?: number; align?: CanvasTextAlign } = {},
  ) => {
    const theta = th(side, d, y);
    const px = U(d);
    const py = Vt(theta);
    const x = col.x;
    x.save();
    x.translate(px, py);
    // See layout notes: starboard reads mirrored in u, port is flipped in v.
    if (side === "right") x.scale(-1, 1);
    else x.scale(1, -1);
    x.fillStyle = opts.color ?? CHARCOAL;
    x.font = `${opts.weight ?? 600} ${sizeM * pxPerM}px "Geist", "Inter", "Helvetica Neue", Arial, sans-serif`;
    x.textAlign = opts.align ?? "center";
    x.textBaseline = "middle";
    if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = `${(opts.tracking ?? 0) * pxPerM}px`;
    x.fillText(str, 0, 0);
    x.restore();
  };

  const yc = FUS.yc;
  for (const side of ["right", "left"] as const) {
    // Cockpit window surround (glass meshes sit on top of this).
    // Cabin windows: 21-inch pitch.
    const exits = [16.95, 17.85];
    for (let d = 7.25; d < 29.6; d += 0.533) {
      const nearExit = exits.some((e) => Math.abs(d - e - 0.27) < 0.3);
      if (nearExit) continue;
      panel(side, d - 0.118, d + 0.118, yc + 0.12, yc + 0.48, 0.07, {
        fill: "#9fa3a6",
        recess: "#6a6a6a",
        rough: "#2a2a2a",
      });
      panel(side, d - 0.093, d + 0.093, yc + 0.15, yc + 0.45, 0.06, { fill: "#101316", recess: "#4a4a4a", rough: "#141414" });
    }
    // Passenger doors (L1/R1, L2/R2).
    for (const d of [5.55, 30.55]) {
      const r = panel(side, d - 0.405, d + 0.405, yc - 0.82, yc + 1.05, 0.14, { gap: true });
      // door window
      panel(side, d - 0.1, d + 0.1, yc + 0.18, yc + 0.48, 0.06, { fill: "#101316", recess: "#4a4a4a", rough: "#141414" });
      // handle recess
      panel(side, d + 0.12, d + 0.3, yc - 0.15, yc - 0.05, 0.02, { fill: "rgba(80,84,88,0.8)", recess: "#5a5a5a" });
      void r;
    }
    // Overwing emergency exits, each with one window.
    for (const d of exits) {
      panel(side, d, d + 0.51, yc - 0.42, yc + 0.6, 0.12, { gap: true });
      panel(side, d + 0.14, d + 0.37, yc + 0.12, yc + 0.48, 0.07, { fill: "#9fa3a6", recess: "#6a6a6a", rough: "#2a2a2a" });
      panel(side, d + 0.163, d + 0.347, yc + 0.15, yc + 0.45, 0.06, { fill: "#101316", recess: "#4a4a4a", rough: "#141414" });
      text(side, d + 0.255, yc + 0.72, "EXIT", 0.07, { weight: 600, color: "#7d2a22" });
    }
    // Service / avionics access and static-port plates near the nose.
    panel(side, 3.1, 3.42, yc - 0.55, yc - 0.32, 0.03, { gap: true, line: "rgba(80,84,88,0.5)" });
    panel(side, 4.0, 4.16, yc - 0.12, yc + 0.02, 0.01, { fill: "rgba(160,162,164,1)", rough: "#1e1e1e" });

    // Identification: small HANGAR wordmark and fictional registration.
    text(side, 9.2, yc + 1.05, "HANGAR", 0.42, { weight: 600, tracking: 0.08 });
    text(side, 9.2, yc + 0.72, "RESEARCH  /  A320-001", 0.11, { weight: 500, tracking: 0.03, color: "#55585c" });
    text(side, 32.4, yc + 0.6, "HGR-001", 0.32, { weight: 600, tracking: 0.04 });
  }
  // Cargo doors (starboard, lower).
  for (const d of [9.0, 23.8]) panel("right", d - 0.9, d + 0.9, 2.05, 3.25, 0.1, { gap: true });

  // Cockpit window surrounds: a charcoal mask under the glass.
  for (const side of ["right", "left"] as const) {
    for (const w of COCKPIT_WINDOWS) {
      const pts = windowOutline(w, side, 0.03);
      col.x.beginPath();
      pts.forEach(([d, t], i) => (i ? col.x.lineTo(U(d), Vt(t)) : col.x.moveTo(U(d), Vt(t))));
      col.x.closePath();
      col.x.fillStyle = "#1b1d1f";
      col.x.fill();
      rgh.x.beginPath();
      pts.forEach(([d, t], i) => (i ? rgh.x.lineTo(U(d), Vt(t)) : rgh.x.moveTo(U(d), Vt(t))));
      rgh.x.closePath();
      rgh.x.fillStyle = "#3a3a3a";
      rgh.x.fill();
    }
  }

  // Very light streaks aft of drain masts / gear bays (maintained aircraft).
  {
    const r = rng(7);
    col.x.save();
    col.x.globalCompositeOperation = "multiply";
    for (let i = 0; i < 26; i++) {
      const d = 12 + r() * 16;
      const theta = (r() < 0.5 ? 1 : -1) * (0.15 + r() * 0.45);
      const t = theta < 0 ? Math.PI * 2 + theta : theta;
      const len = (0.6 + r() * 2.2) * pxPerM;
      const g = col.x.createLinearGradient(U(d), 0, U(d) + len, 0);
      g.addColorStop(0, "rgba(150,140,128,0.14)");
      g.addColorStop(1, "rgba(150,140,128,0)");
      col.x.fillStyle = g;
      col.x.fillRect(U(d), Vt(t) - 1.5, len, 3 + r() * 4);
    }
    col.x.restore();
  }

  const normal = heightToNormal(hgt.c, 2.2, false);
  const orm = packORM(rgh.c);
  return {
    map: toTexture(col.c, { srgb: true, wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 }),
    normalMap: toTexture(normal, { wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 }),
    roughnessMap: toTexture(orm, { wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 }),
  };
}

// ─── Cockpit windows (shared by texture mask and glass meshes) ──────────────

export interface WindowShape {
  d0: number;
  d1: number;
  /** Lower / upper edge heights at d0 and d1. */
  yLow: [number, number];
  yHigh: [number, number];
  /** Optional θ clamp towards the crown (front windshield centre post). */
  crownGap?: number;
}

export const COCKPIT_WINDOWS: WindowShape[] = [
  // Front windshield panel
  { d0: 1.95, d1: 2.9, yLow: [4.56, 4.62], yHigh: [5.0, 5.36], crownGap: 0.045 },
  // Side window 2 (sliding)
  { d0: 3.04, d1: 3.86, yLow: [4.6, 4.62], yHigh: [5.16, 5.32] },
  // Side window 3
  { d0: 3.96, d1: 4.5, yLow: [4.63, 4.66], yHigh: [5.28, 5.12] },
];

/** θ range of a window at station d on the starboard side. */
export function windowTheta(w: WindowShape, d: number): [number, number] {
  const t = (d - w.d0) / (w.d1 - w.d0);
  const yl = w.yLow[0] + (w.yLow[1] - w.yLow[0]) * t;
  const yh = w.yHigh[0] + (w.yHigh[1] - w.yHigh[0]) * t;
  const ta = thetaForY(d, yl);
  let tb = thetaForY(d, yh);
  if (w.crownGap !== undefined) tb = Math.min(tb, Math.PI - w.crownGap);
  return [ta, tb];
}

/** Window outline as (d, θ) points, optionally grown by `grow` metres. */
export function windowOutline(w: WindowShape, side: Side, grow = 0): [number, number][] {
  const pts: [number, number][] = [];
  const n = 10;
  const g = grow / 2.0; // ≈ radians per metre at r ≈ 2 m
  const d0 = w.d0 - grow;
  const d1 = w.d1 + grow;
  const ws: WindowShape = { ...w, d0: w.d0, d1: w.d1 };
  for (let i = 0; i <= n; i++) {
    const d = d0 + ((d1 - d0) * i) / n;
    const dc = Math.min(Math.max(d, w.d0), w.d1);
    pts.push([d, windowTheta(ws, dc)[0] - g]);
  }
  for (let i = n; i >= 0; i--) {
    const d = d0 + ((d1 - d0) * i) / n;
    const dc = Math.min(Math.max(d, w.d0), w.d1);
    const tb = windowTheta(ws, dc)[1];
    pts.push([d, w.crownGap !== undefined ? Math.min(tb + g, Math.PI - w.crownGap * 0.5) : tb + g]);
  }
  return pts.map(([d, t]) => [d, side === "right" ? t : Math.PI * 2 - t]);
}

// ─── Wing ────────────────────────────────────────────────────────────────────
// UV: u = z / zTip, v = 0.5 (1 − f) on the upper surface, 0.5 + 0.5 f lower.

export function wingTextures(res: number): PBRSet {
  const W = res;
  const H = res / 2;
  const col = canvas(W, H, "#c4c7c9");
  const hgt = canvas(W, H, "#808080");
  const rgh = canvas(W, H, "#707070");
  fbmOverlay(col.x, W, H, { seed: 41, octaves: 4, base: 6, alpha: 0.06, mode: "multiply" });
  fbmOverlay(rgh.x, W, H, { seed: 43, octaves: 5, base: 10, alpha: 0.25 });

  const U = (z: number) => (z / WING.zTip) * W;
  const Vu = (f: number) => (1 - 0.5 * (1 - f)) * H;
  const Vl = (f: number) => (1 - (0.5 + 0.5 * f)) * H;

  const line = (x0: number, y0: number, x1: number, y1: number, w = 1.4) => {
    hgt.x.strokeStyle = "#5e5e5e";
    hgt.x.lineWidth = w * 1.6;
    hgt.x.beginPath();
    hgt.x.moveTo(x0, y0);
    hgt.x.lineTo(x1, y1);
    hgt.x.stroke();
    col.x.strokeStyle = "rgba(96,100,104,0.35)";
    col.x.lineWidth = w;
    col.x.beginPath();
    col.x.moveTo(x0, y0);
    col.x.lineTo(x1, y1);
    col.x.stroke();
  };

  // Spar lines and skin joints.
  for (const f of [0.15, 0.38, 0.62]) {
    line(U(0), Vu(f), U(17), Vu(f));
    line(U(0), Vl(f), U(17), Vl(f));
  }
  // Rib lines (faint) every ~0.62 m.
  for (let z = 1.9; z < 17; z += 0.62) {
    hgt.x.strokeStyle = "#767676";
    hgt.x.lineWidth = 1;
    hgt.x.beginPath();
    hgt.x.moveTo(U(z), Vu(0.15));
    hgt.x.lineTo(U(z), Vu(0.62));
    hgt.x.stroke();
  }
  // Upper walkway boundary (black lines, inboard).
  col.x.strokeStyle = "rgba(20,20,20,0.85)";
  col.x.lineWidth = Math.max(2, W * 0.0012);
  col.x.strokeRect(U(2.4), Vu(0.55), U(6.2) - U(2.4), Vu(0.2) - Vu(0.55));
  // Lower surface fuel access panels.
  for (let z = 2.6; z < 15.5; z += 0.95) {
    const cx = U(z);
    const cy = Vl(0.42);
    for (const [x, s, w] of [
      [hgt.x, "#5a5a5a", 2],
      [col.x, "rgba(90,94,98,0.45)", 1.2],
    ] as const) {
      x.beginPath();
      x.ellipse(cx, cy, 0.24 * (W / WING.zTip), 0.06 * H, 0, 0, Math.PI * 2);
      x.strokeStyle = s;
      x.lineWidth = w;
      x.stroke();
    }
  }
  const normal = heightToNormal(hgt.c, 2.0, false);
  return {
    map: toTexture(col.c, { srgb: true, wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 }),
    normalMap: toTexture(normal, { wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 }),
    roughnessMap: toTexture(packORM(rgh.c), { wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 }),
  };
}

// ─── Fin / generic charcoal paint ────────────────────────────────────────────

export function charcoalTextures(res: number): PBRSet {
  const W = res;
  const H = res / 2;
  const col = canvas(W, H, CHARCOAL);
  const hgt = canvas(W, H, "#808080");
  const rgh = canvas(W, H, "#5a5a5a");
  fbmOverlay(col.x, W, H, { seed: 61, octaves: 4, base: 5, alpha: 0.05, mode: "soft-light" });
  fbmOverlay(rgh.x, W, H, { seed: 63, octaves: 4, base: 8, alpha: 0.2 });
  for (const f of [0.18, 0.45, 0.68]) {
    for (const v of [0.5 * (1 - f), 0.5 + 0.5 * f]) {
      hgt.x.strokeStyle = "#606060";
      hgt.x.lineWidth = 2;
      hgt.x.beginPath();
      hgt.x.moveTo(0, (1 - v) * H);
      hgt.x.lineTo(W, (1 - v) * H);
      hgt.x.stroke();
    }
  }
  for (let u = 0.12; u < 1; u += 0.16) {
    hgt.x.strokeStyle = "#6a6a6a";
    hgt.x.lineWidth = 1.5;
    hgt.x.beginPath();
    hgt.x.moveTo(u * W, 0);
    hgt.x.lineTo(u * W, H);
    hgt.x.stroke();
  }
  const normal = heightToNormal(hgt.c, 1.6, false);
  return {
    map: toTexture(col.c, { srgb: true, wrap: THREE.ClampToEdgeWrapping }),
    normalMap: toTexture(normal, { wrap: THREE.ClampToEdgeWrapping }),
    roughnessMap: toTexture(packORM(rgh.c), { wrap: THREE.ClampToEdgeWrapping }),
  };
}

// ─── Nacelle cowl ────────────────────────────────────────────────────────────
// UV: u along profile (front → aft), v around (0 = top, 0.5 = bottom).

export function nacelleTextures(res: number): PBRSet {
  const W = res;
  const H = res / 2;
  const col = canvas(W, H, PAINT);
  const hgt = canvas(W, H, "#808080");
  const rgh = canvas(W, H, "#555555");
  fbmOverlay(col.x, W, H, { seed: 81, octaves: 3, base: 4, alpha: 0.05, mode: "multiply" });
  fbmOverlay(rgh.x, W, H, { seed: 83, octaves: 4, base: 8, alpha: 0.2 });
  // Fan cowl / thrust reverser split lines.
  for (const u of [0.1, 0.42, 0.78]) {
    hgt.x.strokeStyle = "#565656";
    hgt.x.lineWidth = 3;
    hgt.x.beginPath();
    hgt.x.moveTo(u * W, 0);
    hgt.x.lineTo(u * W, H);
    hgt.x.stroke();
    col.x.strokeStyle = "rgba(90,94,98,0.4)";
    col.x.lineWidth = 1.5;
    col.x.beginPath();
    col.x.moveTo(u * W, 0);
    col.x.lineTo(u * W, H);
    col.x.stroke();
  }
  // Bottom latch line + latches.
  hgt.x.strokeStyle = "#565656";
  hgt.x.lineWidth = 3;
  hgt.x.beginPath();
  hgt.x.moveTo(0.1 * W, H * 0.5);
  hgt.x.lineTo(W, H * 0.5);
  hgt.x.stroke();
  for (let u = 0.16; u < 0.42; u += 0.07) {
    roundRect(hgt.x, u * W, H * 0.5, W * 0.03, H * 0.02, 2);
    hgt.x.fillStyle = "#606060";
    hgt.x.fill();
  }
  // Small charcoal engine identification band near the front.
  col.x.fillStyle = "rgba(42,44,47,0.92)";
  col.x.fillRect(0.12 * W, 0, W * 0.012, H);
  const normal = heightToNormal(hgt.c, 1.8, true);
  return {
    map: toTexture(col.c, { srgb: true }),
    normalMap: toTexture(normal),
    roughnessMap: toTexture(packORM(rgh.c)),
  };
}

// ─── Hangar concrete floor (12 m tile) ───────────────────────────────────────

export function concreteTextures(res: number): PBRSet & { tileSize: number } {
  const W = res;
  const col = canvas(W, W, "#3b3c3d");
  const hgt = canvas(W, W, "#808080");
  const rgh = canvas(W, W, "#8c8c8c");
  // Sealed concrete: low-contrast mottling, fine aggregate grain.
  fbmOverlay(col.x, W, W, { seed: 101, octaves: 5, base: 3, alpha: 0.07, mode: "overlay" });
  fbmOverlay(col.x, W, W, { seed: 131, octaves: 2, base: 180, alpha: 0.07, mode: "overlay" });
  fbmOverlay(rgh.x, W, W, { seed: 103, octaves: 5, base: 3, alpha: 0.22, mode: "overlay" });
  fbmOverlay(hgt.x, W, W, { seed: 107, octaves: 2, base: 220, alpha: 0.25, mode: "overlay" });
  const r = rng(5);
  // Polished paths where floor scrubbers ran are slightly smoother.
  for (let i = 0; i < 10; i++) {
    const cx = r() * W;
    const cy = r() * W;
    const g = rgh.x.createRadialGradient(cx, cy, 0, cx, cy, W * (0.2 + r() * 0.3));
    g.addColorStop(0, "rgba(40,40,40,0.22)");
    g.addColorStop(1, "rgba(40,40,40,0)");
    rgh.x.fillStyle = g;
    rgh.x.fillRect(0, 0, W, W);
  }
  // Faint tyre marks.
  col.x.save();
  col.x.globalAlpha = 0.035;
  col.x.strokeStyle = "#111";
  for (let i = 0; i < 5; i++) {
    col.x.lineWidth = W * 0.012;
    col.x.beginPath();
    col.x.arc(r() * W, r() * W, W * (0.3 + r() * 0.6), r() * 6, r() * 6 + 0.7);
    col.x.stroke();
  }
  col.x.restore();
  // Saw-cut control joints every 6 m (tile = 12 m).
  for (const p of [0, W / 2]) {
    for (const [x, s, w] of [
      [col.x, "rgba(14,14,14,0.32)", 2],
      [hgt.x, "#5a5a5a", 3],
    ] as const) {
      x.strokeStyle = s;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(p + 1, 0);
      x.lineTo(p + 1, W);
      x.moveTo(0, p + 1);
      x.lineTo(W, p + 1);
      x.stroke();
    }
  }
  const normal = heightToNormal(hgt.c, 1.0, true);
  return {
    map: toTexture(col.c, { srgb: true, anisotropy: 16 }),
    normalMap: toTexture(normal, { anisotropy: 16 }),
    roughnessMap: toTexture(packORM(rgh.c), { anisotropy: 16 }),
    tileSize: 12,
  };
}

/** Corrugated cladding for hangar walls (very dark, read only by light). */
export function claddingTextures(res: number): PBRSet {
  const W = res;
  const col = canvas(W, W, "#1a1b1d");
  const hgt = canvas(W, W);
  const g = hgt.x.createLinearGradient(0, 0, W / 16, 0);
  g.addColorStop(0, "#606060");
  g.addColorStop(0.5, "#a0a0a0");
  g.addColorStop(1, "#606060");
  hgt.x.fillStyle = g;
  for (let i = 0; i < 16; i++) {
    hgt.x.save();
    hgt.x.translate((i * W) / 16, 0);
    hgt.x.fillRect(0, 0, W / 16, W);
    hgt.x.restore();
  }
  fbmOverlay(col.x, W, W, { seed: 151, octaves: 4, base: 4, alpha: 0.2 });
  const rgh = canvas(W, W, "#9a9a9a");
  return {
    map: toTexture(col.c, { srgb: true }),
    normalMap: toTexture(heightToNormal(hgt.c, 3, true)),
    roughnessMap: toTexture(packORM(rgh.c)),
  };
}

export { fuselagePoint };
