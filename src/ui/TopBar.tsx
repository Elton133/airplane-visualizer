"use client";

import { motion } from "motion/react";
import { ArrowDown01Icon, HelpCircleIcon, InformationCircleIcon, Settings02Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { getAircraft } from "@/aircraft/registry";
import { setMode, toggleLabels, togglePanel } from "@/state/controller";
import { useHangar, type ExplorerMode } from "@/state/store";
import { Icon } from "./Icon";

const MODES: { id: ExplorerMode; label: string; tag?: string }[] = [
  { id: "explore", label: "EXPLORE" },
  { id: "systems", label: "SYSTEMS" },
  { id: "compare", label: "COMPARE" },
  { id: "quiz", label: "QUIZ" },
];

function Tabs({ layoutId }: { layoutId: string }) {
  const mode = useHangar((s) => s.mode);
  return (
    <nav className="tabs" role="tablist" aria-label="Mode">
      {MODES.map((m) => (
        <button key={m.id} className="tab" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}>
          {m.label}
          {m.tag && <sup>{m.tag}</sup>}
          {mode === m.id && (
            <motion.span className="tab-indicator" layoutId={layoutId} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }} />
          )}
        </button>
      ))}
    </nav>
  );
}

export function TopBar() {
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const panel = useHangar((s) => s.panel);
  const labels = useHangar((s) => s.labelsVisible);
  return (
    <header className="topbar">
      <div className="wordmark">
        HANGAR <small>/ 001</small>
      </div>
      <Tabs layoutId="tab-desktop" />
      <div className="top-right">
        <button
          className="designation switcher"
          aria-haspopup="listbox"
          aria-expanded={panel === "collection"}
          onClick={() => togglePanel("collection")}
        >
          {def.designation}
          <Icon icon={ArrowDown01Icon} size={12} />
        </button>
        <button className="icon-btn" aria-label="Toggle labels (L)" aria-pressed={!labels} onClick={toggleLabels} title="Labels (L)">
          <Icon icon={labels ? ViewIcon : ViewOffSlashIcon} />
        </button>
        <button className="icon-btn" aria-label="Aircraft information" aria-pressed={panel === "info"} onClick={() => togglePanel("info")}>
          <Icon icon={InformationCircleIcon} />
        </button>
        <button className="icon-btn" aria-label="Settings" aria-pressed={panel === "settings"} onClick={() => togglePanel("settings")}>
          <Icon icon={Settings02Icon} />
        </button>
        <button className="icon-btn" aria-label="Help (?)" aria-pressed={panel === "help"} onClick={() => togglePanel("help")}>
          <Icon icon={HelpCircleIcon} />
        </button>
      </div>
    </header>
  );
}

export function MobileTabs() {
  return (
    <div className="mobile-tabs">
      <Tabs layoutId="tab-mobile" />
    </div>
  );
}
