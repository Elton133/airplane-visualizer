"use client";

import { motion } from "motion/react";
import { getAircraft } from "@/aircraft/registry";
import { setSystem, toggleMechanism } from "@/state/controller";
import { useHangar } from "@/state/store";

export function SystemsPanel() {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const active = useHangar((s) => s.activeSystem);
  const toggles = useHangar((s) => s.toggles);
  const sys = def.systems.find((s) => s.id === active);
  return (
    <motion.aside
      className="panel left"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
    >
      <div className="panel-head" style={{ paddingBottom: 4 }}>
        <span className="meta">SYSTEMS / {def.family}</span>
      </div>
      <ul className="sys-list">
        {def.systems.map((s, i) => (
          <li key={s.id}>
            <button
              className="sys-item"
              aria-pressed={active === s.id}
              disabled={!s.available}
              onClick={() => setSystem(active === s.id ? null : s.id)}
              title={s.available ? s.name : `${s.name} — planned for V2`}
            >
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span>{s.name}</span>
              {!s.available && <span className="tag meta">V2</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="sys-desc">
        {sys ? sys.description : "Select a system to see how it works inside the aircraft."}
        {sys?.facts?.map((f) => (
          <p key={f} className="fact">
            {f}
          </p>
        ))}
        {sys?.schematic && (
          <div className="legend" style={{ marginTop: 12, marginBottom: 0 }}>
            {sys.schematic.legend.map((l) => (
              <div key={l.label}>
                <i style={{ background: l.color }} /> {l.label}
              </div>
            ))}
            <p className="note" style={{ marginTop: 8 }}>
              {sys.schematic.note}
            </p>
          </div>
        )}
        {sys?.actions?.map((a) => (
          <button
            key={a.key}
            className="btn"
            data-variant="accent"
            aria-pressed={!!toggles[a.key]}
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => toggleMechanism(a.key, a.cameraPreset)}
          >
            {toggles[a.key] ? a.labelOn : a.labelOff}
          </button>
        ))}
      </div>
    </motion.aside>
  );
}
