import * as THREE from "three";
import gsap from "gsap";
import type CameraControlsImpl from "camera-controls";
import type { CameraPreset } from "@/aircraft/types";
import { useHangar } from "@/state/store";

/**
 * The single owner of authored camera movement. Components never tween the
 * camera themselves — they ask the director to fly to a preset.
 */

const DEFAULT_FOV = 34;

let controls: CameraControlsImpl | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let tween: gsap.core.Tween | null = null;
let limits = { min: 5, max: 88 };

export function attachCamera(c: CameraControlsImpl, cam: THREE.PerspectiveCamera, l: { min: number; max: number }) {
  controls = c;
  camera = cam;
  limits = l;
}

export function detachCamera() {
  tween?.kill();
  controls = null;
  camera = null;
}

const v = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2]);

/**
 * Presets are authored for a landscape viewport. On narrow (portrait)
 * viewports keep roughly the same horizontal coverage: widen the FOV up to a
 * limit, then pull the camera back for the remainder.
 */
const AUTHORED_ASPECT = 1.45;
const MAX_PORTRAIT_FOV = 62;

export function viewFit(fov: number): { fov: number; distance: number } {
  const aspect = camera?.aspect ?? AUTHORED_ASPECT;
  if (aspect >= AUTHORED_ASPECT) return { fov, distance: 1 };
  const halfH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * AUTHORED_ASPECT;
  const wantHalfV = halfH / aspect;
  const fitFov = Math.min(MAX_PORTRAIT_FOV, THREE.MathUtils.radToDeg(2 * Math.atan(wantHalfV)));
  const got = Math.tan(THREE.MathUtils.degToRad(fitFov / 2));
  return { fov: fitFov, distance: Math.min(1.7, wantHalfV / got) };
}

/** Authored views stay under the hangar roof fixtures. */
export const CEILING = 17.5;

function adapt(preset: CameraPreset): CameraPreset {
  const p =
    preset.position[1] > CEILING - 0.3
      ? { ...preset, position: [preset.position[0], CEILING - 0.3, preset.position[2]] as [number, number, number] }
      : preset;
  const fit = viewFit(p.fov ?? DEFAULT_FOV);
  if (fit.distance === 1 && fit.fov === (p.fov ?? DEFAULT_FOV)) return p;
  const t = p.target;
  const pos: [number, number, number] = [
    t[0] + (p.position[0] - t[0]) * fit.distance,
    Math.min(CEILING - 0.3, t[1] + (p.position[1] - t[1]) * fit.distance),
    t[2] + (p.position[2] - t[2]) * fit.distance,
  ];
  return { ...p, position: pos, fov: fit.fov };
}

export const distanceScale = () => viewFit(DEFAULT_FOV).distance;

export function stopFlight() {
  if (tween) {
    tween.kill();
    tween = null;
  }
  if (controls) controls.enabled = true;
  useHangar.setState({ cameraMode: "free" });
}

/** Jump without animation (used to start the reveal). */
export function placeCamera(preset: CameraPreset) {
  if (!controls || !camera) return;
  const p = adapt(preset);
  controls.setLookAt(...p.position, ...p.target, false);
  camera.fov = p.fov ?? DEFAULT_FOV;
  camera.updateProjectionMatrix();
}

/**
 * Fly to a preset. The camera offset from its target is interpolated in
 * spherical coordinates, so the path orbits around the aircraft instead of
 * cutting through it.
 */
export function flyTo(preset: CameraPreset, opts: { duration?: number; ease?: string } = {}): Promise<void> {
  const p = adapt(preset);
  const c = controls;
  const cam = camera;
  if (!c || !cam) return Promise.resolve();
  tween?.kill();

  const fromPos = c.getPosition(new THREE.Vector3());
  const fromTgt = c.getTarget(new THREE.Vector3());
  const toPos = v(p.position);
  const toTgt = v(p.target);
  const fromOff = new THREE.Spherical().setFromVector3(fromPos.clone().sub(fromTgt));
  const toOff = new THREE.Spherical().setFromVector3(toPos.clone().sub(toTgt));
  let dTheta = toOff.theta - fromOff.theta;
  if (dTheta > Math.PI) dTheta -= Math.PI * 2;
  if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  const fromFov = cam.fov;
  const toFov = p.fov ?? DEFAULT_FOV;

  const travel = fromPos.distanceTo(toPos) + fromTgt.distanceTo(toTgt) + Math.abs(dTheta) * 12;
  const duration = opts.duration ?? THREE.MathUtils.clamp(0.8 + travel / 70, 0.8, 1.5);

  // Allow the authored position even when it is closer than the free-orbit limit.
  c.minDistance = Math.min(limits.min, p.minDistance ?? limits.min, toOff.radius * 0.9);
  c.maxDistance = Math.max(limits.max * distanceScale(), toOff.radius * 1.1);
  c.enabled = false;
  useHangar.setState({ cameraMode: "auto" });

  const state = { t: 0 };
  const tgt = new THREE.Vector3();
  const off = new THREE.Spherical();
  const pos = new THREE.Vector3();
  return new Promise((resolve) => {
    tween = gsap.to(state, {
      t: 1,
      duration,
      ease: opts.ease ?? "power2.inOut",
      onUpdate: () => {
        const t = state.t;
        tgt.lerpVectors(fromTgt, toTgt, t);
        off.set(
          THREE.MathUtils.lerp(fromOff.radius, toOff.radius, t),
          THREE.MathUtils.lerp(fromOff.phi, toOff.phi, t),
          fromOff.theta + dTheta * t,
        );
        pos.setFromSpherical(off).add(tgt);
        c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false);
        cam.fov = THREE.MathUtils.lerp(fromFov, toFov, t);
        cam.updateProjectionMatrix();
      },
      onComplete: () => {
        tween = null;
        c.enabled = true;
        c.minDistance = p.minDistance ?? limits.min;
        if (toOff.radius < c.minDistance) c.minDistance = toOff.radius * 0.9;
        useHangar.setState({ cameraMode: "free" });
        resolve();
      },
      onInterrupt: () => resolve(),
    });
  });
}

export function getCameraState() {
  if (!controls) return null;
  return {
    position: controls.getPosition(new THREE.Vector3()),
    target: controls.getTarget(new THREE.Vector3()),
  };
}

export function setUserControl(enabled: boolean) {
  if (controls && !tween) controls.enabled = enabled;
}
