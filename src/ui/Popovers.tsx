"use client";

import { AnimatePresence, motion } from "motion/react";
import { AIRCRAFT_LIST, getAircraft, UPCOMING } from "@/aircraft/registry";
import { setAircraft, toggleDarkHangar, toggleHuman, toggleLabels, toggleMeasure, toggleSound } from "@/state/controller";
import { detectQuality, useHangar, type QualitySetting } from "@/state/store";

const QUALITY: QualitySetting[] = ["auto", "high", "balanced", "performance"];

function Help() {
  const rows = [
    ["DRAG", "ROTATE"],
    ["SCROLL / PINCH", "ZOOM"],
    ["RIGHT-DRAG", "PAN"],
    ["CLICK / TAP", "INSPECT"],
    ["ESC", "BACK"],
  ];
  const keys = [
    ["R", "RESET VIEW"],
    ["F", "FOCUS SELECTED"],
    ["I", "ISOLATE"],
    ["L", "LABELS"],
    ["M · H · N", "MEASURE · HUMAN · DARK HANGAR"],
    ["1 · 2 · 3", "EXPLORE · SYSTEMS · COMPARE"],
  ];
  return (
    <>
      <div className="meta" style={{ marginBottom: 8 }}>
        NAVIGATION
      </div>
      <div className="kv">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
      <div className="meta" style={{ margin: "18px 0 8px" }}>
        KEYBOARD
      </div>
      <div className="kv">
        {keys.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Settings() {
  const quality = useHangar((s) => s.quality);
  const resolved = useHangar((s) => s.resolvedQuality);
  const labels = useHangar((s) => s.labelsVisible);
  const measure = useHangar((s) => s.measure);
  const human = useHangar((s) => s.human);
  const dark = useHangar((s) => s.lighting === "dark");
  const sound = useHangar((s) => s.sound);
  const set = (q: QualitySetting) =>
    useHangar.setState({ quality: q, resolvedQuality: q === "auto" ? detectQuality() : q });
  return (
    <>
      <div className="meta">QUALITY</div>
      <div className="seg">
        {QUALITY.map((q) => (
          <button key={q} aria-pressed={quality === q} onClick={() => set(q)}>
            {q.toUpperCase()}
          </button>
        ))}
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        ACTIVE / {resolved.toUpperCase()} · Affects pixel ratio, shadows, ambient occlusion and reflections.
      </p>
      <div className="kv" style={{ marginTop: 14 }}>
        <span className="k">LABELS</span>
        <button className="v" onClick={toggleLabels} style={{ color: labels ? "var(--accent)" : "var(--muted)" }}>
          {labels ? "ON" : "OFF"}
        </button>
        <span className="k">MEASURE</span>
        <button className="v" onClick={toggleMeasure} style={{ color: measure ? "var(--accent)" : "var(--muted)" }}>
          {measure ? "ON" : "OFF"}
        </button>
        <span className="k">HUMAN SCALE</span>
        <button className="v" onClick={toggleHuman} style={{ color: human ? "var(--accent)" : "var(--muted)" }}>
          {human ? "ON" : "OFF"}
        </button>
        <span className="k">DARK HANGAR</span>
        <button className="v" onClick={toggleDarkHangar} style={{ color: dark ? "var(--accent)" : "var(--muted)" }}>
          {dark ? "ON" : "OFF"}
        </button>
        <span className="k">SOUND · SYNTHESIZED</span>
        <button className="v" onClick={toggleSound} style={{ color: sound ? "var(--accent)" : "var(--muted)" }}>
          {sound ? "ON" : "OFF"}
        </button>
      </div>
    </>
  );
}

function Info() {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  return (
    <>
      <div className="meta">AIRCRAFT / {def.designation}</div>
      <div style={{ fontSize: 18, fontWeight: 500, margin: "8px 0 4px" }}>
        {def.manufacturer} {def.variant}
      </div>
      <div className="meta" style={{ marginBottom: 12 }}>
        {def.engine}
        {def.configuration ? ` · ${def.configuration}` : ""}
      </div>
      <div className="kv">
        {def.reference.map((r) => (
          <div key={r.label} style={{ display: "contents" }}>
            <span className="k">{r.label}</span>
            <span className="v">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="meta" style={{ margin: "16px 0 6px" }}>
        SOURCES
      </div>
      {def.sources.map((s) => (
        <p key={s} style={{ fontSize: 11.5, color: "#c9cbc8", lineHeight: 1.5, marginBottom: 4 }}>
          {s}
        </p>
      ))}
      {def.credits?.map((c) => (
        <div key={c.title} style={{ marginTop: 14 }}>
          <div className="meta" style={{ marginBottom: 6 }}>
            MODEL CREDIT
          </div>
          <p style={{ fontSize: 11.5, color: "#c9cbc8", lineHeight: 1.5 }}>
            “{c.title}” by {c.author} ·{" "}
            <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "var(--text)" }}>
              source
            </a>{" "}
            · {c.license}
          </p>
          {c.note && <p className="note" style={{ marginTop: 6 }}>{c.note}</p>}
        </div>
      ))}
      {def.notes?.map((n) => (
        <p key={n} className="note">
          {n}
        </p>
      ))}
    </>
  );
}

function Collection() {
  const current = useHangar((s) => s.aircraftId);
  const loading = useHangar((s) => s.aircraftLoading);
  return (
    <>
      <div className="meta" style={{ marginBottom: 8 }}>
        COLLECTION
      </div>
      <ul className="collection" role="listbox" aria-label="Aircraft">
        {AIRCRAFT_LIST.map((a) => (
          <li key={a.id}>
            <button role="option" aria-selected={a.id === current} onClick={() => setAircraft(a.id)}>
              <span className="d">{a.designation}</span>
              <span className="n">{a.displayName}</span>
              <span className="meta">{loading?.id === a.id ? `${Math.round(loading.progress * 100)}%` : a.id === current ? "ON FLOOR" : ""}</span>
            </button>
          </li>
        ))}
        {UPCOMING.map((u) => (
          <li key={u.designation}>
            <button disabled>
              <span className="d">{u.designation}</span>
              <span className="n">{u.name}</span>
              <span className="meta">COMING</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Popovers() {
  const panel = useHangar((s) => s.panel);
  return (
    <AnimatePresence>
      {panel && (
        <motion.div
          key={panel}
          className="popover"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {panel === "help" && <Help />}
          {panel === "settings" && <Settings />}
          {panel === "info" && <Info />}
          {panel === "collection" && <Collection />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
