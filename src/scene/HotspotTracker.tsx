"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { AircraftDefinition } from "@/aircraft/types";
import { useHangar } from "@/state/store";
import { componentFromObject } from "./component-registry";
import { getAircraftRegistry } from "./scene-refs";
import { hotspotNodes } from "./hotspot-dom";

type LabelState = "hidden" | "dot" | "label";

interface Track {
  occluded: boolean[];
  state: LabelState;
  x: number;
  y: number;
}

const LABEL_W = 170;
const LABEL_H = 40;

/**
 * Projects component anchors to the screen and decides, per frame, whether
 * each hotspot is hidden, a dot, or a full label. Occlusion is a ray test
 * against the aircraft (BVH-accelerated), round-robin over a few anchors per
 * frame to keep the cost flat.
 */
export function HotspotTracker({ def }: { def: AircraftDefinition }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster();
    r.firstHitOnly = true;
    return r;
  }, []);
  const tracks = useRef(
    new Map<string, Track>(
      def.components.map((c) => [c.id, { occluded: c.anchors.map(() => false), state: "hidden", x: 0, y: 0 }]),
    ),
  );
  const cursor = useRef(0);
  const v = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const hits = useMemo<THREE.Intersection[]>(() => [], []);

  // Flattened list of (component, anchor) pairs for round-robin occlusion tests.
  const pairs = useMemo(
    () => def.components.flatMap((c) => c.anchors.map((a, i) => ({ id: c.id, i, p: new THREE.Vector3(...a) }))),
    [def],
  );

  useFrame(() => {
    const reg = getAircraftRegistry();
    const st = useHangar.getState();
    camera.getWorldPosition(camPos);

    // Occlusion: test a handful of anchors per frame.
    if (reg) {
      const n = Math.min(4, pairs.length);
      for (let k = 0; k < n; k++) {
        const pr = pairs[cursor.current % pairs.length]!;
        cursor.current++;
        const dist = camPos.distanceTo(pr.p);
        dir.copy(pr.p).sub(camPos).normalize();
        raycaster.set(camPos, dir);
        raycaster.far = dist - 0.05;
        hits.length = 0;
        let occluded = false;
        for (const m of reg.meshes) {
          if (!m.visible) continue;
          m.raycast(raycaster, hits);
        }
        hits.sort((a, b) => a.distance - b.distance);
        for (const h of hits) {
          const id = componentFromObject(reg, h.object);
          if (id === pr.id) continue;
          if ((h.object as THREE.Mesh).material && ((h.object as THREE.Mesh).material as THREE.Material).transparent) continue;
          occluded = true;
          break;
        }
        tracks.current.get(pr.id)!.occluded[pr.i] = occluded;
      }
    }

    const sys = st.mode === "systems" ? def.systems.find((s) => s.id === st.activeSystem) : undefined;
    const ready = st.phase === "ready" && st.labelsVisible && st.mode !== "compare" && st.mode !== "quiz" && !st.engineStudy;
    const placed: { x: number; y: number }[] = [];
    const order = def.components
      .map((c) => {
        const t = tracks.current.get(c.id)!;
        let best = -1;
        let bestD = Infinity;
        c.anchors.forEach((a, i) => {
          if (t.occluded[i]) return;
          const d = camPos.distanceTo(v.set(...a));
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        return { c, t, best, d: bestD };
      })
      .sort((a, b) => a.d - b.d);

    for (const { c, t, best, d } of order) {
      let state: LabelState = "hidden";
      if (ready && best >= 0) {
        v.set(...c.anchors[best]!).project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 0.96 && Math.abs(v.y) < 0.92;
        const allowed =
          (!st.isolatedComponent || st.isolatedComponent === c.id) &&
          (!sys || sys.components.includes(c.id)) &&
          (!st.activeDemo || c.demo === st.activeDemo);
        if (onScreen && allowed && d < 95) {
          t.x = (v.x * 0.5 + 0.5) * size.width;
          t.y = (-v.y * 0.5 + 0.5) * size.height;
          const wants =
            d < c.labelDistance ||
            st.selectedComponent === c.id ||
            st.isolatedComponent === c.id ||
            !!sys;
          state = "dot";
          if (wants) {
            const overlaps = placed.some((p) => Math.abs(p.x - t.x) < LABEL_W && Math.abs(p.y - t.y) < LABEL_H);
            if (!overlaps) {
              state = "label";
              placed.push({ x: t.x, y: t.y });
            }
          }
        }
      }
      const el = hotspotNodes.get(c.id);
      if (!el) continue;
      if (state !== "hidden") el.style.transform = `translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0)`;
      if (t.state !== state) {
        t.state = state;
        el.dataset.state = state;
      }
      const sel = st.selectedComponent === c.id || st.isolatedComponent === c.id ? "1" : "0";
      if (el.dataset.selected !== sel) el.dataset.selected = sel;
    }
  });
  return null;
}
