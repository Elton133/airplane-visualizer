"use client";

import { motion } from "motion/react";
import { getAircraft } from "@/aircraft/registry";
import type { CompareKey } from "@/aircraft/types";
import { useHangar } from "@/state/store";

const ROWS: { key: CompareKey; label: string }[] = [
  { key: "length", label: "LENGTH" },
  { key: "wingspan", label: "WINGSPAN" },
  { key: "height", label: "HEIGHT" },
  { key: "engines", label: "ENGINES" },
  { key: "role", label: "ROLE" },
];

/** Side-by-side verified figures; both aircraft stand behind it at 1:1. */
export function ComparePanel() {
  const [ia, ib] = useHangar((s) => s.compareIds);
  const loading = useHangar((s) => s.aircraftLoading);
  const a = getAircraft(ia);
  const b = getAircraft(ib);
  return (
    <motion.section
      className="compare"
      initial={{ opacity: 0, y: 8, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: 8, x: "-50%" }}
      transition={{ duration: 0.24 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="meta">COMPARE / TRUE SCALE 1:1</span>
        <span className="meta" style={{ color: loading ? "var(--accent)" : "var(--muted)" }}>
          {loading ? `LOADING ${getAircraft(loading.id).code} · ${Math.round(loading.progress * 100)}%` : "SAME FLOOR · SAME CAMERA"}
        </span>
      </div>
      <div className="cmp-grid">
        <div className="cmp-head">{a.code}</div>
        <div className="c" />
        <div className="cmp-head r">{b.code}</div>
        {ROWS.map((r) => (
          <div key={r.key} className={`row-${r.key}`} style={{ display: "contents" }}>
            <div className="l">{a.compare[r.key]}</div>
            <div className="c">{r.label}</div>
            <div className="r">{b.compare[r.key]}</div>
          </div>
        ))}
      </div>
      <p className="note">
        Noses aligned on one datum line, wingtip to wingtip. Neither aircraft is resized. Figures: {a.sources[0]}; {b.sources[0]}.
      </p>
    </motion.section>
  );
}
