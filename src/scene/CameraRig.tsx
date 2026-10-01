"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import type { AircraftDefinition } from "@/aircraft/types";
import { useHangar } from "@/state/store";
import { attachCamera, CEILING, detachCamera, distanceScale, placeCamera } from "./camera-director";
import { getAircraftRegistry, onAircraftRegistry } from "./scene-refs";
import { COMPARE_ORBIT } from "./compare-layout";

const { ACTION } = CameraControlsImpl;

function viewName(pos: THREE.Vector3, tgt: THREE.Vector3): string {
  const d = pos.clone().sub(tgt);
  const horiz = Math.hypot(d.x, d.z);
  if (Math.atan2(d.y, horiz) > 1.05) return "TOP";
  const az = (Math.atan2(d.z, d.x) * 180) / Math.PI; // 0 = ahead of the nose, −90 = port
  const sectors: [number, string][] = [
    [-157.5, "REAR"],
    [-112.5, "PORT REAR"],
    [-67.5, "PORT"],
    [-22.5, "PORT FRONT"],
    [22.5, "FRONT"],
    [67.5, "STBD FRONT"],
    [112.5, "STBD"],
    [157.5, "STBD REAR"],
  ];
  for (const [lim, name] of sectors) if (az < lim) return name;
  return "REAR";
}

export function CameraRig({ def, compare }: { def: AircraftDefinition; compare: boolean }) {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const touch = useThree((s) => s.size.width < 760);

  // Attach once and start at the reveal position.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    attachCamera(c, camera, { min: def.orbit.minDistance, max: def.orbit.maxDistance });
    placeCamera(def.cameraPresets.REVEAL ?? def.cameraPresets.HOME!);
    // Free orbit is locked until the reveal hands over control.
    c.enabled = false;
    return () => detachCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // Per-aircraft (or compare) limits, target bounds and colliders.
  const orbit = compare ? COMPARE_ORBIT : def.orbit;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    attachCamera(c, camera, { min: orbit.minDistance, max: orbit.maxDistance });
    c.minDistance = orbit.minDistance;
    const b = orbit.targetBounds;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)));
    c.boundaryFriction = 0.3;
    const apply = () => {
      const r = getAircraftRegistry();
      c.colliderMeshes = !compare && r ? r.colliders : [];
    };
    apply();
    return onAircraftRegistry(apply);
  }, [camera, orbit, compare]);

  // Shift the projection centre left while a right-hand panel is open on
  // desktop, so the subject stays centred in the visible area.
  const size = useThree((s) => s.size);
  const shift = useRef(0);
  const applied = useRef("");
  useFrame((_, dt) => {
    const st = useHangar.getState();
    const panelOpen = size.width > 760 && st.mode !== "compare" && (!!st.selectedComponent || !!st.activeDemo);
    const target = panelOpen ? 190 : 0;
    const next = THREE.MathUtils.damp(shift.current, target, 7, Math.min(dt, 0.05));
    const sizeKey = `${size.width}x${size.height}`;
    if (Math.abs(next - shift.current) < 0.05 && Math.abs(next - target) < 0.05) {
      if (shift.current !== target || applied.current !== sizeKey) {
        applied.current = sizeKey;
        shift.current = target;
        if (target === 0) camera.clearViewOffset();
        else camera.setViewOffset(size.width, size.height, target, 0, size.width, size.height);
      }
      return;
    }
    shift.current = next;
    applied.current = sizeKey;
    camera.setViewOffset(size.width, size.height, next, 0, size.width, size.height);
  });

  // Hangar ceiling: cap the orbit distance so the camera stays below the
  // fixtures at any polar angle.
  const ceilTgt = useRef(new THREE.Vector3());
  useFrame(() => {
    const c = ref.current;
    if (!c || !c.enabled) return;
    c.getTarget(ceilTgt.current);
    const cos = Math.cos(c.polarAngle);
    const limit = cos > 0.01 ? (CEILING - ceilTgt.current.y) / cos : Infinity;
    c.maxDistance = Math.max(c.minDistance, Math.min(orbit.maxDistance * distanceScale(), limit));
  });

  // Report the view sector for the technical metadata readout.
  const last = useRef(0);
  const pos = useRef(new THREE.Vector3());
  const tgt = useRef(new THREE.Vector3());
  useFrame((state) => {
    const c = ref.current;
    if (!c || state.clock.elapsedTime - last.current < 0.3) return;
    last.current = state.clock.elapsedTime;
    c.getPosition(pos.current);
    c.getTarget(tgt.current);
    const v = viewName(pos.current, tgt.current);
    if (v !== useHangar.getState().view) useHangar.setState({ view: v });
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={orbit.minDistance}
      maxDistance={orbit.maxDistance}
      minPolarAngle={0.06}
      maxPolarAngle={Math.PI * 0.497}
      smoothTime={0.32}
      draggingSmoothTime={0.14}
      azimuthRotateSpeed={0.5}
      polarRotateSpeed={0.42}
      dollySpeed={0.55}
      truckSpeed={1.2}
      dollyToCursor={false}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.TRUCK, wheel: ACTION.DOLLY }}
      touches={{
        one: ACTION.TOUCH_ROTATE,
        two: touch ? ACTION.TOUCH_DOLLY : ACTION.TOUCH_DOLLY_TRUCK,
        three: ACTION.TOUCH_TRUCK,
      }}
    />
  );
}
