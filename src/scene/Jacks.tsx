"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { AircraftDefinition } from "@/aircraft/types";
import { runtime } from "./runtime";

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Lift fraction 0‥1 of the jacking phase. */
export function jackPhase(def: AircraftDefinition) {
  const j = def.jacks;
  if (!j) return 0;
  const e = runtime.toggles[j.toggle] ?? 0;
  return smooth(Math.min(1, e / j.liftPhase));
}

/** Raises the aircraft group while it is on jacks. */
export function useJackLift(def: AircraftDefinition, group: React.RefObject<THREE.Group | null>) {
  useFrame(() => {
    if (!def.jacks || !group.current) return;
    group.current.position.y = def.jacks.lift * jackPhase(def);
  });
}

/** Simple tripod jacks with an extending ram, at the definition's jacking points. */
export function Jacks({ def }: { def: AircraftDefinition }) {
  const j = def.jacks!;
  const root = useRef<THREE.Group>(null);
  const rams = useRef<(THREE.Mesh | null)[]>([]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9a227", roughness: 0.55, metalness: 0.3 }), []);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b8bcc0", roughness: 0.2, metalness: 1 }), []);
  useFrame(() => {
    const e = runtime.toggles[j.toggle] ?? 0;
    const g = root.current;
    if (!g) return;
    g.visible = e > 0.001;
    const lift = j.lift * jackPhase(def);
    j.points.forEach((p, i) => {
      const ram = rams.current[i];
      if (!ram) return;
      const base = Math.min(1.1, p[1] - 0.2);
      const top = p[1] + lift;
      ram.position.set(p[0], (base + top) / 2, p[2]);
      ram.scale.set(1, Math.max(0.01, top - base), 1);
    });
  });
  return (
    <group ref={root} visible={false}>
      {j.points.map((p, i) => {
        const base = Math.min(1.1, p[1] - 0.2);
        return (
          <group key={i}>
            <mesh position={[p[0], base / 2, p[2]]} material={mat} castShadow>
              <cylinderGeometry args={[0.16, 0.42, base, 16]} />
            </mesh>
            {[0, 1, 2].map((k) => {
              const a = (k / 3) * Math.PI * 2;
              return (
                <mesh key={k} position={[p[0] + Math.cos(a) * 0.55, 0.06, p[2] + Math.sin(a) * 0.55]} rotation-y={-a} material={mat} castShadow>
                  <boxGeometry args={[1.0, 0.12, 0.16]} />
                </mesh>
              );
            })}
            <mesh ref={(m) => void (rams.current[i] = m)} material={steel} castShadow>
              <cylinderGeometry args={[0.07, 0.07, 1, 12]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
