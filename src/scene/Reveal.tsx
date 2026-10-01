"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { useThree } from "@react-three/fiber";
import type { AircraftDefinition } from "@/aircraft/types";
import { setProgress, useHangar } from "@/state/store";
import { flyTo, setUserControl } from "./camera-director";
import { onAircraftRegistry } from "./scene-refs";
import { FIXTURE_ROWS, runtime } from "./runtime";

/**
 * Waits for genuine readiness (aircraft built, shaders compiled), then runs
 * the light-up: fixture rows switch on in sequence, the silhouette emerges,
 * the final key light reveals the aircraft while the camera dollies back.
 */
export function Reveal({ def }: { def: AircraftDefinition }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;
    let started = false;
    const unsub = onAircraftRegistry(async () => {
      // The reveal runs once, for the first aircraft; later loads just appear.
      if (started || useHangar.getState().phase !== "loading") return;
      started = true;
      try {
        // Compile every material against the current lights before revealing,
        // so the first visible frames do not hitch.
        await gl.compileAsync(scene, camera);
      } catch {
        /* compileAsync unsupported — continue */
      }
      if (cancelled) return;
      setProgress("environment", 1);
      useHangar.setState({ phase: "revealing" });

      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      tl = gsap.timeline({
        defaults: { ease: "power1.out" },
        onComplete: () => {
          useHangar.setState({ phase: "ready" });
          setUserControl(true);
        },
      });
      if (reduce) {
        for (let i = 0; i < FIXTURE_ROWS; i++) runtime.fixtures[i] = 1;
        Object.assign(runtime, { key: 1, env: 1, door: 1 });
        void flyTo(def.cameraPresets.HOME!, { duration: 0.8 });
        tl.to({}, { duration: 0.8 });
        return;
      }
      // Fixture rows, back to front, with a small flicker as each strikes.
      for (let i = 0; i < FIXTURE_ROWS; i++) {
        const row = { v: 0 };
        tl.to(
          row,
          {
            keyframes: [{ v: 0.55, duration: 0.05 }, { v: 0.15, duration: 0.05 }, { v: 1, duration: 0.18 }],
            onUpdate: () => void (runtime.fixtures[i] = row.v),
          },
          0.25 + i * 0.16,
        );
      }
      tl.to(runtime, { env: 0.35, door: 1, duration: 1.0 }, 0.3);
      // Final overhead key light.
      tl.to(runtime, { key: 1, env: 1, duration: 0.9, ease: "power2.inOut" }, 1.55);
      tl.add(() => void flyTo(def.cameraPresets.HOME!, { duration: 2.6, ease: "power2.inOut" }), 1.25);
      tl.to({}, { duration: 0.01 }, 3.85);
    });
    return () => {
      cancelled = true;
      unsub();
      tl?.kill();
    };
  }, [gl, scene, camera, def]);

  return null;
}
