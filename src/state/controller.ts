import type { ControlAxis, ControlInput } from "@/aircraft/types";
import { getAircraft } from "@/aircraft/registry";
import { flyTo, stopFlight } from "@/scene/camera-director";
import { compareCamera } from "@/scene/compare-layout";
import { NEUTRAL_INPUT, useHangar, type ExplorerMode } from "./store";

/**
 * Every user intent goes through here, so UI, keyboard and 3D picking share
 * one set of transitions and the camera is only directed from one place.
 */

const def = () => getAircraft(useHangar.getState().aircraftId);
const preset = (name: string) => {
  const p = def().cameraPresets[name];
  if (!p) throw new Error(`Missing camera preset ${name}`);
  return p;
};

export function goHomeCamera() {
  void flyTo(preset("HOME"));
}

export function selectComponent(id: string) {
  const c = def().components.find((x) => x.id === id);
  if (!c) return;
  const s = useHangar.getState();
  if (s.mode === "compare") return;
  if (s.mode === "quiz") return quizAnswer(id);
  const leavingStudy = !!s.engineStudy && s.engineStudy.component !== id;
  useHangar.setState({
    selectedComponent: id,
    isolatedComponent: s.isolatedComponent && s.isolatedComponent !== id ? null : s.isolatedComponent,
    panel: null,
    ...(leavingStudy ? { engineStudy: null, fanRunning: false, isolatedComponent: null } : {}),
  });
  void flyTo(preset(c.cameraPreset));
}

export function focusSelected() {
  const { selectedComponent, isolatedComponent } = useHangar.getState();
  const id = isolatedComponent ?? selectedComponent;
  const c = def().components.find((x) => x.id === id);
  if (c) void flyTo(preset(c.isolatePreset ?? c.cameraPreset));
}

export function deselect() {
  useHangar.setState({ selectedComponent: null, isolatedComponent: null, engineStudy: null, fanRunning: false });
}

export function isolate() {
  const { selectedComponent, isolatedComponent } = useHangar.getState();
  if (isolatedComponent) return exitIsolation();
  if (!selectedComponent) return;
  useHangar.setState({ isolatedComponent: selectedComponent });
  focusSelected();
}

export function exitIsolation() {
  if (useHangar.getState().engineStudy) return closeEngineStudy();
  useHangar.setState({ isolatedComponent: null });
}

export function setMode(mode: ExplorerMode) {
  const s = useHangar.getState();
  if (s.phase !== "ready" || s.mode === mode) return;
  useHangar.setState({
    mode,
    engineStudy: null,
    quiz: null,
    fanRunning: false,
    toggles: {},
    selectedComponent: null,
    isolatedComponent: null,
    activeSystem: mode === "systems" ? s.activeSystem : null,
    activeDemo: null,
    controlInput: { ...NEUTRAL_INPUT, flaps: mode === "systems" ? s.controlInput.flaps : 0 },
    panel: null,
  });
  if (mode === "quiz") {
    startQuiz();
    return;
  }
  if (mode === "compare") {
    const [a, b] = useHangar.getState().compareIds;
    void flyTo(compareCamera(getAircraft(a), getAircraft(b)), { duration: 1.5 });
  } else void flyTo(preset(mode === "systems" ? "SYSTEMS" : "HOME"));
}

/** Bring another aircraft from the collection onto the floor. */
export function setAircraft(id: string) {
  const s = useHangar.getState();
  if (s.aircraftId === id || s.phase !== "ready") return;
  stopFlight();
  useHangar.setState({
    aircraftId: id,
    mode: s.mode === "compare" ? "explore" : s.mode,
    selectedComponent: null,
    hoveredComponent: null,
    isolatedComponent: null,
    activeSystem: null,
    activeDemo: null,
    fanRunning: false,
    panel: null,
    toggles: {},
    engineStudy: null,
    controlInput: { ...NEUTRAL_INPUT },
  });
  void flyTo(getAircraft(id).cameraPresets.HOME!, { duration: 1.5 });
}

/** Open the engine explode / airflow study on the selected engine. */
export function openEngineStudy(view: "explode" | "airflow") {
  const s = useHangar.getState();
  const study = def().engineStudy;
  const id = s.selectedComponent;
  if (!study || !id || !study.engines[id]) return;
  useHangar.setState({ engineStudy: { component: id, view }, isolatedComponent: id, fanRunning: view === "airflow" });
  void flyTo(preset(study.presets[id] ?? "HOME"));
}

export function closeEngineStudy() {
  const s = useHangar.getState();
  if (!s.engineStudy) return;
  const id = s.engineStudy.component;
  useHangar.setState({ engineStudy: null, isolatedComponent: null, fanRunning: false });
  const c = def().components.find((x) => x.id === id);
  if (c) void flyTo(preset(c.cameraPreset));
}

/** Operate a two-state mechanism (e.g. the cargo ramp). */
export function toggleMechanism(key: string, cameraPreset?: string) {
  useHangar.setState((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } }));
  if (cameraPreset) void flyTo(preset(cameraPreset));
}

export function setSystem(id: string | null) {
  const sys = def().systems.find((x) => x.id === id);
  if (id && (!sys || !sys.available)) return;
  useHangar.setState({ activeSystem: id, activeDemo: null, selectedComponent: null, isolatedComponent: null, toggles: {} });
  if (useHangar.getState().mode !== "systems") useHangar.setState({ mode: "systems" });
  void flyTo(preset(sys?.schematic?.cameraPreset ?? "SYSTEMS"));
}

/** Open the Flight Control Lab on one axis (from SYSTEMS or an inspection panel). */
export function startDemo(axis: ControlAxis) {
  const s = useHangar.getState();
  useHangar.setState({
    mode: "systems",
    activeSystem: "flightControls",
    activeDemo: axis,
    selectedComponent: null,
    isolatedComponent: null,
    panel: null,
    controlInput: { ...NEUTRAL_INPUT, flaps: s.controlInput.flaps },
  });
  void flyTo(preset(def().demos[axis].cameraPreset));
}

export function exitDemo() {
  const s = useHangar.getState();
  useHangar.setState({ activeDemo: null, controlInput: { ...NEUTRAL_INPUT, flaps: s.controlInput.flaps } });
  void flyTo(preset("SYSTEMS"));
}

export function setControl<K extends keyof ControlInput>(key: K, value: ControlInput[K]) {
  useHangar.setState((s) => ({ controlInput: { ...s.controlInput, [key]: value } }));
}

export function toggleFan() {
  useHangar.setState((s) => ({ fanRunning: !s.fanRunning }));
}

export function toggleLabels() {
  useHangar.setState((s) => ({ labelsVisible: !s.labelsVisible }));
}

export function togglePanel(panel: "help" | "settings" | "info" | "collection") {
  useHangar.setState((s) => ({ panel: s.panel === panel ? null : panel }));
}

/** One click back to a known state: aircraft normal, camera home, panels closed. */
export function resetView() {
  stopFlight();
  useHangar.setState({
    mode: "explore",
    selectedComponent: null,
    hoveredComponent: null,
    isolatedComponent: null,
    activeSystem: null,
    activeDemo: null,
    fanRunning: false,
    panel: null,
    toggles: {},
    engineStudy: null,
    quiz: null,
    controlInput: { ...NEUTRAL_INPUT },
  });
  goHomeCamera();
}

/** ESC: unwind one level at a time. Never traps the user. */
export function back() {
  const s = useHangar.getState();
  if (s.panel) return useHangar.setState({ panel: null });
  if (s.engineStudy) return closeEngineStudy();
  if (s.mode === "quiz") return setMode("explore");
  if (s.isolatedComponent) return exitIsolation();
  if (s.activeDemo) return exitDemo();
  if (s.selectedComponent) return deselect();
  if (s.activeSystem) return setSystem(null);
  if (s.mode !== "explore") return setMode("explore");
}

export function toggleMeasure() {
  useHangar.setState((s) => ({ measure: !s.measure }));
}

export function toggleHuman() {
  useHangar.setState((s) => ({ human: !s.human }));
}

/** Dark hangar: house lights down, aircraft lights on. */
export function toggleDarkHangar() {
  useHangar.setState((s) => {
    const dark = s.lighting !== "dark";
    return { lighting: dark ? "dark" : "hangar", aircraftLights: dark ? true : s.aircraftLights };
  });
}

export function toggleAircraftLights() {
  useHangar.setState((s) => ({ aircraftLights: !s.aircraftLights }));
}

export function toggleSound() {
  useHangar.setState((s) => ({ sound: !s.sound }));
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

const ROUND = 8;

/** The aircraft's questions, or identify-questions generated from its components. */
export function quizQuestions() {
  const d = def();
  if (d.quiz?.length) return d.quiz;
  return d.components.map((c) => ({
    id: `id-${c.id}`,
    kicker: "IDENTIFY",
    prompt: `THE ${c.name}`,
    answers: [c.id],
    explain: c.content.does,
  }));
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

export function startQuiz() {
  const order = shuffle(quizQuestions().map((q) => q.id)).slice(0, ROUND);
  useHangar.setState({
    mode: "quiz",
    selectedComponent: null,
    isolatedComponent: null,
    activeSystem: null,
    activeDemo: null,
    engineStudy: null,
    panel: null,
    toggles: {},
    controlInput: { ...NEUTRAL_INPUT },
    quiz: { order, index: 0, status: "asking", misses: 0, picked: null, firstTry: 0, answered: 0 },
  });
  void flyTo(preset("HOME"));
}

export function currentQuestion() {
  const q = useHangar.getState().quiz;
  if (!q) return null;
  return quizQuestions().find((x) => x.id === q.order[q.index]) ?? null;
}

export function quizAnswer(componentId: string) {
  const s = useHangar.getState();
  const q = s.quiz;
  const question = currentQuestion();
  if (!q || !question || (q.status !== "asking" && q.status !== "wrong")) return;
  if (question.answers.includes(componentId)) {
    useHangar.setState({
      quiz: {
        ...q,
        status: "correct",
        picked: componentId,
        firstTry: q.firstTry + (q.misses === 0 ? 1 : 0),
        answered: q.answered + 1,
      },
    });
  } else {
    useHangar.setState({ quiz: { ...q, status: "wrong", misses: q.misses + 1, picked: componentId } });
  }
}

/** Show the answer: highlight it and fly the camera there. */
export function quizReveal() {
  const q = useHangar.getState().quiz;
  const question = currentQuestion();
  if (!q || !question) return;
  useHangar.setState({ quiz: { ...q, status: "revealed", picked: question.answers[0] ?? null, answered: q.answered + 1 } });
  const c = def().components.find((x) => x.id === question.answers[0]);
  if (c) void flyTo(preset(c.cameraPreset));
}

export function quizNext() {
  const q = useHangar.getState().quiz;
  if (!q) return;
  if (q.index + 1 >= q.order.length) {
    useHangar.setState({ quiz: { ...q, status: "done", picked: null } });
    saveBest(q.firstTry, q.order.length);
  } else {
    useHangar.setState({ quiz: { ...q, index: q.index + 1, status: "asking", misses: 0, picked: null } });
  }
  void flyTo(preset("HOME"));
}

const BEST_KEY = () => `hangar.quiz.best.${useHangar.getState().aircraftId}`;

/** Personal best is a per-viewer convenience: browser storage, failure-tolerant. */
function saveBest(score: number, of: number) {
  try {
    const prev = Number(localStorage.getItem(BEST_KEY()) ?? "-1");
    if (score > prev) localStorage.setItem(BEST_KEY(), String(score));
    localStorage.setItem(`${BEST_KEY()}.of`, String(of));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function quizBest(): number | null {
  try {
    const v = localStorage.getItem(BEST_KEY());
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
