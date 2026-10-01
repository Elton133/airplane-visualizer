"use client";

import { AnimatePresence, motion } from "motion/react";
import { getAircraft } from "@/aircraft/registry";
import { useHangar } from "@/state/store";

/** Genuine download/build progress when another aircraft is brought in. */
export function AircraftLoading() {
  const loading = useHangar((s) => s.aircraftLoading);
  const mode = useHangar((s) => s.mode);
  return (
    <AnimatePresence>
      {loading && mode !== "compare" && (
        <motion.div
          className="aircraft-loading"
          initial={{ opacity: 0, x: "-50%" }}
          animate={{ opacity: 1, x: "-50%" }}
          exit={{ opacity: 0, x: "-50%" }}
          transition={{ duration: 0.2 }}
          role="status"
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="meta" style={{ color: "var(--text)" }}>
              ROLLING IN / {getAircraft(loading.id).designation}
            </span>
            <span className="meta">{Math.round(loading.progress * 100)}%</span>
          </div>
          <span className="bar">
            <i style={{ transform: `scaleX(${loading.progress})` }} />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
