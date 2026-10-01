"use client";

import { useEffect, useRef } from "react";
import { getAircraft } from "@/aircraft/registry";
import { selectComponent } from "@/state/controller";
import { useHangar } from "@/state/store";
import { hotspotNodes } from "@/scene/hotspot-dom";

/**
 * DOM hotspot labels. Positions and visibility are written directly by the
 * in-canvas HotspotTracker — React renders them once.
 */
export function Hotspots() {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const ready = useHangar((s) => s.phase === "ready");
  return (
    <div className="hotspots" data-ready={ready}>
      {def.components.map((c, i) => (
        <div
          key={c.id}
          className="hotspot"
          data-state="hidden"
          ref={(el) => {
            if (el) hotspotNodes.set(c.id, el);
            else hotspotNodes.delete(c.id);
          }}
        >
          <button className="hs-dot" aria-label={c.name} onClick={() => selectComponent(c.id)} />
          <div className="hs-label">
            <span className="hs-line" />
            <div className="hs-text">
              <div className="hs-name">{c.name}</div>
              <div className="hs-cat">
                {String(i + 1).padStart(2, "0")} / {c.category}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small reticle + component name following the pointer while hovering a part. */
export function CursorTag() {
  const ref = useRef<HTMLDivElement>(null);
  const hovered = useHangar((s) => s.hoveredComponent);
  const selected = useHangar((s) => s.selectedComponent);
  const ready = useHangar((s) => s.phase === "ready");
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const quiz = useHangar((s) => s.mode === "quiz");
  const name = quiz ? (hovered ? "SELECT" : undefined) : def.components.find((c) => c.id === hovered)?.name;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (ref.current) ref.current.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY + 14}px, 0)`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    document.body.style.cursor = hovered && ready ? "pointer" : "";
  }, [hovered, ready]);

  return (
    <div ref={ref} className="cursor-tag" data-on={!!name && ready && hovered !== selected}>
      <i />
      {name}
    </div>
  );
}
