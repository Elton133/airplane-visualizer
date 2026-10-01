"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { getAircraft } from "@/aircraft/registry";
import { exitIsolation } from "@/state/controller";
import { useHangar } from "@/state/store";
import { Icon } from "./Icon";

export function IsolationBanner() {
  const id = useHangar((s) => s.isolatedComponent);
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const c = def.components.find((x) => x.id === id);
  return (
    <AnimatePresence>
      {c && (
        <motion.div
          className="banner"
          initial={{ opacity: 0, y: -6, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -6, x: "-50%" }}
          transition={{ duration: 0.2 }}
        >
          <span className="meta" style={{ color: "var(--text)" }}>
            ISOLATED / <span style={{ color: "var(--accent)" }}>{c.name}</span>
          </span>
          <button className="btn" onClick={exitIsolation}>
            RETURN TO AIRCRAFT <Icon icon={ArrowTurnBackwardIcon} size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
