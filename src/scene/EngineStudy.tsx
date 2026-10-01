"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { AircraftDefinition, EngineModule } from "@/aircraft/types";
import { useHangar } from "@/state/store";
import { findNode } from "./component-registry";
import { runtime } from "./runtime";
import type { Cfm56Internals, ModuleId } from "@/three/engines/cfm56";

const damp = THREE.MathUtils.damp;

type Builder = typeof import("@/three/engines/cfm56");
const BUILDERS: Record<string, () => Promise<Builder>> = {
  cfm56: () => import("@/three/engines/cfm56"),
};

/** Nacelle parts that lift away in the explode and are cut in the cutaway. */
const NACELLE = ["Lip", "Cowl", "Duct"];
const CORE_COWL = "Core";

/**
 * Engine explode / airflow study. Internals are built on demand and parented
 * to the engine node, so they share its frame (axis +X, inlet at x = 0).
 */
export function EngineStudy({ def, root }: { def: AircraftDefinition; root: THREE.Object3D }) {
  const study = def.engineStudy!;
  const active = useHangar((s) => s.engineStudy);
  const gl = useThree((s) => s.gl);
  const [lib, setLib] = useState<Builder | null>(null);
  const [component, setComponent] = useState<string | null>(null);

  useEffect(() => {
    if (active && !lib) void BUILDERS[study.builder]?.().then(setLib);
    if (active) setComponent(active.component);
  }, [active, lib, study.builder]);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  if (!lib || !component) return null;
  const node = findNode(root, study.engines[component] ?? "");
  if (!node) return null;
  return <StudyRig key={component} lib={lib} engine={node} modules={study.modules} component={component} />;
}

function StudyRig({
  lib,
  engine,
  modules,
  component,
}: {
  lib: Builder;
  engine: THREE.Object3D;
  modules: EngineModule[];
  component: string;
}) {
  const internals = useMemo<Cfm56Internals>(() => lib.buildCfm56Internals(), [lib]);
  const parts = useMemo(() => {
    const byName = (suffix: string) => engine.children.find((c) => c.name.endsWith(`_${suffix}`));
    return {
      nacelle: NACELLE.map(byName).filter(Boolean) as THREE.Mesh[],
      core: byName(CORE_COWL) as THREE.Mesh | undefined,
      fan: engine.children.find((c) => c.name.endsWith("_Fan")),
      frame: byName("Frame"),
      plug: byName("Plug"),
    };
  }, [engine]);

  // Cut plane in world space through the engine axis, removing the half
  // that faces the study camera (outboard side of the aircraft).
  const plane = useMemo(() => new THREE.Plane(), []);
  const engineWorld = useMemo(() => new THREE.Vector3(), []);
  const outboard = useMemo(() => {
    engine.updateWorldMatrix(true, false);
    return Math.sign(engine.getWorldPosition(new THREE.Vector3()).z) || 1;
  }, [engine]);

  useEffect(() => {
    engine.add(internals.group);
    internals.group.visible = false;
    const base = new Map<THREE.Object3D, THREE.Vector3>();
    for (const o of [...parts.nacelle, parts.core, parts.fan, parts.frame, parts.plug]) if (o) base.set(o, o.position.clone());
    const cutMats = new Set<THREE.Material>();
    for (const m of [...parts.nacelle, parts.core]) {
      if (!m) continue;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) cutMats.add(mat);
    }
    internals.group.userData.base = base;
    internals.group.userData.cutMats = cutMats;
    return () => {
      engine.remove(internals.group);
      for (const [o, p] of base) {
        o.position.copy(p);
        o.visible = true;
      }
      for (const mat of cutMats) {
        mat.clippingPlanes = null;
        mat.side = THREE.FrontSide;
        mat.needsUpdate = true;
      }
      runtime.engineExplode = 0;
      runtime.engineCut = 0;
    };
  }, [engine, internals, parts]);

  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const clipOn = useRef(false);
  const keyLight = useRef<THREE.PointLight>(null);
  const fillLight = useRef<THREE.PointLight>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useHangar.getState();
    const view = st.engineStudy?.component === component ? st.engineStudy.view : null;
    runtime.engineExplode = damp(runtime.engineExplode, view === "explode" ? 1 : 0, 2.6, dt);
    runtime.engineCut = damp(runtime.engineCut, view === "airflow" ? 1 : 0, 2.2, dt);
    const e = runtime.engineExplode;
    const c = runtime.engineCut;
    const g = internals.group;
    g.visible = e > 0.002 || c > 0.002;

    const base = g.userData.base as Map<THREE.Object3D, THREE.Vector3> | undefined;
    if (!base) return; // set up on mount, after the first frame
    const ease = e * e * (3 - 2 * e);
    // Nacelle lifts clear, the core cowl is removed, modules separate along the axis.
    // Inspection lights so the internals read while the hangar is dimmed.
    const lit = Math.max(e, c);
    if (keyLight.current) keyLight.current.intensity = 70 * lit;
    if (fillLight.current) fillLight.current.intensity = 28 * lit;
    for (const n of parts.nacelle) n.position.copy(base.get(n)!).add(new THREE.Vector3(0, 1.75 * ease, 0));
    if (parts.core) parts.core.visible = e < 0.04;
    const offset = (id: ModuleId) => (modules.find((m) => m.id === id)?.explode ?? 0) * ease;
    if (parts.fan) parts.fan.position.copy(base.get(parts.fan)!).add(new THREE.Vector3(offset("fan"), 0, 0));
    if (parts.frame) parts.frame.position.copy(base.get(parts.frame)!).add(new THREE.Vector3(offset("fan"), 0, 0));
    if (parts.plug) parts.plug.position.copy(base.get(parts.plug)!).add(new THREE.Vector3(offset("exhaust"), 0, 0));
    for (const [id, o] of Object.entries(internals.modules)) o.position.set(offset(id as ModuleId), 0, 0);
    internals.shafts.visible = e < 0.15;

    // Cutaway: slice the near half of the nacelle and core cowl away.
    const cutMats = g.userData.cutMats as Set<THREE.Material>;
    const wantClip = c > 0.01;
    if (wantClip !== clipOn.current) {
      clipOn.current = wantClip;
      for (const mat of cutMats) {
        mat.clippingPlanes = wantClip ? [plane] : null;
        mat.side = wantClip ? THREE.DoubleSide : THREE.FrontSide;
        mat.needsUpdate = true;
      }
    }
    if (wantClip) {
      engine.getWorldPosition(engineWorld);
      // Normal points inboard; the plane sweeps from outside the nacelle to the axis.
      const sweep = 1.15 * (1 - c * c * (3 - 2 * c));
      plane.normal.set(0, 0, -outboard);
      plane.constant = outboard * (engineWorld.z + outboard * sweep);
    }

    for (const m of modules) {
      const el = labels.current[m.id];
      if (el) el.style.opacity = String(Math.max(0, (e - 0.55) / 0.45));
    }
  });

  const ep = engine.position;
  return (
    <>
      <pointLight ref={keyLight} position={[ep.x - 1.5, ep.y + 1.6, ep.z + outboard * 3.4]} intensity={0} distance={14} decay={2} color="#fff4e8" />
      <pointLight ref={fillLight} position={[ep.x + 3, ep.y - 0.6, ep.z + outboard * 2.6]} intensity={0} distance={12} decay={2} color="#dfe8f2" />
      {modules.map((m, i) => {
        const x = labelX(m.id) + m.explode;
        // Two rows below the axis (the lifted nacelle occupies the space above).
        const up = false;
        const row = i % 2 === 0 ? -1.1 : -1.5;
        return (
          <Html
            key={m.id}
            position={engineLocal(engine, [x, row, 0])}
            center
            zIndexRange={[6, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div ref={(el) => void (labels.current[m.id] = el)} className="module-label" data-up={up} style={{ opacity: 0 }}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="t">{m.name}</span>
              {m.stages && <span className="s">{m.stages}</span>}
            </div>
          </Html>
        );
      })}
      <Airflow lib={lib} engine={engine} outboard={outboard} component={component} />
    </>
  );
}

/** Module label anchor (engine-local x, before explode offsets). */
function labelX(id: EngineModule["id"]) {
  return { fan: -0.6, lpc: -1.12, hpc: -1.8, combustor: -2.45, hpt: -2.72, lpt: -3.1, exhaust: -4.1 }[id];
}

function engineLocal(engine: THREE.Object3D, p: [number, number, number]): [number, number, number] {
  // Labels live in the aircraft slot; engine nodes are not rotated, only offset.
  const o = engine.position;
  return [o.x + p[0], o.y + p[1], o.z + p[2]];
}

// ─── Airflow particles ───────────────────────────────────────────────────────

const COOL = new THREE.Color("#a9c3d6");
const WARM = new THREE.Color("#e3b06a");
const HOT = new THREE.Color("#e9773d");

function Airflow({
  lib,
  engine,
  outboard,
  component,
}: {
  lib: Builder;
  engine: THREE.Object3D;
  outboard: number;
  component: string;
}) {
  const N_BYPASS = 1100;
  const N_CORE = 900;
  const N = N_BYPASS + N_CORE;
  const { geometry, material, seeds } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 40 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float alpha;
        varying vec3 vColor; varying float vAlpha;
        uniform float uSize;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha; uniform float uOpacity;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          gl_FragColor = vec4(vColor * 2.2, (1.0 - r * 4.0) * vAlpha * uOpacity);
        }`,
    });
    // Per-particle: phase along the path, radial fraction, angle (far half only).
    const seeds = Array.from({ length: N }, (_, i) => ({
      core: i >= N_BYPASS,
      s: Math.random(),
      q: Math.random(),
      a: (0.06 + 0.88 * Math.random()) * Math.PI,
      v: 0.8 + Math.random() * 0.4,
    }));
    return { geometry, material, seeds };
  }, [N]);

  const points = useRef<THREE.Points>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = runtime.engineCut;
    const isMine = useHangar.getState().engineStudy?.component === component;
    material.uniforms.uOpacity!.value = isMine ? Math.max(0, (c - 0.5) / 0.5) : 0;
    if (points.current) points.current.visible = material.uniforms.uOpacity!.value > 0.01;
    if (!points.current?.visible) return;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const clr = geometry.attributes.color as THREE.BufferAttribute;
    const alp = geometry.attributes.alpha as THREE.BufferAttribute;
    const x0 = 1.2;
    const x1 = -5.2;
    for (let i = 0; i < N; i++) {
      const p = seeds[i]!;
      // Bypass air moves fast; core air slows through the compressor and
      // accelerates after the combustor.
      const x = x0 + (x1 - x0) * p.s;
      const speed = p.core ? (x < -2.3 ? 0.3 : x < -0.9 ? 0.12 : 0.2) : 0.26;
      p.s += speed * p.v * dt;
      if (p.s > 1) p.s -= 1;
      const [ri, ro] = lib.sampleStream(p.core ? lib.CORE_PATH : lib.BYPASS_PATH, x);
      const r = ri + (ro - ri) * (0.15 + 0.7 * p.q);
      const a = p.a;
      pos.setXYZ(i, x, Math.cos(a) * r, -outboard * Math.sin(a) * r);
      if (p.core) {
        const t = lib.coreTemperature(x);
        if (t < 0.4) col.copy(COOL).lerp(WARM, t / 0.4);
        else col.copy(WARM).lerp(HOT, (t - 0.4) / 0.6);
      } else col.copy(COOL);
      clr.setXYZ(i, col.r, col.g, col.b);
      const fade = Math.min(1, p.s * 8, (1 - p.s) * 6);
      alp.setX(i, (p.core ? 0.9 : 0.55) * fade);
    }
    pos.needsUpdate = true;
    clr.needsUpdate = true;
    alp.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} material={material} position={engine.position.toArray()} frustumCulled={false} renderOrder={12} />
  );
}
