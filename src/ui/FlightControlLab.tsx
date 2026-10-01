"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { getAircraft } from "@/aircraft/registry";
import type { ControlAxis } from "@/aircraft/types";
import { exitDemo, setControl, startDemo } from "@/state/controller";
import { useHangar } from "@/state/store";
import { runtime } from "@/scene/runtime";
import { Icon } from "./Icon";

const AXES: ControlAxis[] = ["roll", "pitch", "yaw", "flaps"];
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function useDrag(onValue: (clientX: number, clientY: number, rect: DOMRect) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      onValue(e.clientX, e.clientY, el.getBoundingClientRect());
    },
    onPointerMove: (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el || !el.hasPointerCapture(e.pointerId)) return;
      onValue(e.clientX, e.clientY, el.getBoundingClientRect());
    },
  };
  return { ref, handlers };
}

function keyStep(e: React.KeyboardEvent, value: number, set: (v: number) => void, invert = false) {
  const d = 0.1 * (invert ? -1 : 1);
  if (e.key === "ArrowRight" || e.key === "ArrowUp") set(clamp(value + (e.key === "ArrowUp" ? -d : d)));
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(clamp(value - (e.key === "ArrowDown" ? -d : d)));
  else if (e.key === "Home" || e.key === "0") set(0);
  else return;
  e.preventDefault();
  e.stopPropagation();
}

function HSlider({ axis, neg, pos }: { axis: "roll" | "yaw"; neg: string; pos: string }) {
  const value = useHangar((s) => s.controlInput[axis]);
  const set = (v: number) => setControl(axis, Math.abs(v) < 0.04 ? 0 : v);
  const { ref, handlers } = useDrag((x, _y, r) => set(clamp(((x - r.left) / r.width) * 2 - 1)));
  const pct = (value + 1) * 50;
  return (
    <div className="hslider">
      <span className="meta">{neg}</span>
      <div
        ref={ref}
        className="track"
        role="slider"
        tabIndex={0}
        aria-label={axis}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number(value.toFixed(2))}
        onKeyDown={(e) => keyStep(e, value, set)}
        onDoubleClick={() => set(0)}
        {...handlers}
      >
        <span className="centre" />
        <span className="fill" style={{ left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%` }} />
        <span className="knob" style={{ left: `${pct}%` }} />
      </div>
      <span className="meta">{pos}</span>
    </div>
  );
}

function VSlider() {
  const value = useHangar((s) => s.controlInput.pitch);
  const set = (v: number) => setControl("pitch", Math.abs(v) < 0.04 ? 0 : v);
  // Top = nose down (push), bottom = nose up (pull back).
  const { ref, handlers } = useDrag((_x, y, r) => set(clamp(((y - r.top) / r.height) * 2 - 1)));
  const pct = (value + 1) * 50;
  return (
    <div className="vslider">
      <div className="meta" style={{ textAlign: "right" }}>
        PUSH
        <br />
        PULL
      </div>
      <div className="vwrap">
        <span className="meta">NOSE DOWN</span>
        <div
          ref={ref}
          className="vtrack"
          role="slider"
          tabIndex={0}
          aria-label="pitch"
          aria-orientation="vertical"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={Number(value.toFixed(2))}
          onKeyDown={(e) => keyStep(e, value, set, true)}
          onDoubleClick={() => set(0)}
          {...handlers}
        >
          <span className="centre" />
          <span className="fill" style={{ top: `${Math.min(50, pct)}%`, height: `${Math.abs(pct - 50)}%` }} />
          <span className="knob" style={{ top: `${pct}%` }} />
        </div>
        <span className="meta">NOSE UP</span>
      </div>
      <div />
    </div>
  );
}

function Detents() {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const value = useHangar((s) => s.controlInput.flaps);
  return (
    <div className="detents" role="radiogroup" aria-label="Flap lever" style={{ gridTemplateColumns: `repeat(${def.flapDetents.length}, 1fr)` }}>
      {def.flapDetents.map((d, i) => (
        <button key={d.label} className="detent" aria-pressed={value === i} onClick={() => setControl("flaps", i)}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

/** Which links of the cause → effect chain are currently active. */
function useChain(axis: ControlAxis) {
  const [steps, setSteps] = useState<[boolean, boolean, boolean]>([false, false, false]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const st = useHangar.getState();
      const s = runtime.surfaces;
      const a = runtime.attitude;
      let next: [boolean, boolean, boolean];
      if (axis === "flaps") {
        const ext = s.flap + s.slat;
        next = [st.controlInput.flaps > 0, ext > 0.02, ext > 0.3];
      } else {
        const input = Math.abs(st.controlInput[axis]);
        const surf = Math.abs(s[axis]);
        const att = Math.abs(a[axis]) / (Math.PI / 180);
        next = [input > 0.03, surf > 0.05, att > 0.6];
      }
      setSteps((p) => (p[0] === next[0] && p[1] === next[1] && p[2] === next[2] ? p : next));
    }, 90);
    return () => window.clearInterval(id);
  }, [axis]);
  return steps;
}

function Readout({ axis }: { axis: ControlAxis }) {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const input = useHangar((s) => s.controlInput);
  let text: string;
  if (axis === "flaps") text = `LEVER / ${def.flapDetents[input.flaps]?.label ?? "0"}`;
  else {
    const v = input[axis];
    const demo = def.demos[axis];
    const dir = v === 0 ? "NEUTRAL" : v > 0 ? demo.positiveLabel : demo.negativeLabel;
    text = `INPUT / ${dir} ${v === 0 ? "" : `${Math.round(Math.abs(v) * 100)} %`}`;
  }
  return (
    <div className="readout">
      <span className="meta" style={{ color: "var(--text)" }}>
        {text}
      </span>
      {axis !== "flaps" && (
        <button className="meta" onClick={() => setControl(axis, 0)}>
          CENTRE
        </button>
      )}
    </div>
  );
}

function Explanation({ axis }: { axis: ControlAxis }) {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const d = def.demos[axis];
  const steps = useChain(axis);
  return (
    <motion.aside
      className="panel right lab-explain"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22 }}
    >
      <div className="panel-head">
        <span className="meta">FLIGHT CONTROL LAB / {d.title}</span>
      </div>
      <div className="panel-body">
        <div className="title">{d.title}</div>
        <p className="lede">{d.summary}</p>
        <div className="chain">
          {d.chain.map((c, i) => (
            <div key={c}>
              <div className="step" data-on={steps[i]}>
                {c}
              </div>
              {i < 2 && <div className="arrow">↓</div>}
            </div>
          ))}
        </div>
        {d.body.map((p) => (
          <p key={p} style={{ fontSize: 13, lineHeight: 1.55, color: "#c9cbc8", marginBottom: 10 }}>
            {p}
          </p>
        ))}
        <p className="note">
          Educational representation · the accent axis shows a representative attitude response against the dashed reference; the parked aircraft stays on its gear.
          {axis !== "flaps" && " Force arrows are simplified and not to scale."}
          {axis === "flaps" && def.flapNote && ` ${def.flapNote}`}
        </p>
      </div>
    </motion.aside>
  );
}

export function FlightControlLab() {
  const demo = useHangar((s) => s.activeDemo);
  const def = getAircraft(useHangar((s) => s.aircraftId));
  return (
    <>
      <motion.section
        className="lab"
        initial={{ opacity: 0, y: 12, x: "-50%" }}
        animate={{ opacity: 1, y: 0, x: "-50%" }}
        exit={{ opacity: 0, y: 12, x: "-50%" }}
        transition={{ duration: 0.22 }}
      >
        <div className="lab-head">
          <span className="caps">FLIGHT CONTROL LAB</span>
          {demo && (
            <button className="icon-btn" aria-label="Exit demonstration" onClick={exitDemo}>
              <Icon icon={Cancel01Icon} size={14} />
            </button>
          )}
        </div>
        <div className="lab-tabs" role="tablist">
          {AXES.map((a) => (
            <button key={a} role="tab" className="lab-tab" aria-selected={demo === a} onClick={() => startDemo(a)}>
              {def.demos[a].title}
            </button>
          ))}
        </div>
        {demo && (
          <div className="control">
            {demo === "roll" && <HSlider axis="roll" neg="LEFT" pos="RIGHT" />}
            {demo === "yaw" && <HSlider axis="yaw" neg="LEFT" pos="RIGHT" />}
            {demo === "pitch" && <VSlider />}
            {demo === "flaps" && <Detents />}
            <Readout axis={demo} />
          </div>
        )}
        {!demo && (
          <p className="meta" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Select an axis, then move the control.
          </p>
        )}
      </motion.section>
      <AnimatePresence>{demo && <Explanation key={demo} axis={demo} />}</AnimatePresence>
    </>
  );
}
