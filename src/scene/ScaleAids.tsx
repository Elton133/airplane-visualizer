"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type { AircraftDefinition, Vec3 } from "@/aircraft/types";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useHangar } from "@/state/store";
import { getRegistry } from "./scene-refs";

const damp = THREE.MathUtils.damp;
const ACCENT = "#E7FF46";

type LineRef = { material: { opacity: number; dashOffset?: number } } | null;

/**
 * Dimension lines drawn from the model's actual extents, labelled with the
 * verified figures from the definition.
 */
export function MeasureOverlay({ def, side = -1 }: { def: AircraftDefinition; side?: 1 | -1 }) {
  const show = useHangar((s) => s.measure);
  const reg = getRegistry(def.id);
  const progress = useRef(0);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const lines = useRef<LineRef[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);

  const dims = useMemo(() => {
    if (!reg) return null;
    const b = reg.bounds;
    // Dimension lines on the outer side (port by default, facing the home view).
    const edgeZ = side < 0 ? b.min.z : b.max.z;
    const sideZ = edgeZ + 3 * side;
    const frontX = b.max.x + 4;
    const tailX = b.min.x - 3;
    const y = 0.04;
    const value = (k: "LENGTH" | "WINGSPAN" | "HEIGHT") => def.reference.find((r) => r.label === k)?.value ?? "";
    return [
      {
        key: "length",
        label: "LENGTH",
        value: value("LENGTH"),
        a: [b.max.x, y, sideZ] as Vec3,
        b: [b.min.x, y, sideZ] as Vec3,
        ext: [
          [[b.max.x, y, edgeZ * 0.15], [b.max.x, y, sideZ + 0.6 * side]],
          [[b.min.x, y, edgeZ * 0.15], [b.min.x, y, sideZ + 0.6 * side]],
        ] as [Vec3, Vec3][],
        at: [(b.min.x + b.max.x) / 2, 0.5, sideZ + 0.8 * side] as Vec3,
      },
      {
        key: "span",
        label: "WINGSPAN",
        value: value("WINGSPAN"),
        a: [frontX, y, b.min.z] as Vec3,
        b: [frontX, y, b.max.z] as Vec3,
        ext: [
          [[b.max.x - 6, y, b.min.z], [frontX + 0.6, y, b.min.z]],
          [[b.max.x - 6, y, b.max.z], [frontX + 0.6, y, b.max.z]],
        ] as [Vec3, Vec3][],
        at: [frontX + 0.8, 0.5, 0] as Vec3,
      },
      {
        key: "height",
        label: "HEIGHT",
        value: value("HEIGHT"),
        a: [tailX, 0, sideZ] as Vec3,
        b: [tailX, b.max.y, sideZ] as Vec3,
        ext: [[[b.min.x + 2, b.max.y, 0], [tailX - 0.6, b.max.y, sideZ]]] as [Vec3, Vec3][],
        at: [tailX - 0.8, b.max.y / 2, sideZ] as Vec3,
      },
    ];
  }, [reg, def, side]);

  useFrame((_, dt) => {
    progress.current = damp(progress.current, show ? 1 : 0, show ? 2.2 : 6, Math.min(dt, 0.05));
    const p = progress.current;
    groups.current.forEach((g, i) => {
      if (!g || !dims) return;
      g.visible = p > 0.01;
      g.position.set(...dims[i]!.a);
    });
    lines.current.forEach((l) => l && (l.material.opacity = 0.5 * Math.min(1, p * 1.5)));
    labels.current.forEach((el) => el && (el.style.opacity = String(Math.max(0, p * 2 - 1))));
  });

  if (!dims) return null;
  return (
    <group>
      {dims.map((d, i) => (
        <group key={d.key} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <DimensionLine a={d.a} b={d.b} progress={progress} index={i} />
          {d.ext.map(([p, q], k) => (
            <Line
              key={k}
              points={[
                [p[0] - d.a[0], p[1] - d.a[1], p[2] - d.a[2]],
                [q[0] - d.a[0], q[1] - d.a[1], q[2] - d.a[2]],
              ]}
              color="#f1f1ee"
              lineWidth={1}
              dashed
              dashSize={0.3}
              gapSize={0.25}
              transparent
              opacity={0.5}
              ref={(l) => void (lines.current[i * 3 + k] = l as unknown as LineRef)}
            />
          ))}
          <Html position={[d.at[0] - d.a[0], d.at[1] - d.a[1], d.at[2] - d.a[2]]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <div ref={(el) => void (labels.current[i] = el)} className="dim-label" style={{ opacity: 0 }}>
              <span className="k">{d.label}</span>
              <span className="v">{d.value}</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/** The dimension line itself, with end ticks; extends from a toward b as it draws. */
function DimensionLine({ a, b, progress, index }: { a: Vec3; b: Vec3; progress: React.RefObject<number>; index: number }) {
  const ref = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), [a, b]);
  const len = v.length();
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), v.clone().normalize()), [v]);
  const tickUp = useMemo(() => (Math.abs(v.y) > 0.5 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)), [v]);
  useFrame(() => {
    const t = THREE.MathUtils.clamp((progress.current ?? 0) * 1.3 - index * 0.12, 0, 1);
    if (ref.current) ref.current.scale.set(Math.max(0.0001, t), 1, 1);
  });
  const tick = 0.5;
  const up: Vec3 = [tickUp.x * tick, tickUp.y * tick, tickUp.z * tick];
  return (
    <group quaternion={q}>
      <group ref={ref}>
        <Line points={[[0, 0, 0], [len, 0, 0]]} color={ACCENT} lineWidth={1.5} />
      </group>
      <Line points={[[0, -up[1], -up[2]], [0, up[1], up[2]]]} color={ACCENT} lineWidth={1.5} />
      <Line points={[[len, -up[1], -up[2]], [len, up[1], up[2]]]} color={ACCENT} lineWidth={1.5} />
    </group>
  );
}

/** A neutral 1.75 m human figure for scale. */
export function HumanFigure({ def }: { def: AircraftDefinition }) {
  const show = useHangar((s) => s.human);
  const ref = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const k = useRef(0);
  const { geo, mat } = useMemo(() => {
    // A plain standing figure, 1.75 m: legs, torso, arms, head.
    const parts: THREE.BufferGeometry[] = [];
    const cap = (r: number, len: number, x: number, y: number, z: number, rz = 0) => {
      const g = new THREE.CapsuleGeometry(r, len, 4, 12);
      g.rotateZ(rz);
      g.translate(x, y, z);
      parts.push(g);
    };
    cap(0.065, 0.74, 0, 0.44, -0.1); // legs
    cap(0.065, 0.74, 0, 0.44, 0.1);
    cap(0.16, 0.42, 0, 1.13, 0); // torso
    cap(0.045, 0.56, 0, 1.06, -0.25, 0.06); // arms
    cap(0.045, 0.56, 0, 1.06, 0.25, -0.06);
    const head = new THREE.SphereGeometry(0.105, 16, 12);
    head.translate(0, 1.645, 0);
    parts.push(head);
    const geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
    geo.scale(1, 1.0, 1);
    const mat = new THREE.MeshStandardMaterial({ color: "#7d8186", roughness: 0.85, transparent: true, opacity: 0 });
    return { geo, mat };
  }, []);
  useFrame((_, dt) => {
    k.current = damp(k.current, show ? 1 : 0, 5, Math.min(dt, 0.05));
    if (ref.current) ref.current.visible = k.current > 0.01;
    mat.opacity = k.current;
    if (label.current) label.current.style.opacity = String(k.current);
  });
  const at = def.humanSpot ?? [def.dimensions.length / 2 - 2, 0, -4];
  return (
    <group ref={ref} position={at} visible={false}>
      <mesh geometry={geo} material={mat} castShadow position={[0, 0, 0]} />
      <Html position={[0, 2.05, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div ref={label} className="dim-label" style={{ opacity: 0 }}>
          <span className="k">HUMAN</span>
          <span className="v">1.75 m</span>
        </div>
      </Html>
    </group>
  );
}
