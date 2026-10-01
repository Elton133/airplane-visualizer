import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cosSpace, linSpace, loft, revolveX, stations, strut, type P3 } from "../geometry";
import { wheel } from "../parts";
import {
  airfoil,
  DIM,
  ENGINE,
  FIN,
  FUS,
  fuselagePoint,
  GEAR,
  lerp,
  SLAT_CHORD,
  SLATS,
  SPOILERS,
  STAB,
  stabY,
  TE_LAYOUT,
  thetaForY,
  WING,
  wingCamberPoint,
  wingLE,
  wingPoint,
  wingTE,
  wingY,
} from "./layout";
import type { A320Materials } from "./materials";
import { COCKPIT_WINDOWS, windowTheta } from "./textures";

/**
 * Builds the A320 as a node hierarchy whose names follow the conventions a
 * prepared GLB would use. The application only talks to these names through
 * the aircraft definition's component registry.
 */

type Side = 1 | -1; // +1 starboard (R), -1 port (L)
const SIDE_NAME = (s: Side) => (s === 1 ? "R" : "L");

function mesh(name: string, geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

const mirror = (p: P3, s: Side): P3 => [p[0], p[1], p[2] * s];

/** Offset a closed 2D-ish section loop (constant z or constant y) along its in-plane normal. */
function offsetLoop(points: P3[], amount: number, plane: "z" | "y"): P3[] {
  const n = points.length;
  const cx = points.reduce((s, p) => s + p[0], 0) / n;
  const cy = points.reduce((s, p) => s + (plane === "z" ? p[1] : p[2]), 0) / n;
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(n - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = plane === "z" ? b[1] - a[1] : b[2] - a[2];
    let nx = -ty;
    let ny = tx;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const px = p[0] - cx;
    const py = (plane === "z" ? p[1] : p[2]) - cy;
    if (nx * px + ny * py < 0) {
      nx = -nx;
      ny = -ny;
    }
    return plane === "z"
      ? [p[0] + nx * amount, p[1] + ny * amount, p[2]]
      : [p[0] + nx * amount, p[1], p[2] + ny * amount];
  });
}

/**
 * Create a hinge node whose local X axis is the hinge line from A to B and
 * whose positive X rotation moves the trailing edge toward `positive`.
 */
function hingeNode(name: string, A: P3, B: P3, positive: THREE.Vector3, aft = new THREE.Vector3(-1, 0, 0)) {
  const X = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize();
  const Z = aft.clone().sub(X.clone().multiplyScalar(X.dot(aft))).normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X);
  if (Y.dot(positive) > 0) {
    X.negate();
    Y.negate();
  }
  const node = new THREE.Group();
  node.name = name;
  const mat = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(A[0], A[1], A[2]);
  mat.decompose(node.position, node.quaternion, node.scale);
  node.updateMatrix();
  const inv = mat.clone().invert();
  return { node, inv };
}

// ─── Fuselage ────────────────────────────────────────────────────────────────

function buildFuselage(m: A320Materials): THREE.Object3D[] {
  const ds = stations(
    [0, 0.006, 0.02, 0.06, 0.12, 0.22, 0.35, 0.5, 0.7, 0.95],
    linSpace(28, 1.2, 8.2),
    linSpace(16, 8.6, 22.0),
    linSpace(56, 22.4, FUS.L - 0.02),
  );
  const M = 112;
  const sections = ds.map((d) => {
    const ring: P3[] = [];
    for (let j = 0; j < M; j++) ring.push(fuselagePoint(d, (j / M) * Math.PI * 2));
    return ring;
  });
  // Station 0 collapses to the nose tip point, closing the skin.
  const geo = loft(sections, {
    capEnd: true,
    crease: 1.2,
    uv: (_si, pj, i) => [ds[i]! / FUS.L, pj],
  });
  const out: THREE.Object3D[] = [mesh("A320_Fuselage", geo, m.fuselage)];

  // Cockpit glass.
  for (const s of [1, -1] as Side[]) {
    COCKPIT_WINDOWS.forEach((w, wi) => {
      const rows: P3[][] = [];
      for (const d of linSpace(10, w.d0, w.d1)) {
        const [ta, tb] = windowTheta(w, d);
        const row: P3[] = [];
        for (const t of linSpace(10, ta, tb)) row.push(fuselagePoint(d, s === 1 ? t : Math.PI * 2 - t, 0.014));
        rows.push(row);
      }
      out.push(mesh(`A320_Windshield_${SIDE_NAME(s)}_${wi + 1}`, loft(rows, { closed: false, crease: 0 }), m.glass, false));
    });
  }

  // Dark cockpit interior shell + glareshield, seen through the glass.
  {
    const sec: P3[][] = [];
    for (const d of linSpace(14, 1.5, 5.1)) {
      const ring: P3[] = [];
      for (let j = 0; j < 48; j++) ring.push(fuselagePoint(d, (j / 48) * Math.PI * 2, -0.06));
      sec.push(ring);
    }
    out.push(mesh("A320_CockpitInterior", loft(sec, { capStart: true, capEnd: true, crease: 0 }), m.interior, false));
    const gs = new THREE.BoxGeometry(0.9, 0.16, 2.2);
    gs.translate(FUS.xNose - 2.85, 4.42, 0);
    out.push(mesh("A320_CockpitGlareshield", gs, m.dark, false));
  }

  // Pitot probes (three, below the side windows) and AoA vanes.
  const probe = (name: string, d: number, y: number, s: Side, len = 0.17) => {
    const t = thetaForY(d, y);
    const base = fuselagePoint(d, s === 1 ? t : Math.PI * 2 - t);
    const tip: P3 = [base[0], base[1], base[2] + s * len];
    const g1 = strut(base, tip, 0.016, 10);
    const g2 = strut([tip[0] + 0.02, tip[1], tip[2]], [tip[0] + 0.2, tip[1], tip[2]], 0.011, 10);
    return mesh(name, mergeGeometries([g1, g2])!, m.chrome);
  };
  out.push(probe("A320_Pitot_L", 2.75, 3.62, -1));
  out.push(probe("A320_Pitot_R", 2.75, 3.62, 1));
  out.push(probe("A320_Pitot_Standby", 3.25, 3.2, -1, 0.15));

  // Antennas: VHF blades top and bottom, ATC/TCAS.
  const blade = (name: string, d: number, theta: number, h: number, chord: number) => {
    const base = fuselagePoint(d, theta);
    const up = theta > Math.PI / 2 ? 1 : -1;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-chord, 0);
    shape.lineTo(-chord * 0.75, h * up);
    shape.lineTo(-chord * 0.35, h * up);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
    g.translate(base[0] + chord / 2, base[1] - 0.02 * up, base[2] - 0.0125);
    return mesh(name, g, m.antenna);
  };
  out.push(blade("A320_Antenna_VHF1", 11.5, Math.PI, 0.42, 0.55));
  out.push(blade("A320_Antenna_VHF2", 13.0, 0.0001, 0.32, 0.45));
  out.push(blade("A320_Antenna_ATC", 6.4, Math.PI, 0.16, 0.18));

  // Beacons (red, top and bottom).
  for (const [name, d, t] of [
    ["A320_Beacon_Top", 17.6, Math.PI],
    ["A320_Beacon_Bottom", 15.2, 0.0001],
  ] as const) {
    const p = fuselagePoint(d, t);
    const g = new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    if (t < 1) g.rotateX(Math.PI);
    g.translate(p[0], p[1], p[2]);
    out.push(mesh(name, g, m.lensRed, false));
  }

  // APU exhaust and tail light at the tail cone.
  {
    const p = fuselagePoint(FUS.L - 0.02, 0);
    const top = fuselagePoint(FUS.L - 0.02, Math.PI);
    const cy = (p[1] + top[1]) / 2;
    const g = new THREE.CylinderGeometry(0.15, 0.16, 0.18, 24, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(FUS.xNose - FUS.L - 0.05, cy, 0);
    out.push(mesh("A320_APU_Exhaust", g, m.exhaust));
    const d = new THREE.CircleGeometry(0.15, 24);
    d.rotateY(-Math.PI / 2);
    d.translate(FUS.xNose - FUS.L - 0.03, cy, 0);
    out.push(mesh("A320_APU_Duct", d, m.dark, false));
  }
  return out;
}

// ─── Lifting surfaces ────────────────────────────────────────────────────────

interface Planform {
  /** Point on the surface at span station `z` (≥0), chord fraction f. */
  point: (z: number, f: number, upper: boolean) => P3;
  camber: (z: number, f: number) => P3;
  /** Span coordinate for UVs (0‥1). */
  u: (z: number) => number;
}

const WING_PF: Planform = {
  point: (z, f, up) => wingPoint(z, f, up),
  camber: wingCamberPoint,
  u: (z) => z / WING.zTip,
};

/** Airfoil loop TE→LE (upper) → TE (lower), clipped to [0, fRear]. */
function airfoilLoop(pf: Planform, z: number, fRear: number, n = 30): { pts: P3[]; v: number[] } {
  const fs = cosSpace(n, 0, fRear);
  const pts: P3[] = [];
  const v: number[] = [];
  for (let i = fs.length - 1; i >= 0; i--) {
    pts.push(pf.point(z, fs[i]!, true));
    v.push(0.5 * (1 - fs[i]!));
  }
  for (let i = 1; i < fs.length; i++) {
    pts.push(pf.point(z, fs[i]!, false));
    v.push(0.5 + 0.5 * fs[i]!);
  }
  return { pts, v };
}

function surfaceSegment(pf: Planform, z0: number, z1: number, fRear: (z: number) => number, extraZ: number[] = [], step = 0.7) {
  const zs = stations(linSpace(Math.max(1, Math.ceil((z1 - z0) / step)), z0, z1), extraZ.filter((z) => z > z0 && z < z1));
  const loops = zs.map((z) => airfoilLoop(pf, z, fRear(z)));
  return loft(
    loops.map((l) => l.pts),
    {
      capStart: true,
      capEnd: true,
      crease: 0.75,
      uv: (_si, _pj, i, j) => [pf.u(zs[i]!), loops[i]!.v[j] ?? 0],
    },
  );
}

/** Trailing-edge surface (flap / aileron / elevator / rudder) with a rounded nose at the hinge. */
function trailingSurface(pf: Planform, z0: number, z1: number, hinge: number, gap = 0.012) {
  const zs = linSpace(Math.max(2, Math.ceil((z1 - z0) / 0.6)), z0, z1);
  const nS = 12;
  const nArc = 10;
  const loops = zs.map((z) => {
    const fs = linSpace(nS, hinge + gap, 1);
    const pts: P3[] = [];
    const v: number[] = [];
    for (let i = fs.length - 1; i >= 1; i--) {
      pts.push(pf.point(z, fs[i]!, true));
      v.push(0.5 * (1 - fs[i]!));
    }
    // Rounded nose about the hinge line.
    const up = pf.point(z, hinge + gap, true);
    const lo = pf.point(z, hinge + gap, false);
    const c = pf.camber(z, hinge);
    const te = pf.point(z, 1, true);
    const fwd = new THREE.Vector3(c[0] - te[0], c[1] - te[1], c[2] - te[2]).normalize();
    const nrm = new THREE.Vector3(up[0] - lo[0], up[1] - lo[1], up[2] - lo[2]);
    const r = nrm.length() / 2;
    nrm.normalize();
    // Re-orthogonalise the thickness direction against the chord.
    nrm.sub(fwd.clone().multiplyScalar(nrm.dot(fwd))).normalize();
    for (let k = 0; k <= nArc; k++) {
      const a = Math.PI / 2 - (Math.PI * k) / nArc;
      const p = new THREE.Vector3(...c)
        .addScaledVector(fwd, Math.cos(a) * r * 0.95)
        .addScaledVector(nrm, Math.sin(a) * r * 0.95);
      pts.push([p.x, p.y, p.z]);
      v.push(0.5 * (1 - hinge));
    }
    for (let i = 1; i < fs.length; i++) {
      pts.push(pf.point(z, fs[i]!, false));
      v.push(0.5 + 0.5 * fs[i]!);
    }
    return { pts, v };
  });
  return loft(
    loops.map((l) => l.pts),
    { capStart: true, capEnd: true, crease: 0.8, uv: (_si, _pj, i, j) => [pf.u(zs[i]!), loops[i]!.v[j] ?? 0] },
  );
}

function mirrorGeometry(geo: THREE.BufferGeometry, s: Side, axis: "z" | "y" = "z") {
  if (s === 1) return geo;
  const g = geo.clone();
  g.scale(1, axis === "y" ? -1 : 1, axis === "z" ? -1 : 1);
  // Scaling by -1 inverts winding; re-flip (non-indexed after creasing).
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!g.index) {
    for (let i = 0; i < pos.count; i += 3) {
      for (const attr of [pos, nrm, uv]) {
        if (!attr) continue;
        for (let k = 0; k < attr.itemSize; k++) {
          const a = attr.getComponent(i + 1, k);
          attr.setComponent(i + 1, k, attr.getComponent(i + 2, k));
          attr.setComponent(i + 2, k, a);
        }
      }
    }
  } else {
    const idx = g.index.array as Uint32Array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]!;
      idx[i + 1] = idx[i + 2]!;
      idx[i + 2] = t;
    }
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  return g;
}

/** Wrap a surface geometry (authored in aircraft space) in a hinge node. */
function rigged(
  name: string,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  A: P3,
  B: P3,
  positive: THREE.Vector3,
  aft?: THREE.Vector3,
): THREE.Group {
  const { node, inv } = hingeNode(`${name}_Hinge`, A, B, positive, aft);
  geo.applyMatrix4(inv);
  node.add(mesh(name, geo, mat));
  return node;
}

function buildWing(s: Side, m: A320Materials): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const S = SIDE_NAME(s);
  const { flapInner, flapOuter, aileron } = TE_LAYOUT;
  const segs: [number, number, number][] = [
    [0.05, flapInner.z0, 1],
    [flapInner.z0, flapInner.z1, flapInner.hinge],
    [flapInner.z1, flapOuter.z0, 1],
    [flapOuter.z0, flapOuter.z1, flapOuter.hinge],
    [flapOuter.z1, aileron.z0, 1],
    [aileron.z0, aileron.z1, aileron.hinge],
    [aileron.z1, WING.zTip, 1],
  ];
  const parts = segs.map(([z0, z1, f]) => surfaceSegment(WING_PF, z0, z1, () => f, [WING.zKink, ENGINE.z]));
  const wingGeo = mergeGeometries(parts)!;
  out.push(mesh(`A320_Wing_${S}`, mirrorGeometry(wingGeo, s), m.wing));

  const down = new THREE.Vector3(0, -1, 0);
  const hingeAB = (z0: number, z1: number, f: number): [P3, P3] => [
    mirror(wingCamberPoint(z0, f), s),
    mirror(wingCamberPoint(z1, f), s),
  ];

  // Flaps and aileron.
  for (const [name, seg] of [
    [`A320_Flap_${S}_Inner`, flapInner],
    [`A320_Flap_${S}_Outer`, flapOuter],
    [`A320_Aileron_${S}`, aileron],
  ] as const) {
    const geo = mirrorGeometry(trailingSurface(WING_PF, seg.z0 + 0.03, seg.z1 - 0.03, seg.hinge), s);
    const [A, B] = hingeAB(seg.z0, seg.z1, seg.hinge);
    out.push(rigged(name, geo, m.wing, A, B, down));
  }

  // Spoilers: thin panels on the upper surface, hinged at their leading edge.
  SPOILERS.forEach((sp, i) => {
    const fa = sp.hinge - 0.16;
    const fb = sp.hinge + 0.03;
    const zs = linSpace(4, sp.z0, sp.z1);
    const loops = zs.map((z) => {
      const top = linSpace(8, fa, fb).map((f) => wingPoint(z, f, true));
      const outer = offsetLoopOpen(top, 0.007);
      const inner = offsetLoopOpen(top, -0.03).reverse();
      return [...outer, ...inner];
    });
    const geo = mirrorGeometry(
      loft(loops, { capStart: true, capEnd: true, crease: 0.7, uv: (si, pj) => [lerp(sp.z0, sp.z1, si) / WING.zTip, 0.5 * (1 - lerp(fb, fa, pj))] }),
      s,
    );
    const A = mirror(wingPoint(sp.z0, fa, true, -0.012), s);
    const B = mirror(wingPoint(sp.z1, fa, true, -0.012), s);
    out.push(rigged(`A320_Spoiler_${S}_${i + 1}`, geo, m.wing, A, B, down));
  });

  // Leading-edge slats: shells wrapped over the fixed leading edge.
  SLATS.forEach((sl, i) => {
    const zs = linSpace(Math.max(2, Math.ceil((sl.z1 - sl.z0) / 0.6)), sl.z0, sl.z1);
    const loops = zs.map((z) => {
      const fs = cosSpace(12, 0, SLAT_CHORD);
      const base: P3[] = [];
      for (let k = fs.length - 1; k >= 0; k--) base.push(wingPoint(z, fs[k]!, true));
      for (let k = 1; k < fs.length; k++) base.push(wingPoint(z, fs[k]!, false));
      const outer = offsetLoop(base, 0.009, "z");
      const inner = offsetLoop(base, -0.035, "z").reverse();
      return [...outer, ...inner];
    });
    const geo = mirrorGeometry(
      loft(loops, { capStart: true, capEnd: true, crease: 0.8, uv: (si, pj) => [lerp(sl.z0, sl.z1, si) / WING.zTip, 0.5 + (pj - 0.5) * 0.12] }),
      s,
    );
    const A = mirror(wingPoint(sl.z0, 0.0, true), s);
    const B = mirror(wingPoint(sl.z1, 0.0, true), s);
    out.push(rigged(`A320_Slat_${S}_${i + 1}`, geo, m.wing, A, B, down));
  });

  // Sharklet.
  out.push(mesh(`A320_Sharklet_${S}`, mirrorGeometry(buildSharklet(), s), m.charcoal));

  // Navigation light lens at the wingtip leading edge (red port, green starboard).
  {
    const g = new THREE.SphereGeometry(0.075, 16, 10);
    g.scale(1.6, 0.8, 1);
    const p = wingPoint(WING.zTip - 0.06, 0.02, true);
    g.translate(p[0] + 0.02, p[1] - 0.04, p[2] * s);
    out.push(mesh(`A320_NavLight_${S}`, g, s === 1 ? m.lensGreen : m.lensRed, false));
  }
  return out;
}

/** Open polyline offset along the upper-surface normal (constant z). */
function offsetLoopOpen(pts: P3[], amount: number): P3[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    // Points run aft (−x); the outward normal of the upper surface is up.
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const l = Math.hypot(nx, ny) || 1;
    return [p[0] + (nx / l) * amount, p[1] + (ny / l) * amount, p[2]];
  });
}

function buildSharklet(): THREE.BufferGeometry {
  const zt = WING.zTip;
  const yt = wingY(zt);
  const R = 0.55;
  const phiEnd = (82 * Math.PI) / 180;
  const arcLen = R * phiEnd;
  const L2 = (2.43 - R * (1 - Math.cos(phiEnd))) / Math.sin(phiEnd);
  const total = arcLen + L2;
  const N = 22;
  const leTip = wingLE(zt);
  const chordTip = leTip - wingTE(zt);
  const sections: P3[][] = [];
  const us: number[] = [];
  for (let i = 0; i <= N; i++) {
    const sLen = (total * i) / N;
    let z: number;
    let y: number;
    let phi: number;
    if (sLen <= arcLen) {
      phi = sLen / R;
      z = zt + R * Math.sin(phi);
      y = yt + R * (1 - Math.cos(phi));
    } else {
      phi = phiEnd;
      const l = sLen - arcLen;
      z = zt + R * Math.sin(phiEnd) + l * Math.cos(phiEnd);
      y = yt + R * (1 - Math.cos(phiEnd)) + l * Math.sin(phiEnd);
    }
    const t = sLen / total;
    const chord = sLen <= arcLen ? lerp(chordTip, 1.2, sLen / arcLen) : lerp(1.2, 0.4, (sLen - arcLen) / L2);
    const le = leTip - 0.92 * sLen;
    const tc = lerp(0.108, 0.085, t);
    const nY = Math.cos(phi);
    const nZ = -Math.sin(phi);
    const loop: P3[] = [];
    const fs = cosSpace(26, 0, 1);
    for (let k = fs.length - 1; k >= 0; k--) {
      const [, a] = airfoil(fs[k]!, tc, true, 0.6);
      loop.push([le - fs[k]! * chord, y + a * chord * nY, z + a * chord * nZ]);
    }
    for (let k = 1; k < fs.length; k++) {
      const [, a] = airfoil(fs[k]!, tc, false, 0.6);
      loop.push([le - fs[k]! * chord, y + a * chord * nY, z + a * chord * nZ]);
    }
    sections.push(loop);
    us.push(t);
  }
  return loft(sections, { capEnd: true, crease: 0.8, uv: (si, pj) => [si, pj] });
}

function buildEmpennage(m: A320Materials): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  // Vertical stabiliser: planform runs along +Y. Map "span" coordinate h → y,
  // thickness → z. "Upper" surface = starboard side.
  const finY0 = 4.7;
  const finChord = (y: number) => lerp(FIN.rootChord, FIN.tipChord, (y - FIN.rootY) / (FIN.tipY - FIN.rootY));
  const finLE = (y: number) => FIN.rootLE - (y - FIN.rootY) * FIN.leSweep;
  const FIN_PF: Planform = {
    point: (h, f, up) => {
      const [, a] = airfoil(f, FIN.tc, up, 0);
      const c = finChord(h);
      return [finLE(h) - f * c, h, a * c];
    },
    camber: (h, f) => [finLE(h) - f * finChord(h), h, 0],
    u: (h) => (h - finY0) / (FIN.tipY - finY0),
  };
  const rudY0 = 5.85;
  const rudY1 = 11.45;
  const fin = mergeGeometries([
    surfaceSegment(FIN_PF, finY0, rudY0, () => 1),
    surfaceSegment(FIN_PF, rudY0, rudY1, () => FIN.rudderHinge),
    surfaceSegment(FIN_PF, rudY1, FIN.tipY, () => 1),
  ])!;
  out.push(mesh("A320_Fin", fin, m.charcoal));
  out.push(
    rigged(
      "A320_Rudder",
      trailingSurface(FIN_PF, rudY0 + 0.03, rudY1 - 0.03, FIN.rudderHinge),
      m.charcoal,
      FIN_PF.camber(rudY0, FIN.rudderHinge),
      FIN_PF.camber(rudY1, FIN.rudderHinge),
      new THREE.Vector3(0, 0, 1),
    ),
  );

  // Horizontal stabilisers.
  const y0 = stabY();
  const chord = (z: number) => lerp(STAB.rootChord, STAB.tipChord, (z - STAB.rootZ) / (STAB.tipZ - STAB.rootZ));
  const le = (z: number) => STAB.rootLE - (z - STAB.rootZ) * STAB.leSweep;
  const STAB_PF: Planform = {
    point: (z, f, up) => {
      const [, a] = airfoil(f, STAB.tc, up, -0.4);
      const c = chord(z);
      return [le(z) - f * c, y0 + z * Math.tan(STAB.dihedral) + a * c, z];
    },
    camber: (z, f) => {
      const u = STAB_PF.point(z, f, true);
      const l = STAB_PF.point(z, f, false);
      return [(u[0] + l[0]) / 2, (u[1] + l[1]) / 2, z];
    },
    u: (z) => z / STAB.tipZ,
  };
  const elZ0 = 1.25;
  const elZ1 = 6.0;
  for (const s of [1, -1] as Side[]) {
    const S = SIDE_NAME(s);
    const stab = mergeGeometries([
      surfaceSegment(STAB_PF, 0.25, elZ0, () => 1),
      surfaceSegment(STAB_PF, elZ0, elZ1, () => STAB.elevatorHinge),
      surfaceSegment(STAB_PF, elZ1, STAB.tipZ, () => 1),
    ])!;
    out.push(mesh(`A320_Stab_${S}`, mirrorGeometry(stab, s), m.wing));
    const geo = mirrorGeometry(trailingSurface(STAB_PF, elZ0 + 0.03, elZ1 - 0.03, STAB.elevatorHinge), s);
    out.push(
      rigged(
        `A320_Elevator_${S}`,
        geo,
        m.wing,
        mirror(STAB_PF.camber(elZ0, STAB.elevatorHinge), s),
        mirror(STAB_PF.camber(elZ1, STAB.elevatorHinge), s),
        new THREE.Vector3(0, -1, 0),
      ),
    );
  }
  // Tail navigation light.
  {
    const g = new THREE.SphereGeometry(0.06, 12, 8);
    const p = fuselagePoint(FUS.L - 0.4, Math.PI);
    g.translate(p[0], p[1] + 0.02, 0);
    out.push(mesh("A320_TailLight", g, m.lensClear, false));
  }
  return out;
}

// ─── Engines (CFM56-5B) ──────────────────────────────────────────────────────

function buildEngine(s: Side, m: A320Materials): THREE.Group {
  const S = SIDE_NAME(s);
  const g = new THREE.Group();
  g.name = `A320_Engine_${S}`;
  g.position.set(ENGINE.xInlet, ENGINE.y, ENGINE.z * s);

  const seg = 72;
  const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
    const mm = mesh(`A320_Engine_${S}_${name}`, geo, mat, shadow);
    g.add(mm);
    return mm;
  };
  add(
    "Duct",
    revolveX(
      [
        [-0.64, 0.87],
        [-0.45, 0.874],
        [-0.25, 0.884],
        [-0.08, 0.905],
      ],
      seg,
      { flip: true },
    ),
    m.liner,
    false,
  );
  add(
    "Lip",
    revolveX(
      [
        [-0.08, 0.905],
        [-0.03, 0.914],
        [-0.005, 0.93],
        [0.0, 0.948],
        [-0.008, 0.968],
        [-0.035, 0.986],
        [-0.1, 1.0],
        [-0.28, 1.022],
      ],
      seg,
      { flip: true, crease: 1.2 },
    ),
    m.lip,
  );
  add(
    "Cowl",
    revolveX(
      [
        [-0.28, 1.022],
        [-0.6, 1.042],
        [-0.95, 1.05],
        [-1.4, 1.04],
        [-1.9, 1.01],
        [-2.4, 0.962],
        [-2.8, 0.905],
        [-3.0, 0.872],
        [-2.97, 0.852],
        [-2.6, 0.838],
        [-2.2, 0.84],
      ],
      seg,
      { flip: true, crease: 1.0 },
    ),
    m.nacelle,
  );
  add(
    "Core",
    revolveX(
      [
        [-0.95, 0.38],
        [-1.6, 0.54],
        [-2.5, 0.655],
        [-3.0, 0.625],
        [-3.5, 0.55],
        [-3.86, 0.462],
        [-3.84, 0.44],
        [-3.6, 0.43],
      ],
      seg,
      { flip: true, crease: 1.0 },
    ),
    m.core,
  );
  add(
    "Plug",
    revolveX(
      [
        [-3.55, 0.31],
        [-3.9, 0.305],
        [-4.2, 0.225],
        [-4.45, 0.1],
        [-4.6, 0.012],
      ],
      48,
      { flip: true },
    ),
    m.exhaust,
  );
  // Fan frame / OGVs: darkness behind the fan.
  {
    const disc = new THREE.RingGeometry(0.3, 0.875, 64, 1);
    disc.rotateY(Math.PI / 2);
    disc.translate(-0.92, 0, 0);
    const vanes: THREE.BufferGeometry[] = [disc];
    for (let i = 0; i < 44; i++) {
      const v = new THREE.BoxGeometry(0.1, 0.5, 0.012);
      v.translate(0, 0.62, 0);
      v.rotateY(0.35);
      v.rotateX((i / 44) * Math.PI * 2);
      v.translate(-0.86, 0, 0);
      vanes.push(v.toNonIndexed());
    }
    add("Frame", mergeGeometries(vanes.map((x) => (x.index ? x.toNonIndexed() : x)))!, m.frame, false);
  }

  // Fan rotor: spinner + 36 wide-chord blades, rotating about local X.
  const fan = new THREE.Group();
  fan.name = `A320_Engine_${S}_Fan`;
  fan.position.set(-0.6, 0, 0);
  g.add(fan);
  const spinner = revolveX(
    [
      [0.5, 0.0],
      [0.46, 0.06],
      [0.36, 0.14],
      [0.2, 0.235],
      [0.04, 0.3],
      [-0.08, 0.318],
    ],
    48,
    { flip: true },
  );
  const sp = mesh(`A320_Engine_${S}_Spinner`, spinner, m.spinner);
  fan.add(sp);
  {
    const blades: THREE.BufferGeometry[] = [];
    const nb = 36;
    const sections: P3[][] = [];
    for (const r of linSpace(10, 0.29, 0.862)) {
      const t = (r - 0.29) / (0.862 - 0.29);
      const chord = lerp(0.2, 0.3, t);
      const stagger = lerp(0.42, 1.12, Math.pow(t, 0.8)); // radians from axis
      const thick = lerp(0.03, 0.008, t);
      const loop: P3[] = [];
      const n = 10;
      for (let k = 0; k <= n * 2 - 1; k++) {
        const kk = k <= n ? k : 2 * n - k;
        const f = kk / n;
        const side = k <= n ? 1 : -1;
        const tt = thick * Math.sin(Math.PI * Math.min(1, f * 1.05)) * 0.5 * side;
        const ax = (0.5 - f) * chord;
        const cam = 0.04 * chord * Math.sin(Math.PI * f);
        // (axial, tangential) rotated by stagger.
        const a = ax * Math.cos(stagger) - (tt + cam) * Math.sin(stagger);
        const tg = ax * Math.sin(stagger) + (tt + cam) * Math.cos(stagger);
        loop.push([a, r, tg]);
      }
      sections.push(loop);
    }
    const blade = loft(sections, { capStart: false, capEnd: true, crease: 0.9 });
    for (let i = 0; i < nb; i++) {
      const b = blade.clone();
      b.rotateX((i / nb) * Math.PI * 2);
      blades.push(b);
    }
    fan.add(mesh(`A320_Engine_${S}_Blades`, mergeGeometries(blades)!, m.fanBlade));
  }

  // Pylon.
  {
    const shape = new THREE.Shape();
    const p: [number, number][] = [
      [-0.5, 0.98],
      [-1.3, 1.2],
      [-2.3, 1.28],
      [-3.3, 1.42],
      [-5.45, 1.42],
      [-5.62, 1.12],
      [-5.15, 0.62],
      [-4.0, 0.5],
      [-3.5, 0.53],
      [-3.0, 0.6],
      [-2.92, 0.84],
      [-1.0, 0.98],
    ];
    shape.moveTo(p[0]![0], p[0]![1]);
    for (const q of p.slice(1)) shape.lineTo(q[0], q[1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.06,
      bevelSegments: 3,
      curveSegments: 4,
    });
    geo.translate(0, 0, -0.17);
    geo.computeVertexNormals();
    add("Pylon", geo, m.nacelle);
  }
  return g;
}

// ─── Landing gear ────────────────────────────────────────────────────────────

function buildMainGear(s: Side, m: A320Materials): THREE.Group {
  const S = SIDE_NAME(s);
  const g = new THREE.Group();
  g.name = `A320_Gear_Main_${S}`;
  const x = GEAR.mainX;
  const z = GEAR.mainZ * s;
  const axleY = GEAR.mainTireR - GEAR.squash;
  const parts: [string, THREE.BufferGeometry, THREE.Material][] = [
    ["Strut", strut([x, 2.62, z], [x, 1.22, z], 0.135, 20), m.gear],
    ["Piston", strut([x, 1.3, z], [x, axleY + 0.12, z], 0.095, 20), m.chrome],
    ["Axle", strut([x, axleY, z - 0.56 * s], [x, axleY, z + 0.56 * s], 0.075, 16), m.gear],
    ["Bogie", strut([x, axleY + 0.08, z], [x, axleY + 0.2, z], 0.13, 16, 0.11), m.gear],
    ["SideBrace", strut([x, 1.72, z], [x - 0.1, 2.42, z - 1.4 * s], 0.055, 12), m.gear],
    ["TorqueUpper", strut([x + 0.12, 1.24, z], [x + 0.28, 1.0, z], 0.03, 8), m.gear],
    ["TorqueLower", strut([x + 0.28, 1.0, z], [x + 0.1, axleY + 0.2, z], 0.03, 8), m.gear],
    ["Hydraulic", strut([x - 0.17, 2.3, z + 0.05 * s], [x - 0.15, axleY + 0.25, z + 0.05 * s], 0.012, 6), m.dark],
  ];
  for (const [n, geo, mat] of parts) g.add(mesh(`A320_Gear_Main_${S}_${n}`, geo, mat));
  // Leg door (fairing attached to the shock strut, outboard).
  {
    const door = new THREE.BoxGeometry(0.95, 1.2, 0.035);
    door.translate(x - 0.05, 1.8, z + 0.2 * s);
    g.add(mesh(`A320_Gear_Main_${S}_Door`, door, m.gear));
  }
  for (const [i, dz] of [
    [1, -GEAR.mainWheelSpacing / 2],
    [2, GEAR.mainWheelSpacing / 2],
  ] as const) {
    const w = wheel(`A320_Gear_Main_${S}_Wheel${i}`, GEAR.mainTireR, GEAR.mainTireW, m);
    w.position.set(x, axleY, z + dz * s);
    g.add(w);
  }
  return g;
}

function buildNoseGear(m: A320Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = "A320_Gear_Nose";
  const x = GEAR.noseX;
  const axleY = GEAR.noseTireR - GEAR.squash * 0.7;
  const parts: [string, THREE.BufferGeometry, THREE.Material][] = [
    ["Strut", strut([x, 2.1, 0], [x, 0.98, 0], 0.1, 18), m.gear],
    ["Piston", strut([x, 1.05, 0], [x + 0.05, axleY + 0.08, 0], 0.07, 18), m.chrome],
    ["Axle", strut([x + 0.05, axleY, -0.3], [x + 0.05, axleY, 0.3], 0.045, 12), m.gear],
    ["Fork", strut([x + 0.05, axleY + 0.05, 0], [x + 0.05, axleY + 0.2, 0], 0.08, 12), m.gear],
    ["DragBrace", strut([x, 1.42, 0], [x + 1.05, 2.02, 0], 0.05, 12), m.gear],
    ["TorqueLink", strut([x - 0.08, 1.0, 0], [x - 0.12, axleY + 0.2, 0], 0.025, 8), m.gear],
  ];
  for (const [n, geo, mat] of parts) g.add(mesh(`A320_Gear_Nose_${n}`, geo, mat));
  // Taxi / take-off lights on the strut.
  {
    const l = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16);
    l.rotateZ(Math.PI / 2);
    l.translate(x + 0.13, 1.5, 0);
    g.add(mesh("A320_Gear_Nose_TaxiLight", l, m.lensClear, false));
  }
  for (const [i, dz] of [
    [1, -GEAR.noseWheelSpacing / 2],
    [2, GEAR.noseWheelSpacing / 2],
  ] as const) {
    const w = wheel(`A320_Gear_Nose_Wheel${i}`, GEAR.noseTireR, GEAR.noseTireW, m);
    w.position.set(x + 0.05, axleY, dz);
    g.add(w);
  }
  // Aft nose gear doors (open while the gear is down).
  for (const s of [1, -1] as Side[]) {
    const door = new THREE.BoxGeometry(1.3, 0.62, 0.03);
    door.translate(x - 0.25, 1.5, 0.46 * s);
    g.add(mesh(`A320_Gear_Nose_Door_${SIDE_NAME(s)}`, door, m.antenna));
  }
  // Dark bay opening.
  {
    const bay = new THREE.BoxGeometry(2.0, 0.08, 0.86);
    bay.translate(x - 0.1, 1.86, 0);
    g.add(mesh("A320_Gear_Nose_Bay", bay, m.dark, false));
  }
  return g;
}

/** Wrap a gear assembly (authored in aircraft space) in a pivot at its trunnion. */
function gearPivot(gear: THREE.Object3D, at: P3, name: string): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(...at);
  gear.position.set(-at[0], -at[1], -at[2]);
  pivot.add(gear);
  return pivot;
}

// ─── Assembly ────────────────────────────────────────────────────────────────

export function buildA320(m: A320Materials): THREE.Group {
  const root = new THREE.Group();
  root.name = "A320";
  for (const o of buildFuselage(m)) root.add(o);
  for (const s of [1, -1] as Side[]) {
    for (const o of buildWing(s, m)) root.add(o);
    root.add(buildEngine(s, m));
    root.add(gearPivot(buildMainGear(s, m), [GEAR.mainX, 2.55, GEAR.mainZ * s], `A320_Gear_Main_${SIDE_NAME(s)}_Pivot`));
  }
  root.add(gearPivot(buildNoseGear(m), [GEAR.noseX, 2.05, 0], "A320_Gear_Nose_Pivot"));
  for (const o of buildEmpennage(m)) root.add(o);
  root.userData.dimensions = DIM;
  return root;
}
