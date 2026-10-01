import * as THREE from "three";
import { strut, type P3 } from "../geometry";
import { partMesh, wheel } from "../parts";

/**
 * Procedural C-17 landing gear. The source asset (a converted game vehicle)
 * carries gear and wheel bones but no gear geometry, so the struts and tyres
 * are built here at the bone positions:
 *  - nose gear: two wheels side by side
 *  - main gear: two struts per side (forward + aft), three wheels abreast each
 * Tyres follow the published sizes: main 50×21.0-20, nose 40×16 (Goodyear).
 */

const MAIN_R = 0.635;
const MAIN_W = 0.53;
const NOSE_R = 0.51;
const NOSE_W = 0.41;
const SQUASH = 0.025;

function bonePos(root: THREE.Object3D, prefix: string): THREE.Vector3 | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.Bone).isBone && o.name.startsWith(prefix)) found = o;
  });
  if (!found) return null;
  const v = (found as THREE.Object3D).getWorldPosition(new THREE.Vector3());
  return v.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
}

export function addC17Gear(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const mat = {
    tire: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 }),
    hub: new THREE.MeshStandardMaterial({ color: "#8f9499", roughness: 0.4, metalness: 0.7 }),
    leg: new THREE.MeshPhysicalMaterial({ color: "#b9bdc1", roughness: 0.45, metalness: 0.2, clearcoat: 0.25 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: "#e4e7ea", roughness: 0.07, metalness: 1 }),
  };
  const gear = new THREE.Group();
  gear.name = "C17_Gear";

  const mains = ["wheel_lm1_", "wheel_lr_", "wheel_rm1_", "wheel_rr_"]
    .map((p) => [p, bonePos(root, p)] as const)
    .filter((x): x is readonly [string, THREE.Vector3] => !!x[1]);
  if (mains.length === 0) return;
  // All tyres share one contact plane: the lowest main-gear tyre bottom.
  const ground = Math.min(...mains.map(([, v]) => v.y)) - MAIN_R + SQUASH;

  mains.forEach(([prefix, p], i) => {
    const g = new THREE.Group();
    g.name = `C17_Gear_Main_${i + 1}`;
    const axleY = ground + MAIN_R - SQUASH;
    const top: P3 = [p.x, axleY + 1.35, p.z];
    g.add(partMesh(`${g.name}_Strut`, strut(top, [p.x, axleY + 0.45, p.z], 0.17, 18), mat.leg));
    g.add(partMesh(`${g.name}_Piston`, strut([p.x, axleY + 0.5, p.z], [p.x, axleY + 0.08, p.z], 0.12, 18), mat.chrome));
    const span = (MAIN_W + 0.1) * 1.5;
    g.add(partMesh(`${g.name}_Axle`, strut([p.x, axleY, p.z - span], [p.x, axleY, p.z + span], 0.09, 14), mat.leg));
    for (const k of [-1, 0, 1]) {
      const w = wheel(`${g.name}_Wheel${k + 2}`, MAIN_R, MAIN_W, mat);
      w.position.set(p.x, axleY, p.z + k * (MAIN_W + 0.1));
      g.add(w);
    }
    void prefix;
    gear.add(g);
  });

  const nose = bonePos(root, "wheel_lf_");
  if (nose) {
    const g = new THREE.Group();
    g.name = "C17_Gear_Nose";
    const axleY = ground + NOSE_R - SQUASH * 0.7;
    g.add(partMesh("C17_Gear_Nose_Strut", strut([nose.x, axleY + 1.7, nose.z], [nose.x, axleY + 0.55, nose.z], 0.13, 16), mat.leg));
    g.add(partMesh("C17_Gear_Nose_Piston", strut([nose.x, axleY + 0.6, nose.z], [nose.x, axleY + 0.1, nose.z], 0.09, 16), mat.chrome));
    g.add(partMesh("C17_Gear_Nose_Axle", strut([nose.x, axleY, nose.z - 0.36], [nose.x, axleY, nose.z + 0.36], 0.06, 12), mat.leg));
    g.add(
      partMesh("C17_Gear_Nose_DragBrace", strut([nose.x - 0.05, axleY + 1.2, nose.z], [nose.x + 1.4, axleY + 2.0, nose.z], 0.06, 10), mat.leg),
    );
    for (const k of [-1, 1]) {
      const w = wheel(`C17_Gear_Nose_Wheel${k < 0 ? 1 : 2}`, NOSE_R, NOSE_W, mat);
      w.position.set(nose.x, axleY, nose.z + k * (NOSE_W / 2 + 0.06));
      g.add(w);
    }
    gear.add(g);
  }
  root.add(gear);
}
