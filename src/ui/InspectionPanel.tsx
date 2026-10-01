"use client";

import { useState } from "react";
import { motion, type PanInfo } from "motion/react";
import { ArrowRight01Icon, Cancel01Icon, Fan01Icon, Layers01Icon } from "@hugeicons/core-free-icons";
import { getAircraft } from "@/aircraft/registry";
import type { AircraftComponent } from "@/aircraft/types";
import { closeEngineStudy, deselect, isolate, openEngineStudy, startDemo, toggleFan, toggleMechanism } from "@/state/controller";
import { useHangar } from "@/state/store";
import { Icon } from "./Icon";
import { useIsMobile } from "./useIsMobile";

const DEMO_LABEL = { roll: "ROLL", pitch: "PITCH", yaw: "YAW", flaps: "FLAPS" } as const;

function Disclosure({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="disclosure" data-open={open}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="caps">
          <span className="meta" style={{ marginRight: 10 }}>
            {index}
          </span>
          {title}
        </span>
        <span>›</span>
      </button>
      {open && (
        <motion.div className="content" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {children}
        </motion.div>
      )}
    </div>
  );
}

function Body({ c }: { c: AircraftComponent }) {
  const isolated = useHangar((s) => s.isolatedComponent === c.id);
  const fan = useHangar((s) => s.fanRunning);
  const toggled = useHangar((s) => (c.toggle ? !!s.toggles[c.toggle.key] : false));
  const hasFan = useHangar((s) => getAircraft(s.aircraftId).fanNodes.length > 0);
  const studyable = useHangar((s) => !!getAircraft(s.aircraftId).engineStudy?.engines[c.id]);
  const content = c.content;
  return (
    <>
      <div className="title">{c.title}</div>
      <div className="qa">
        <div className="meta">01 / WHAT IS IT?</div>
        <p>{content.what}</p>
      </div>
      <div className="qa">
        <div className="meta">WHAT DOES IT DO?</div>
        <p>{content.does}</p>
      </div>

      {content.specs && content.specs.length > 0 && (
        <dl className="specs" style={{ marginTop: 16 }}>
          {content.specs.map((s) => (
            <div key={s.label} style={{ display: "contents" }}>
              <dt className="meta">{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="actions">
        <button className="btn" aria-pressed={isolated} onClick={isolate}>
          {isolated ? "RETURN TO AIRCRAFT" : "ISOLATE"}
          <Icon icon={Layers01Icon} size={14} />
        </button>
        {c.demo && (
          <button className="btn" data-variant="accent" onClick={() => startDemo(c.demo!)}>
            CONTROL LAB · {DEMO_LABEL[c.demo]}
            <Icon icon={ArrowRight01Icon} size={14} />
          </button>
        )}
        {c.toggle && (
          <button className="btn" data-variant="accent" aria-pressed={toggled} onClick={() => toggleMechanism(c.toggle!.key, c.toggle!.cameraPreset)}>
            {toggled ? c.toggle.labelOn : c.toggle.labelOff}
            <Icon icon={ArrowRight01Icon} size={14} />
          </button>
        )}
        {c.category === "PROPULSION" && (
          <>
            {hasFan && (
              <button className="btn" aria-pressed={fan} onClick={toggleFan}>
                {fan ? "STOP FAN" : "ROTATE FAN"}
                <span className="tag">SLOWED FOR VISIBILITY</span>
                <Icon icon={Fan01Icon} size={14} />
              </button>
            )}
            <button className="btn" data-variant="accent" disabled={!studyable} onClick={() => openEngineStudy("explode")}>
              EXPLODE VIEW
              {studyable ? <Icon icon={ArrowRight01Icon} size={14} /> : <span className="tag">NOT AVAILABLE FOR THIS ASSET</span>}
            </button>
            <button className="btn" disabled={!studyable} onClick={() => openEngineStudy("airflow")}>
              HOW IT WORKS · AIRFLOW
              {studyable ? <Icon icon={ArrowRight01Icon} size={14} /> : <span className="tag">—</span>}
            </button>
          </>
        )}
      </div>

      {content.how && (
        <Disclosure index="02" title="HOW IT WORKS">
          {content.how.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Disclosure>
      )}
      {content.connections && (
        <Disclosure index="03" title="CONNECTED TO">
          <ul>
            {content.connections.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Disclosure>
      )}
    </>
  );
}

function StudyBody({ c }: { c: AircraftComponent }) {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const view = useHangar((s) => s.engineStudy?.view ?? "explode");
  const study = def.engineStudy!;
  return (
    <>
      <div className="title">{study.engine}{"\n"}{view === "explode" ? "EXPLODED VIEW" : "AIRFLOW"}</div>
      <div className="lab-tabs" role="tablist" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        {(["explode", "airflow"] as const).map((v) => (
          <button key={v} role="tab" className="lab-tab" aria-selected={view === v} onClick={() => openEngineStudy(v)}>
            {v === "explode" ? "EXPLODE" : "AIRFLOW"}
          </button>
        ))}
      </div>
      {view === "airflow" && (
        <div className="legend">
          <div><i style={{ background: "#a9c3d6" }} /> BYPASS AIR · COOL</div>
          <div><i style={{ background: "linear-gradient(90deg,#a9c3d6,#e3b06a,#e9773d)" }} /> CORE AIR · COOL → HOT</div>
          <p className="note" style={{ marginTop: 10 }}>{study.airflowNote}</p>
        </div>
      )}
      <ol className="modules">
        {study.modules.map((m, i) => (
          <li key={m.id}>
            <div className="mh">
              <span className="meta">{String(i + 1).padStart(2, "0")}</span>
              <span className="caps">{m.name}</span>
              {m.stages && <span className="meta">{m.stages}</span>}
            </div>
            <p>{m.description}</p>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button className="btn" onClick={closeEngineStudy}>
          RETURN TO {c.name}
          <Icon icon={Layers01Icon} size={14} />
        </button>
      </div>
    </>
  );
}

function Head({ c }: { c: AircraftComponent }) {
  return (
    <div className="panel-head">
      <span className="meta">COMPONENT / {c.category}</span>
      <button className="icon-btn" aria-label="Close (Esc)" onClick={deselect}>
        <Icon icon={Cancel01Icon} size={15} />
      </button>
    </div>
  );
}

export function InspectionPanel({ id }: { id: string }) {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const mobile = useIsMobile();
  const c = def.components.find((x) => x.id === id);
  const [expanded, setExpanded] = useState(false);
  const studying = useHangar((s) => s.engineStudy?.component === id);
  if (!c) return null;

  if (mobile) {
    // Bottom sheet: peeks at ~30 % of the screen, drag the grip up to expand,
    // down to collapse / close.
    const peek = "48dvh";
    const onPanEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.y > 80 || info.velocity.y > 500) {
        if (expanded) setExpanded(false);
        else deselect();
      } else if (info.offset.y < -40 || info.velocity.y < -500) setExpanded(true);
    };
    return (
      <motion.aside
        className="sheet"
        initial={{ y: "100%" }}
        animate={{ y: expanded ? "0%" : peek }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <motion.div className="sheet-grip" onPanEnd={onPanEnd} onTap={() => setExpanded((e) => !e)} />
        <Head c={c} />
        <div className="panel-body">{studying ? <StudyBody c={c} /> : <Body c={c} />}</div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      className="panel right"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Head c={c} />
      <div className="panel-body">{studying ? <StudyBody c={c} /> : <Body c={c} />}</div>
    </motion.aside>
  );
}
