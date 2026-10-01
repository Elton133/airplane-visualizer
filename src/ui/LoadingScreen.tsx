"use client";

import { useHangar, type LoadKey } from "@/state/store";

const ROWS: LoadKey[] = ["model", "textures", "environment"];

/** Minimal: black, the wordmark, and genuine loading progress per asset group. */
export function LoadingScreen() {
  const phase = useHangar((s) => s.phase);
  const progress = useHangar((s) => s.progress);
  return (
    <div className="loader" data-done={phase !== "loading"} aria-hidden={phase !== "loading"}>
      <div className="loader-inner">
        <h1>HANGAR</h1>
        <div className="meta">INITIALIZING AIRCRAFT</div>
        <div className="load-rows">
          {ROWS.map((k) => (
            <div className="load-row meta" key={k}>
              <span>{k}</span>
              <span className="pct">{progress[k] >= 1 ? "READY" : `${Math.round(progress[k] * 100)}%`}</span>
              <span className="bar">
                <i style={{ transform: `scaleX(${progress[k]})` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
