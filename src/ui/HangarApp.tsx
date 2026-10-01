"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { useHangar } from "@/state/store";
import {
  back,
  focusSelected,
  isolate,
  resetView,
  setMode,
  toggleDarkHangar,
  toggleHuman,
  toggleLabels,
  toggleMeasure,
  togglePanel,
} from "@/state/controller";
import { useHangarSound } from "./sound";
import { TopBar, MobileTabs } from "./TopBar";
import { BottomBar } from "./BottomBar";
import { LoadingScreen } from "./LoadingScreen";
import { Hotspots, CursorTag } from "./Hotspots";
import { InspectionPanel } from "./InspectionPanel";
import { IsolationBanner } from "./IsolationBanner";
import { SystemsPanel } from "./SystemsPanel";
import { FlightControlLab } from "./FlightControlLab";
import { ComparePanel } from "./ComparePanel";
import { Popovers } from "./Popovers";
import { AircraftLoading } from "./AircraftLoading";
import { QuizPanel } from "./QuizPanel";

const Experience = dynamic(() => import("@/scene/Experience"), { ssr: false });

function useDevHandle() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    void Promise.all([import("@/state/controller"), import("@/scene/camera-director"), import("@/scene/scene-refs"), import("three")]).then(([controller, camera, refs, three]) => {
      (window as unknown as { __hangar: unknown }).__hangar = { controller, camera, refs, three, store: useHangar };
    });
  }, []);
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (useHangar.getState().phase !== "ready") return;
      switch (e.key) {
        case "Escape":
          back();
          break;
        case "r":
        case "R":
          resetView();
          break;
        case "f":
        case "F":
          focusSelected();
          break;
        case "i":
        case "I":
          isolate();
          break;
        case "l":
        case "L":
          toggleLabels();
          break;
        case "1":
          setMode("explore");
          break;
        case "2":
          setMode("systems");
          break;
        case "3":
          setMode("compare");
          break;
        case "4":
          setMode("quiz");
          break;
        case "?":
          togglePanel("help");
          break;
        case "m":
        case "M":
          toggleMeasure();
          break;
        case "h":
        case "H":
          toggleHuman();
          break;
        case "n":
        case "N":
          toggleDarkHangar();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function HangarApp() {
  useKeyboard();
  useDevHandle();
  useHangarSound();
  const ready = useHangar((s) => s.phase === "ready");
  const mode = useHangar((s) => s.mode);
  const selected = useHangar((s) => s.selectedComponent);
  const activeSystem = useHangar((s) => s.activeSystem);
  const demo = useHangar((s) => s.activeDemo);

  return (
    <main className="hangar">
      <div className="viewport">
        <Experience />
      </div>
      <Hotspots />
      <CursorTag />
      <div className="chrome" data-ready={ready} data-lab={mode === "systems" && activeSystem === "flightControls"} data-sheet={!!selected}>
        <TopBar />
        <BottomBar />
        <MobileTabs />
        <IsolationBanner />
        <AnimatePresence>{mode === "systems" && !demo && <SystemsPanel key="systems" />}</AnimatePresence>
        <AnimatePresence>
          {mode === "systems" && activeSystem === "flightControls" && <FlightControlLab key="lab" />}
        </AnimatePresence>
        <AnimatePresence>{selected && mode !== "compare" && <InspectionPanel key={selected} id={selected} />}</AnimatePresence>
        <AnimatePresence>{mode === "compare" && <ComparePanel key="compare" />}</AnimatePresence>
        <AnimatePresence>{mode === "quiz" && <QuizPanel key="quiz" />}</AnimatePresence>
        <Popovers />
        <AircraftLoading />
      </div>
      <LoadingScreen />
    </main>
  );
}
