import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { revolveX } from "./geometry";

/** Shared procedural parts used by builders and asset augmentations. */

export function partMesh(name: string, geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

const mesh = partMesh;

/** A tyre + hub on an axle running along local Z, centred at the origin. */
export function wheel(
  name: string,
  tireR: number,
  tireW: number,
  m: { tire: THREE.Material; hub: THREE.Material },
): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const hw = tireW / 2;
  const bead = tireR * 0.62;
  const tire = revolveX(
    [
      [-hw * 0.8, bead],
      [-hw * 0.95, bead + (tireR - bead) * 0.3],
      [-hw, bead + (tireR - bead) * 0.6],
      [-hw * 0.93, tireR * 0.955],
      [-hw * 0.7, tireR * 0.993],
      [0, tireR],
      [hw * 0.7, tireR * 0.993],
      [hw * 0.93, tireR * 0.955],
      [hw, bead + (tireR - bead) * 0.6],
      [hw * 0.95, bead + (tireR - bead) * 0.3],
      [hw * 0.8, bead],
    ],
    56,
    { crease: 1.2 },
  );
  const hubOuter = revolveX(
    [
      [-hw * 0.82, bead],
      [-hw * 0.7, bead * 0.82],
      [-hw * 0.62, bead * 0.35],
      [-hw * 0.75, bead * 0.22],
      [-hw * 0.75, 0.001],
    ],
    40,
    { flip: true, crease: 0.7 },
  );
  const hubInner = revolveX(
    [
      [hw * 0.75, 0.001],
      [hw * 0.75, bead * 0.25],
      [hw * 0.6, bead * 0.4],
      [hw * 0.7, bead * 0.82],
      [hw * 0.82, bead],
    ],
    40,
    { flip: true, crease: 0.7 },
  );
  // Axis is X in revolve space → rotate so the axle runs along Z.
  for (const [n, geo, mat] of [
    ["Tire", tire, m.tire],
    ["Hub", mergeGeometries([hubOuter, hubInner])!, m.hub],
  ] as const) {
    geo.rotateY(-Math.PI / 2);
    g.add(mesh(`${name}_${n}`, geo, mat));
  }
  return g;
}

