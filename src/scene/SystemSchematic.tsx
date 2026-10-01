"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { AircraftDefinition, SchematicLine, SchematicZone, SystemSchematic } from "@/aircraft/types";
import { useHangar } from "@/state/store";

/**
 * X-ray system schematics: flowing routing tubes, component nodes and tank
 * zones drawn through the ghosted airframe. Everything here is conceptual —
 * the panel and legend say so.
 */
export function SystemSchematicView({ def }: { def: AircraftDefinition }) {
  const systemId = useHangar((s) =>
    s.mode === "systems" && s.aircraftId === def.id && !s.activeDemo ? s.activeSystem : null,
  );
  const sys = def.systems.find((s) => s.id === systemId);
  if (!sys?.schematic) return null;
  return <Schematic key={sys.id} schematic={sys.schematic} />;
}

const lineVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const lineFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform float uLen; uniform float uFlow;
  uniform float uOpacity; uniform float uDashed;
  varying vec2 vUv;
  void main() {
    float s = vUv.x * uLen;
    // Flowing pulses travel along the line; static lines are solid or dashed.
    float pulse = uFlow > 0.0 ? smoothstep(0.0, 0.15, fract((s - uTime * uFlow) / 1.4)) * (1.0 - smoothstep(0.35, 0.6, fract((s - uTime * uFlow) / 1.4))) : 0.0;
    float dash = uDashed > 0.5 ? step(0.5, fract(s / 0.35)) : 1.0;
    float a = (0.55 + 0.45 * pulse) * dash * uOpacity;
    gl_FragColor = vec4(uColor * (1.0 + 0.9 * pulse), a);
  }`;

function useLine(l: SchematicLine) {
  return useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const pts = l.points.map((p) => new THREE.Vector3(...p));
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i]!, pts[i + 1]!));
    const geometry = new THREE.TubeGeometry(path, Math.max(8, pts.length * 12), l.radius ?? 0.045, 8, false);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(l.color) },
        uTime: { value: 0 },
        uLen: { value: path.getLength() },
        uFlow: { value: l.flow ?? 0 },
        uOpacity: { value: 0 },
        uDashed: { value: l.dashed ? 1 : 0 },
      },
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
    });
    return { geometry, material };
  }, [l]);
}

function Line({ l, opacity }: { l: SchematicLine; opacity: React.RefObject<number> }) {
  const { geometry, material } = useLine(l);
  useFrame((state) => {
    material.uniforms.uTime!.value = state.clock.elapsedTime;
    material.uniforms.uOpacity!.value = opacity.current;
  });
  return <mesh geometry={geometry} material={material} renderOrder={20} raycast={() => null} />;
}

function Zone({ z, opacity }: { z: SchematicZone; opacity: React.RefObject<number> }) {
  const { fill, edges, fillMat, edgeMat } = useMemo(() => {
    const top = z.corners.map((c) => new THREE.Vector3(...c));
    const bottom = top.map((v) => v.clone().add(new THREE.Vector3(0, -z.depth, 0)));
    const v = [...top, ...bottom];
    const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
    const fill = new THREE.BufferGeometry().setFromPoints(v);
    fill.setIndex(idx);
    const edges = new THREE.EdgesGeometry(fill, 1);
    const fillMat = new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const edgeMat = new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0, depthTest: false });
    return { fill, edges, fillMat, edgeMat };
  }, [z]);
  useFrame(() => {
    fillMat.opacity = 0.14 * opacity.current;
    edgeMat.opacity = 0.75 * opacity.current;
  });
  return (
    <group renderOrder={19}>
      <mesh geometry={fill} material={fillMat} renderOrder={19} raycast={() => null} />
      <lineSegments geometry={edges} material={edgeMat} renderOrder={19} />
    </group>
  );
}

function Schematic({ schematic }: { schematic: SystemSchematic }) {
  const opacity = useRef(0);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const dotMat = useMemo(
    () => schematic.nodes.map((n) => new THREE.MeshBasicMaterial({ color: n.color, transparent: true, depthTest: false, toneMapped: false })),
    [schematic],
  );
  useFrame((_, dt) => {
    opacity.current = THREE.MathUtils.damp(opacity.current, 1, 3, Math.min(dt, 0.05));
    dotMat.forEach((m) => (m.opacity = opacity.current));
    labels.current.forEach((el) => el && (el.style.opacity = String(Math.max(0, opacity.current * 1.2 - 0.2))));
  });
  return (
    <group>
      {schematic.zones?.map((z) => <Zone key={z.id} z={z} opacity={opacity} />)}
      {schematic.lines.map((l) => (
        <Line key={l.id} l={l} opacity={opacity} />
      ))}
      {schematic.nodes.map((n, i) => (
        <group key={n.id} position={n.at}>
          <mesh material={dotMat[i]} renderOrder={21} raycast={() => null}>
            <sphereGeometry args={[0.13, 16, 10]} />
          </mesh>
          <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
            <div ref={(el) => void (labels.current[i] = el)} className="sys-node" style={{ opacity: 0, ["--c" as string]: n.color }}>
              <span className="t">{n.label}</span>
              {n.detail && <span className="d">{n.detail}</span>}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
