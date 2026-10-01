import { create } from "zustand";
import type { ControlAxis, ControlInput } from "@/aircraft/types";
import { DEFAULT_AIRCRAFT } from "@/aircraft/registry";

export type ExplorerMode = "explore" | "systems" | "compare" | "quiz";
export type Phase = "loading" | "revealing" | "ready";
export type QualitySetting = "auto" | "high" | "balanced" | "performance";
export type QualityLevel = Exclude<QualitySetting, "auto">;
export type LoadKey = "model" | "textures" | "environment";

export interface HangarState {
  aircraftId: string;
  phase: Phase;
  progress: Record<LoadKey, number>;

  mode: ExplorerMode;
  selectedComponent: string | null;
  hoveredComponent: string | null;
  isolatedComponent: string | null;
  activeSystem: string | null;
  activeDemo: ControlAxis | null;

  labelsVisible: boolean;
  fanRunning: boolean;
  panel: "help" | "settings" | "info" | "collection" | null;

  quality: QualitySetting;
  resolvedQuality: QualityLevel;

  /** Target control input. The scene eases surfaces toward it. */
  controlInput: ControlInput;

  cameraMode: "free" | "auto";
  view: string;

  /** Aircraft model loading after the initial reveal (switching, compare). */
  aircraftLoading: { id: string; progress: number } | null;
  /** Two-state mechanisms (cargo ramp, …) by key. */
  toggles: Record<string, boolean>;
  /** The pair shown side by side in COMPARE. */
  compareIds: [string, string];
  /** Scale aids and environment. */
  measure: boolean;
  human: boolean;
  lighting: "hangar" | "dark";
  aircraftLights: boolean;
  sound: boolean;
  /** Quiz round state (mode "quiz"). */
  quiz: QuizState | null;
  /** Engine explode / airflow study on one engine component. */
  engineStudy: { component: string; view: "explode" | "airflow" } | null;
}

export interface QuizState {
  /** Question ids in play order. */
  order: string[];
  index: number;
  status: "asking" | "wrong" | "correct" | "revealed" | "done";
  /** Wrong picks on the current question. */
  misses: number;
  /** Component the user last clicked. */
  picked: string | null;
  /** Questions answered correctly on the first try. */
  firstTry: number;
  answered: number;
}

export const NEUTRAL_INPUT: ControlInput = { roll: 0, pitch: 0, yaw: 0, flaps: 0 };

export function detectQuality(): QualityLevel {
  if (typeof window === "undefined") return "balanced";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 4;
  if (coarse) return mem >= 4 && cores >= 6 ? "balanced" : "performance";
  return cores >= 8 && mem >= 8 ? "high" : "balanced";
}

export const useHangar = create<HangarState>(() => ({
  aircraftId: DEFAULT_AIRCRAFT,
  phase: "loading",
  progress: { model: 0, textures: 0, environment: 0 },

  mode: "explore",
  selectedComponent: null,
  hoveredComponent: null,
  isolatedComponent: null,
  activeSystem: null,
  activeDemo: null,

  labelsVisible: true,
  fanRunning: false,
  panel: null,

  quality: "auto",
  resolvedQuality: detectQuality(),

  controlInput: { ...NEUTRAL_INPUT },

  cameraMode: "free",
  view: "PORT FRONT",

  aircraftLoading: null,
  toggles: {},
  compareIds: ["a320", "c17"],
  engineStudy: null,
  quiz: null,
  measure: false,
  human: false,
  lighting: "hangar",
  aircraftLights: false,
  sound: false,
}));

export const setProgress = (key: LoadKey, value: number) =>
  useHangar.setState((s) => ({ progress: { ...s.progress, [key]: Math.max(s.progress[key], value) } }));
