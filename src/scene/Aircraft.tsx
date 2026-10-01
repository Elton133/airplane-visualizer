"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type { AircraftDefinition, ControlSurfaceRig } from "@/aircraft/types";
import { getAircraft } from "@/aircraft/registry";
import { selectComponent } from "@/state/controller";
import { setProgress, useHangar } from "@/state/store";
import { createRegistry, componentFromObject, OTHER, type ComponentRegistry } from "./component-registry";
import { loadAircraftModel } from "./model-loader";
import { runtime } from "./runtime";
import { setAircraftRegistry } from "./scene-refs";
import { AttitudeGhost, ForceIndicators } from "./ControlLabVisuals";
import { EngineStudy } from "./EngineStudy";
import { Jacks, useJackLift } from "./Jacks";
import { SystemSchematicView } from "./SystemSchematic";
import { AircraftLightsView } from "./AircraftLights";
import { HumanFigure, MeasureOverlay } from "./ScaleAids";

// Selection tint in 3D: the UI accent blended toward white so dark materials
// do not turn olive.
const ACCENT = new THREE.Color("#E7FF46").lerp(new THREE.Color("#ffffff"), 0.55);
const WHITE = new THREE.Color("#ffffff");
const WRONG = new THREE.Color("#ff8a6a");
const DEG = Math.PI / 180;

const moveTowards = (cur: number, target: number, maxDelta: number) =>
  Math.abs(target - cur) <= maxDelta ? target : cur + Math.sign(target - cur) * maxDelta;
const damp = THREE.MathUtils.damp;

const registryCache = new WeakMap<THREE.Object3D, ComponentRegistry>();

/**
 * One aircraft on the hangar floor. In EXPLORE the active aircraft is
 * interactive; in COMPARE both slots are passive and placed side by side.
 */
export function AircraftSlot({
  def,
  interactive,
  position = [0, 0, 0],
}: {
  def: AircraftDefinition;
  interactive: boolean;
  position?: [number, number, number];
}) {
  const [model, setModel] = useState<{ root: THREE.Group; reg: ComponentRegistry } | null>(null);
  const quality = useHangar((s) => s.resolvedQuality);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    let cancelled = false;
    (globalThis as { __hangarRenderer?: THREE.WebGLRenderer }).__hangarRenderer = gl;
    void (async () => {
      const root = await loadAircraftModel(def, quality);
      if (cancelled) return;
      let reg = registryCache.get(root);
      if (!reg) {
        reg = createRegistry(root, def);
        registryCache.set(root, reg);
      }
      if (useHangar.getState().phase === "loading") setProgress("model", 1);
      setModel({ root, reg });
      setAircraftRegistry(reg);
    })().catch((e) => console.error("[HANGAR] failed to load", def.id, e));
    return () => {
      cancelled = true;
    };
    // Quality changes after load do not rebuild the aircraft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  const reg = model?.reg ?? null;
  const hovered = useRef<string | null>(null);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!reg || !interactive) return;
    e.stopPropagation();
    const id = componentFromObject(reg, e.object);
    if (id !== hovered.current) {
      hovered.current = id;
      useHangar.setState({ hoveredComponent: id });
    }
  };
  const onOut = () => {
    if (!interactive) return;
    hovered.current = null;
    useHangar.setState({ hoveredComponent: null });
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!reg || !interactive || e.delta > 6) return;
    e.stopPropagation();
    const s = useHangar.getState();
    if (s.phase !== "ready" || s.mode === "compare") return;
    const id = componentFromObject(reg, e.object);
    if (!id) return;
    if (s.isolatedComponent && id !== s.isolatedComponent) return;
    selectComponent(id);
  };

  useSurfaceRigs(reg);
  useComponentFx(def, reg, interactive);
  const lifted = useRef<THREE.Group>(null);
  useJackLift(def, lifted);

  if (!model) return null;
  return (
    <group position={position}>
      <group ref={lifted}>
        <primitive object={model.root} onPointerMove={onMove} onPointerOut={onOut} onClick={onClick} />
        {interactive && <SystemSchematicView def={def} />}
        {def.lights && <AircraftLightsView def={def} root={model.root} />}
      </group>
      {def.jacks && <Jacks def={def} />}
      <MeasureOverlay def={def} side={position[2] > 0 ? 1 : -1} />
      <HumanFigure def={def} />
      {interactive && <AttitudeGhost def={def} reg={model.reg} />}
      {interactive && <ForceIndicators def={def} />}
      {interactive && def.engineStudy && <EngineStudy def={def} root={model.root} />}
    </group>
  );
}

// ─── Actuation clock ─────────────────────────────────────────────────────────

/**
 * Advances the shared, rate-limited actuator state once per frame. Every
 * aircraft on the floor reads from it.
 */
export function ActuationClock() {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useHangar.getState();
    const def = getAircraft(st.aircraftId);
    const input = st.controlInput;
    const detent = def.flapDetents[input.flaps] ?? def.flapDetents[0]!;
    const s = runtime.surfaces;
    // Actuator rate limits (normalised units per second) — mechanical, not springy.
    s.roll = moveTowards(s.roll, input.roll, 2.2 * dt);
    s.pitch = moveTowards(s.pitch, input.pitch, 2.0 * dt);
    s.yaw = moveTowards(s.yaw, input.yaw, 1.8 * dt);
    s.slat = moveTowards(s.slat, detent.slat, 0.32 * dt);
    s.flap = moveTowards(s.flap, detent.flap, 0.26 * dt);

    for (const key of new Set([...Object.keys(st.toggles), ...Object.keys(runtime.toggles)])) {
      const target = st.toggles[key] ? 1 : 0;
      const duration = def.toggleDurations?.[key] ?? 4;
      runtime.toggles[key] = moveTowards(runtime.toggles[key] ?? 0, target, dt / duration);
    }

    const fanTarget = st.fanRunning ? 7.5 : 0;
    runtime.fanSpeed = damp(runtime.fanSpeed, fanTarget, st.fanRunning ? 0.6 : 0.35, dt);

    // Representation attitude for the lab (lags the surfaces: cause → effect).
    const a = runtime.attitude;
    const demo = st.activeDemo;
    a.roll = damp(a.roll, demo === "roll" ? s.roll * 5 * DEG : 0, 1.6, dt);
    a.pitch = damp(a.pitch, demo === "pitch" ? s.pitch * 4 * DEG : 0, 1.6, dt);
    a.yaw = damp(a.yaw, demo === "yaw" ? -s.yaw * 6 * DEG : 0, 1.6, dt);
  });
  return null;
}

// ─── Control surfaces ────────────────────────────────────────────────────────

function deflectionFor(rig: ControlSurfaceRig): number {
  const s = runtime.surfaces;
  const d = rig.driver;
  switch (d.axis) {
    case "roll": {
      const v = s.roll * d.sign;
      return v >= 0 ? v * d.down : v * d.up;
    }
    case "pitch":
      return s.pitch >= 0 ? -s.pitch * d.up : -s.pitch * d.down;
    case "yaw":
      return s.yaw * d.max;
    case "rollSpoiler": {
      // Spoilers on the down-going wing rise (trailing edge up = negative).
      const v = d.side === "right" ? s.roll : -s.roll;
      return v > 0 ? -v * d.max : 0;
    }
    case "toggle": {
      const raw = runtime.toggles[d.key] ?? 0;
      // Optional phase: the motion happens in the later part of the toggle
      // (e.g. jack the aircraft first, then swing the gear).
      const from = d.from ?? 0;
      const e = Math.min(1, Math.max(0, (raw - from) / (1 - from)));
      // Mechanical ease: slow start and stop.
      return d.angle * (e * e * (3 - 2 * e));
    }
    case "flaps":
      return 0;
  }
}

function useSurfaceRigs(reg: ComponentRegistry | null) {
  const q = useMemo(() => new THREE.Quaternion(), []);
  const off = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    if (!reg) return;
    const dt = Math.min(rawDt, 0.05);
    const s = runtime.surfaces;
    for (const r of reg.rigs) {
      const { rig, node, axis, basePosition, baseQuaternion } = r;
      let angle = deflectionFor(rig) * DEG;
      node.position.copy(basePosition);
      if (rig.fowler) {
        const e = s.flap;
        // Fowler motion: mostly aft travel first, rotation grows with extension.
        const travel = Math.sin((Math.min(e * 1.15, 1) * Math.PI) / 2);
        off.set(0, -rig.fowler.down * e, rig.fowler.aft * travel).applyQuaternion(baseQuaternion);
        node.position.add(off);
        angle = rig.fowler.angle * DEG * Math.pow(e, 1.25);
      }
      if (rig.hingedFlap) angle = ((rig.hingedFlap.rest ?? 0) + rig.hingedFlap.angle * s.flap) * DEG;
      if (rig.slat) {
        const e = s.slat;
        off.set(0, -rig.slat.down * e, -rig.slat.forward * e).applyQuaternion(baseQuaternion);
        node.position.add(off);
        angle = -rig.slat.angle * DEG * e;
      }
      node.quaternion.copy(baseQuaternion).multiply(q.setFromAxisAngle(axis, angle * (rig.sign ?? 1)));
    }
    if (runtime.fanSpeed > 0.001) for (const f of reg.fans) f.rotateX(-runtime.fanSpeed * dt);
  });
}

// ─── Highlight / isolation / systems look ───────────────────────────────────

function useComponentFx(def: AircraftDefinition, reg: ComponentRegistry | null, interactive: boolean) {
  useFrame((_, rawDt) => {
    if (!reg) return;
    const dt = Math.min(rawDt, 0.05);
    const st = useHangar.getState();
    const active = interactive && st.aircraftId === def.id;
    const sys = active && st.mode === "systems" ? def.systems.find((x) => x.id === st.activeSystem) : undefined;
    const systemSet = new Set(sys?.components ?? []);
    const demoSet = new Set<string>();
    if (active && st.activeDemo) {
      for (const c of def.components) if (c.demo === st.activeDemo) demoSet.add(c.id);
    }
    if (active) runtime.hangarDim = damp(runtime.hangarDim, st.isolatedComponent ? 1 : 0, 4, dt);

    for (const [id, u] of reg.uniforms) {
      let hl = 0;
      let rim = 0;
      let fade = 1;
      let desat = 0;
      let color = WHITE;
      if (active) {
        const isSel = id === st.selectedComponent;
        const isHover = id === st.hoveredComponent && id !== OTHER;
        if (st.mode === "quiz") {
          // Quiz: neutral aircraft; feedback only on the part just picked.
          const q = st.quiz;
          const picked = q?.picked === id;
          if (picked && (q?.status === "correct" || q?.status === "revealed")) {
            color = ACCENT;
            rim = 0.3;
            hl = 0.05;
          } else if (picked && q?.status === "wrong") {
            color = WRONG;
            rim = 0.18;
          }
          if (isHover && !picked) hl = 0.05;
        } else if (st.isolatedComponent) {
          if (id === st.isolatedComponent) {
            rim = 0.05;
            color = ACCENT;
          } else {
            fade = 0.07;
            desat = 0.8;
          }
        } else if (sys?.schematic) {
          // X-ray: the airframe becomes a dark technical ghost behind the routing.
          const inSys = systemSet.has(id);
          // (Linear HDR: the lit airframe is well above 1.0, so ghost hard.)
          fade = inSys ? 0.6 : 0.055;
          desat = 0.9;
          if (inSys) {
            color = ACCENT;
            rim = 0.08;
          }
        } else if (sys) {
          const inSys = systemSet.has(id);
          const inDemo = demoSet.size === 0 || demoSet.has(id);
          if (inSys && inDemo) {
            color = ACCENT;
            rim = 0.1;
            hl = 0.012;
          } else {
            fade = inSys ? 0.62 : 0.42;
            desat = 0.65;
          }
          if (isHover && inSys) hl += 0.04;
        } else {
          if (isSel) {
            color = ACCENT;
            rim = 0.07;
            hl = 0.012;
          } else if (st.selectedComponent) {
            fade = 0.8;
            desat = 0.2;
          }
          if (isHover && !isSel) hl = 0.05;
        }
      }
      const k = 10;
      u.uHL.value.lerp(color, 1 - Math.exp(-k * dt));
      u.uHLAmt.value = damp(u.uHLAmt.value, hl, k, dt);
      u.uRim.value = damp(u.uRim.value, rim, k, dt);
      u.uFade.value = damp(u.uFade.value, fade, 6, dt);
      u.uDesat.value = damp(u.uDesat.value, desat, 6, dt);
    }
  });
}
