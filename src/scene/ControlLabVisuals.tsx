"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type { AircraftDefinition, Vec3 } from "@/aircraft/types";
import { useHangar } from "@/state/store";
import type { ComponentRegistry } from "./component-registry";
import { runtime } from "./runtime";

const ACCENT = "#E7FF46";

/**
 * The real aircraft stays on its gear. The attitude response is drawn as an
 * attitude reference: a faint dashed axis (where the aircraft started) and an
 * accent axis that rotates with the representative response — roll shows the
 * wing line, pitch and yaw the fuselage axis.
 */
export function AttitudeGhost({ def }: { def: AircraftDefinition; reg: ComponentRegistry }) {
  const response = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const opacity = useRef(0);
  const refMat = useRef<{ opacity: number } | null>(null);
  const resMat = useRef<{ opacity: number } | null>(null);
  const label = useRef<HTMLDivElement>(null);
  const [axis, setAxis] = useState<"lateral" | "longitudinal">("lateral");

  const pivot = def.orbit.attitudePivot;
  const halfSpan = def.dimensions.wingspan / 2 + 1.5;
  const halfLen = def.dimensions.length / 2 + 2;
  const pts = useMemo<Record<"lateral" | "longitudinal", [Vec3, Vec3]>>(
    () => ({
      lateral: [
        [0, 0, -halfSpan],
        [0, 0, halfSpan],
      ],
      longitudinal: [
        [halfLen, 0, 0],
        [-halfLen, 0, 0],
      ],
    }),
    [halfSpan, halfLen],
  );

  useFrame((_, dt) => {
    const st = useHangar.getState();
    const demo = st.activeDemo;
    const want = demo === "roll" ? "lateral" : "longitudinal";
    if (demo && demo !== "flaps" && want !== axis) setAxis(want);
    const a = runtime.attitude;
    response.current?.rotation.set(a.roll, a.yaw, a.pitch, "YZX");
    const mag = Math.max(Math.abs(a.roll), Math.abs(a.pitch), Math.abs(a.yaw)) / (Math.PI / 180);
    const target = demo && demo !== "flaps" ? Math.min(1, 0.35 + mag) : 0;
    opacity.current = THREE.MathUtils.damp(opacity.current, target, 6, dt);
    if (refMat.current) refMat.current.opacity = opacity.current * 0.45;
    if (resMat.current) resMat.current.opacity = opacity.current;
    if (root.current) root.current.visible = opacity.current > 0.01;
    if (label.current) label.current.style.opacity = String(opacity.current);
  });

  const [p0, p1] = pts[axis];
  return (
    <group ref={root} position={pivot} visible={false}>
      <Line
        points={[p0, p1]}
        color="#f1f1ee"
        lineWidth={1}
        dashed
        dashSize={0.6}
        gapSize={0.5}
        transparent
        depthTest={false}
        renderOrder={10}
        ref={(l) => void (refMat.current = l ? (l.material as unknown as { opacity: number }) : null)}
      />
      <group ref={response}>
        <Line
          points={[p0, p1]}
          color={ACCENT}
          lineWidth={1.6}
          transparent
          depthTest={false}
          renderOrder={11}
          ref={(l) => void (resMat.current = l ? (l.material as unknown as { opacity: number }) : null)}
        />
        <Html position={p1} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div ref={label} className="force-label" style={{ transform: "translate(0, -16px)" }}>
            ATTITUDE RESPONSE
          </div>
        </Html>
      </group>
    </group>
  );
}

function Arrow({ refObj }: { refObj: React.RefObject<THREE.Group | null> }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }),
    [],
  );
  return (
    <group ref={refObj} visible={false} renderOrder={11}>
      <mesh material={mat} position={[0, 0.5, 0]} renderOrder={11} raycast={() => null}>
        <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
      </mesh>
      <mesh material={mat} position={[0, 1, 0]} renderOrder={11} raycast={() => null}>
        <coneGeometry args={[0.11, 0.32, 14]} />
      </mesh>
    </group>
  );
}

interface ForceSpec {
  key: string;
  at: Vec3;
  dir: THREE.Vector3;
  value: () => number;
  label: string;
}

/** Thin force indicators: lift increments at the wings, tail force, fin side force. */
export function ForceIndicators({ def }: { def: AircraftDefinition }) {
  const specs = useMemo<ForceSpec[]>(() => {
    const out: ForceSpec[] = [];
    const comp = (axis: string) => def.components.find((c) => c.demo === axis && c.category === "FLIGHT CONTROL");
    const ail = comp("roll");
    ail?.anchors.forEach((a, i) => {
      const port = a[2] < 0;
      out.push({
        key: `roll${i}`,
        at: [a[0] + 1.2, a[1] + 0.3, a[2]],
        dir: new THREE.Vector3(0, 1, 0),
        value: () => (port ? 1 : -1) * runtime.surfaces.roll,
        label: "ΔLIFT",
      });
    });
    const el = comp("pitch");
    if (el && el.anchors.length) {
      const m = el.anchors.reduce<Vec3>((s, a) => [s[0] + a[0] / el.anchors.length, s[1] + a[1] / el.anchors.length, 0], [0, 0, 0]);
      out.push({ key: "pitch", at: [m[0], m[1] + 0.2, 0], dir: new THREE.Vector3(0, 1, 0), value: () => -runtime.surfaces.pitch, label: "TAIL FORCE" });
    }
    const rud = comp("yaw");
    if (rud && rud.anchors[0]) {
      const a = rud.anchors[0];
      out.push({ key: "yaw", at: [a[0], a[1], 0], dir: new THREE.Vector3(0, 0, 1), value: () => -runtime.surfaces.yaw, label: "SIDE FORCE" });
    }
    return out;
  }, [def]);

  const refs = useRef<Record<string, React.RefObject<THREE.Group | null>>>({});
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  for (const s of specs) refs.current[s.key] ??= { current: null };
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const demo = useHangar.getState().activeDemo;
    for (const s of specs) {
      const g = refs.current[s.key]?.current;
      if (!g) continue;
      const v = s.value();
      const active = demo !== null && demo !== "flaps" && s.key.startsWith(demo);
      const len = Math.abs(v) * 2.6;
      g.visible = active && len > 0.08;
      const lbl = labelRefs.current[s.key];
      if (lbl) lbl.style.opacity = g.visible ? "1" : "0";
      if (!g.visible) continue;
      const dir = s.dir.clone().multiplyScalar(Math.sign(v));
      g.position.set(...s.at);
      g.quaternion.setFromUnitVectors(up, dir);
      g.scale.set(1, len, 1);
    }
  });

  return (
    <group>
      {specs.map((s) => (
        <group key={s.key}>
          <Arrow refObj={refs.current[s.key]!} />
          <Html position={[s.at[0], s.at[1] + (s.dir.y ? 0 : 0.5), s.at[2]]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <div ref={(el) => void (labelRefs.current[s.key] = el)} className="force-label">
              {s.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
