"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { AircraftDefinition, AircraftLight, Vec3 } from "@/aircraft/types";
import { useHangar } from "@/state/store";
import { findNode } from "./component-registry";

/**
 * Exterior lights at the modelled light units: steady navigation lights,
 * flashing red beacons, double-flash white strobes and a taxi light.
 * Flash timing is representative. Lights are always mounted and only their
 * intensity changes, so toggling never recompiles shaders.
 */

let glowTexture: THREE.Texture | null = null;
function glow() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function level(l: AircraftLight, t: number): number {
  switch (l.kind) {
    case "nav":
    case "taxi":
      return 1;
    case "beacon": {
      // ~1 flash per second, top and bottom alternating.
      const p = (t + (l.phase ?? 0)) % 1;
      return p < 0.1 ? 1 - p / 0.1 : 0;
    }
    case "strobe": {
      // Double flash every ~1.4 s.
      const p = t % 1.4;
      return p < 0.05 || (p > 0.16 && p < 0.21) ? 1 : 0;
    }
  }
}

export function AircraftLightsView({ def, root }: { def: AircraftDefinition; root: THREE.Object3D }) {
  const lights = def.lights ?? [];
  const quality = useHangar((s) => s.resolvedQuality);
  const placed = useMemo(() => {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    return lights.map((l) => {
      let at: Vec3 | null = l.at ?? null;
      if (!at && l.node) {
        const n = findNode(root, l.node);
        if (n) {
          const v = n.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
          at = [v.x, v.y, v.z];
        }
      }
      return { l, at };
    });
  }, [lights, root]);

  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const points = useRef<(THREE.PointLight | THREE.SpotLight | null)[]>([]);
  const on = useRef(0);
  const withLights = quality !== "performance";

  useFrame((state, dt) => {
    on.current = THREE.MathUtils.damp(on.current, useHangar.getState().aircraftLights ? 1 : 0, 8, Math.min(dt, 0.05));
    const t = state.clock.elapsedTime;
    placed.forEach(({ l }, i) => {
      const k = on.current * level(l, t);
      const s = sprites.current[i];
      if (s) {
        s.visible = k > 0.01;
        (s.material as THREE.SpriteMaterial).opacity = k;
        const size = l.kind === "strobe" ? 1.6 : l.kind === "beacon" ? 1.1 : l.kind === "taxi" ? 1.0 : 0.7;
        s.scale.setScalar(size * (0.6 + 0.4 * k));
      }
      const p = points.current[i];
      if (p) p.intensity = k * (l.kind === "strobe" ? 120 : l.kind === "beacon" ? 40 : l.kind === "taxi" ? 900 : 14);
    });
  });

  return (
    <group>
      {placed.map(({ l, at }, i) =>
        at ? (
          <group key={l.id} position={at}>
            <sprite ref={(s) => void (sprites.current[i] = s)} visible={false} renderOrder={15}>
              <spriteMaterial
                map={glow()}
                color={new THREE.Color(l.color).multiplyScalar(l.kind === "strobe" ? 6 : 3.5)}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
                opacity={0}
              />
            </sprite>
            {withLights && l.kind !== "taxi" && (
              <pointLight ref={(p) => void (points.current[i] = p)} color={l.color} intensity={0} distance={l.kind === "strobe" ? 16 : 9} decay={2} />
            )}
            {withLights && l.kind === "taxi" && <TaxiLight dir={l.dir ?? [1, -0.15, 0]} color={l.color} setRef={(p) => void (points.current[i] = p)} />}
          </group>
        ) : null,
      )}
    </group>
  );
}

function TaxiLight({ dir, color, setRef }: { dir: Vec3; color: string; setRef: (l: THREE.SpotLight | null) => void }) {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(dir[0] * 10, dir[1] * 10, dir[2] * 10);
    return o;
  }, [dir]);
  return (
    <>
      <primitive object={target} />
      <spotLight ref={setRef} color={color} intensity={0} distance={40} angle={0.42} penumbra={0.6} decay={2} target={target} />
    </>
  );
}
