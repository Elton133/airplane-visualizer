"use client";

import { Suspense, useEffect, useReducer } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { getAircraft } from "@/aircraft/registry";
import { useHangar, type QualityLevel } from "@/state/store";
import { ActuationClock, AircraftSlot } from "./Aircraft";
import { compareLayout } from "./compare-layout";
import { runtime } from "./runtime";
import { onAircraftRegistry } from "./scene-refs";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Hangar } from "./Hangar";
import { HotspotTracker } from "./HotspotTracker";
import { Reveal } from "./Reveal";

const DPR: Record<QualityLevel, [number, number]> = {
  high: [1, 2],
  balanced: [1, 1.5],
  performance: [0.75, 1],
};

const STEP_DOWN: Record<QualityLevel, QualityLevel> = { high: "balanced", balanced: "performance", performance: "performance" };

export default function Experience() {
  const aircraftId = useHangar((s) => s.aircraftId);
  const quality = useHangar((s) => s.resolvedQuality);
  const mode = useHangar((s) => s.mode);
  const compareIds = useHangar((s) => s.compareIds);
  const def = getAircraft(aircraftId);
  // Re-render when a model finishes loading (compare placement uses its bounds).
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onAircraftRegistry(() => bump()), []);

  const compare = mode === "compare";
  const slots = compare ? compareIds : [aircraftId];
  const layout = compare ? compareLayout(getAircraft(compareIds[0]), getAircraft(compareIds[1])) : null;
  runtime.shadowRadius = compare
    ? 60
    : Math.max(def.dimensions.wingspan, def.dimensions.length) * 0.62 + 3;

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    // Keep the viewport fixed: no page pinch-zoom / gesture scrolling.
    document.addEventListener("gesturestart", block);
    return () => document.removeEventListener("gesturestart", block);
  }, []);

  return (
    <Canvas
      className="hangar-canvas"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={DPR[quality]}
      camera={{ fov: 34, near: 0.1, far: 420, position: [24, 4.6, -9] }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          const s = useHangar.getState();
          if (s.quality === "auto" && s.phase === "ready") useHangar.setState({ resolvedQuality: STEP_DOWN[s.resolvedQuality] });
        }}
      />
      {quality === "high" && <SoftShadows size={28} samples={12} focus={0.6} />}
      <Suspense fallback={null}>
        <Hangar quality={quality} />
        {slots.map((id) => (
          <AircraftSlot key={id} def={getAircraft(id)} interactive={!compare} position={layout?.[id] ?? [0, 0, 0]} />
        ))}
      </Suspense>
      <ActuationClock />
      <CameraRig def={def} compare={compare} />
      <HotspotTracker key={def.id} def={def} />
      <Reveal def={def} />
      <Effects quality={quality} />
    </Canvas>
  );
}
