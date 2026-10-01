import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { revolveX, strut } from "../geometry";
import { partMesh } from "../parts";

/**
 * Schematic CFM56-5B internals in engine-local space (axis +X forward,
 * inlet highlight at x = 0, matching the nacelle builder). Stage counts
 * follow the engine (fan, 4-stage booster, 9-stage HPC, annular combustor,
 * 1-stage HPT, 4-stage LPT); radii and spacing are representative.
 * Lazy-loaded only when the engine study is opened.
 */

export type ModuleId = "fan" | "lpc" | "hpc" | "combustor" | "hpt" | "lpt" | "exhaust";

const lerp = THREE.MathUtils.lerp;

function bladeRing(x: number, rHub: number, rTip: number, count: number, chord: number, stagger: number, thick = 0.006) {
  const parts: THREE.BufferGeometry[] = [];
  const len = rTip - rHub;
  for (let i = 0; i < count; i++) {
    const b = new THREE.BoxGeometry(chord, len, thick);
    b.rotateY(stagger);
    b.translate(0, rHub + len / 2, 0);
    b.rotateX((i / count) * Math.PI * 2);
    b.translate(x, 0, 0);
    parts.push(b);
  }
  return mergeGeometries(parts)!;
}

function drum(x0: number, x1: number, r0: number, r1: number) {
  return revolveX(
    [
      [x1, 0.001],
      [x1, r1],
      [x0, r0],
      [x0, 0.001],
    ],
    48,
    { flip: true, crease: 0.8 },
  );
}

export interface Cfm56Internals {
  group: THREE.Group;
  modules: Partial<Record<ModuleId, THREE.Object3D>>;
  shafts: THREE.Object3D;
}

export function buildCfm56Internals(): Cfm56Internals {
  const titanium = new THREE.MeshPhysicalMaterial({ color: "#aeb3b8", metalness: 1, roughness: 0.32 });
  const steel = new THREE.MeshPhysicalMaterial({ color: "#8f9499", metalness: 1, roughness: 0.38 });
  const nickel = new THREE.MeshPhysicalMaterial({ color: "#8a7a6c", metalness: 0.95, roughness: 0.42 });
  const stator = new THREE.MeshStandardMaterial({ color: "#5f6368", metalness: 0.8, roughness: 0.5 });
  const liner = new THREE.MeshPhysicalMaterial({ color: "#6e5d50", metalness: 0.9, roughness: 0.45 });
  const casing = new THREE.MeshStandardMaterial({ color: "#3d4044", metalness: 0.7, roughness: 0.55, side: THREE.DoubleSide });

  const group = new THREE.Group();
  group.name = "CFM56_Internals";
  const modules: Cfm56Internals["modules"] = {};
  const mod = (id: ModuleId) => {
    const g = new THREE.Group();
    g.name = `CFM56_${id}`;
    group.add(g);
    modules[id] = g;
    return g;
  };

  // Booster (LPC): 4 rotor stages with stators between.
  {
    const g = mod("lpc");
    const rot: THREE.BufferGeometry[] = [];
    const sta: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const x = -0.98 - i * 0.095;
      const tip = lerp(0.43, 0.38, i / 3);
      rot.push(bladeRing(x, 0.29, tip, 56, 0.045, 0.7));
      sta.push(bladeRing(x - 0.045, 0.3, tip + 0.01, 64, 0.035, -0.5, 0.004));
    }
    g.add(partMesh("CFM56_LPC_Rotors", mergeGeometries(rot)!, titanium));
    g.add(partMesh("CFM56_LPC_Stators", mergeGeometries(sta)!, stator));
    g.add(partMesh("CFM56_LPC_Drum", drum(-1.32, -0.92, 0.29, 0.285), steel));
  }
  // HPC: 9 stages, annulus narrowing toward the combustor.
  {
    const g = mod("hpc");
    const rot: THREE.BufferGeometry[] = [];
    const sta: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = -1.4 - i * 0.092;
      const hub = lerp(0.2, 0.225, t);
      const tip = lerp(0.335, 0.252, t);
      rot.push(bladeRing(x, hub, tip, Math.round(lerp(44, 70, t)), lerp(0.05, 0.03, t), 0.8));
      sta.push(bladeRing(x - 0.045, hub + 0.004, tip + 0.006, Math.round(lerp(52, 80, t)), lerp(0.035, 0.022, t), -0.6, 0.004));
    }
    g.add(partMesh("CFM56_HPC_Rotors", mergeGeometries(rot)!, titanium));
    g.add(partMesh("CFM56_HPC_Stators", mergeGeometries(sta)!, stator));
    g.add(partMesh("CFM56_HPC_Drum", drum(-2.22, -1.36, 0.2, 0.225), steel));
  }
  // Annular combustor with fuel nozzles.
  {
    const g = mod("combustor");
    const profile: [number, number][] = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      profile.push([-2.46 + Math.cos(a) * 0.17, 0.275 + Math.sin(a) * 0.055]);
    }
    g.add(partMesh("CFM56_Combustor_Liner", revolveX(profile, 64, { crease: 0.9 }), liner));
    const noz: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 20; i++) {
      const s = strut([-2.24, 0, 0], [-2.31, 0, 0], 0.012, 8);
      s.translate(0, 0.275, 0);
      s.rotateX((i / 20) * Math.PI * 2);
      noz.push(s.index ? s.toNonIndexed() : s);
      const stem = strut([-2.24, 0.275, 0], [-2.2, 0.36, 0], 0.008, 6);
      stem.rotateX((i / 20) * Math.PI * 2);
      noz.push(stem.index ? stem.toNonIndexed() : stem);
    }
    g.add(partMesh("CFM56_Fuel_Nozzles", mergeGeometries(noz)!, steel));
  }
  // HPT: single stage (nozzle guide vanes + rotor).
  {
    const g = mod("hpt");
    g.add(partMesh("CFM56_HPT_Vanes", bladeRing(-2.67, 0.24, 0.33, 42, 0.05, -0.9, 0.008), stator));
    g.add(partMesh("CFM56_HPT_Rotor", bladeRing(-2.74, 0.245, 0.33, 66, 0.045, 0.95, 0.008), nickel));
    g.add(partMesh("CFM56_HPT_Disk", drum(-2.77, -2.71, 0.24, 0.24), steel));
  }
  // LPT: 4 stages, annulus growing.
  {
    const g = mod("lpt");
    const rot: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const x = -2.88 - i * 0.14;
      rot.push(bladeRing(x, lerp(0.26, 0.29, t), lerp(0.37, 0.44, t), 90, 0.05, 0.85, 0.006));
      rot.push(bladeRing(x - 0.06, lerp(0.265, 0.295, t), lerp(0.375, 0.445, t), 80, 0.04, -0.7, 0.005));
    }
    g.add(partMesh("CFM56_LPT_Stages", mergeGeometries(rot)!, nickel));
    g.add(partMesh("CFM56_LPT_Drum", drum(-3.36, -2.84, 0.26, 0.29), steel));
  }
  // Shafts: inner LP shaft (fan ↔ LPT), outer HP spool (HPC ↔ HPT).
  const shafts = new THREE.Group();
  shafts.name = "CFM56_Shafts";
  shafts.add(partMesh("CFM56_LP_Shaft", strut([-0.62, 0, 0], [-3.4, 0, 0], 0.035, 16), steel));
  shafts.add(partMesh("CFM56_HP_Spool", strut([-1.38, 0, 0], [-2.74, 0, 0], 0.075, 20), casing));
  group.add(shafts);
  return { group, modules, shafts };
}

// ─── Airflow paths ───────────────────────────────────────────────────────────

/** (x, rInner, rOuter) stations of each stream, engine-local. */
export const BYPASS_PATH: [number, number, number][] = [
  [1.2, 0.36, 0.86],
  [0.0, 0.34, 0.9],
  [-0.6, 0.33, 0.86],
  [-1.0, 0.42, 0.86],
  [-1.6, 0.56, 0.85],
  [-2.5, 0.67, 0.84],
  [-3.0, 0.64, 0.86],
  [-3.9, 0.6, 0.9],
  [-5.2, 0.55, 0.95],
];

export const CORE_PATH: [number, number, number][] = [
  [1.2, 0.05, 0.3],
  [0.0, 0.14, 0.32],
  [-0.62, 0.31, 0.4],
  [-0.95, 0.3, 0.41],
  [-1.3, 0.29, 0.37],
  [-1.4, 0.21, 0.33],
  [-2.2, 0.23, 0.25],
  [-2.3, 0.23, 0.31],
  [-2.62, 0.23, 0.31],
  [-2.74, 0.25, 0.32],
  [-3.4, 0.29, 0.43],
  [-3.85, 0.31, 0.44],
  [-4.6, 0.02, 0.42],
  [-5.4, 0.02, 0.44],
];

/** Relative temperature along the core (0 cool … 1 hot), by x. */
export function coreTemperature(x: number) {
  if (x > -1.4) return 0.05 + 0.08 * THREE.MathUtils.clamp((0 - x) / 1.4, 0, 1);
  if (x > -2.25) return 0.13 + 0.25 * ((-1.4 - x) / 0.85);
  if (x > -2.62) return 0.38 + 0.62 * ((-2.25 - x) / 0.37);
  if (x > -3.4) return 1 - 0.45 * ((-2.62 - x) / 0.78);
  return Math.max(0.3, 0.55 - 0.25 * ((-3.4 - x) / 2));
}

export function sampleStream(path: [number, number, number][], x: number): [number, number] {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (x <= a[0] && x >= b[0]) {
      const t = (a[0] - x) / (a[0] - b[0]);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
  }
  const last = path[path.length - 1]!;
  return [last[1], last[2]];
}
