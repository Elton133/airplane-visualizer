/**
 * Data-driven aircraft definitions.
 *
 * Everything aircraft-specific (geometry source, component → mesh mapping,
 * camera presets, control-surface rigging, educational content) lives in an
 * AircraftDefinition. The scene, camera and UI only ever read from it, so a
 * second aircraft is a new definition + model, not new application code.
 */

export type Vec3 = [number, number, number];

export interface CameraPreset {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view in degrees. Defaults to the global FOV. */
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
}

export type ComponentCategory =
  | "STRUCTURE"
  | "PROPULSION"
  | "FLIGHT CONTROL"
  | "HIGH LIFT"
  | "LANDING GEAR";

export interface SpecRow {
  label: string;
  value: string;
}

export interface ComponentContent {
  /** LEVEL 01 — what is it? One line. */
  what: string;
  /** LEVEL 01 — what does it do? */
  does: string;
  /** LEVEL 02 — how it works. Short paragraph(s). */
  how?: string[];
  /** LEVEL 03 — what is it connected to? */
  connections?: string[];
  /** Only values verified for the exact modeled variant. */
  specs?: SpecRow[];
}

export interface AircraftComponent {
  id: string;
  /** Display name, e.g. "LEFT ENGINE". */
  name: string;
  /** Large title in the inspection panel. */
  title: string;
  category: ComponentCategory;
  /** Meshes that belong to this component (node names in the model). */
  meshNames: string[];
  /**
   * Hotspot anchors in aircraft space (metres), placed inside the component's
   * own geometry. The nearest unoccluded anchor is used (e.g. for the pair of
   * ailerons).
   */
  anchors: Vec3[];
  /** Hotspot label becomes visible within this camera distance. */
  labelDistance: number;
  cameraPreset: string;
  /** Preset used when the component is isolated. Falls back to cameraPreset. */
  isolatePreset?: string;
  /** Optional system demo that this component participates in. */
  demo?: ControlAxis;
  /** Optional two-state mechanism the panel can operate (e.g. cargo ramp). */
  toggle?: ToggleDefinition;
  content: ComponentContent;
}

export type ControlAxis = "roll" | "pitch" | "yaw" | "flaps";

export interface ControlInput {
  /** -1 (left) … 1 (right) */
  roll: number;
  /** -1 (nose down) … 1 (nose up) */
  pitch: number;
  /** -1 (left) … 1 (right) */
  yaw: number;
  /** Index into the flap detent list. */
  flaps: number;
}

/**
 * How a rigged surface responds to control input.
 * Deflection convention: positive = trailing edge down (or, for the rudder,
 * trailing edge to starboard). Rig nodes are authored so that a positive
 * rotation about their local X axis (the hinge line) produces that.
 */
export type SurfaceDriver =
  | { axis: "roll"; up: number; down: number; sign: 1 | -1 }
  | { axis: "pitch"; up: number; down: number }
  | { axis: "yaw"; max: number }
  | { axis: "flaps"; key: "flap" | "slat" }
  | { axis: "rollSpoiler"; max: number; side: "left" | "right" }
  /** Two-state mechanism (e.g. cargo ramp), driven by a named toggle. */
  | { axis: "toggle"; key: string; angle: number; duration: number; from?: number };

export interface FowlerMotion {
  /** Aft travel along the local chord direction at full extension (m). */
  aft: number;
  /** Downward travel at full extension (m). */
  down: number;
  /** Maximum rotation at full extension (deg). */
  angle: number;
}

export interface SlatMotion {
  forward: number;
  down: number;
  angle: number;
}

export interface ControlSurfaceRig {
  id: string;
  /** Hinge node (or bone) name in the model. Trailing `*` matches a prefix. */
  node: string;
  /** Local hinge axis (default x). */
  axis?: "x" | "y" | "z";
  /**
   * Hinge axis in aircraft space, for assets whose node frames are not
   * aligned with the hinge. Converted to the node's local frame at load.
   */
  worldAxis?: Vec3;
  /** Flip the sign if the asset's positive rotation is reversed. */
  sign?: 1 | -1;
  driver: SurfaceDriver;
  fowler?: FowlerMotion;
  slat?: SlatMotion;
  /** Simple hinged flap: rotation (deg) at full extension, plus a rest offset. */
  hingedFlap?: { angle: number; rest?: number };
}

export interface FlapDetent {
  label: string;
  /** Normalised slat extension 0‥1. */
  slat: number;
  /** Normalised flap extension 0‥1. */
  flap: number;
}

export interface DemoDefinition {
  axis: ControlAxis;
  title: string;
  summary: string;
  chain: [string, string, string];
  body: string[];
  cameraPreset: string;
  /** Labels shown on the control. */
  negativeLabel?: string;
  positiveLabel?: string;
}

export interface SchematicLine {
  id: string;
  color: string;
  points: Vec3[];
  /** Flow speed along the line (m/s of dash travel); 0 = static. */
  flow?: number;
  dashed?: boolean;
  radius?: number;
}

export interface SchematicNode {
  id: string;
  label: string;
  detail?: string;
  at: Vec3;
  color: string;
}

/** A tank or zone: a quad (4 top corners, aircraft space) with a depth. */
export interface SchematicZone {
  id: string;
  label: string;
  color: string;
  corners: [Vec3, Vec3, Vec3, Vec3];
  depth: number;
}

export interface SystemSchematic {
  lines: SchematicLine[];
  nodes: SchematicNode[];
  zones?: SchematicZone[];
  legend: { color: string; label: string }[];
  note: string;
  cameraPreset?: string;
}

export interface AircraftSystem {
  id: string;
  name: string;
  available: boolean;
  /** Components highlighted while the system is active. */
  components: string[];
  description: string;
  /** Extra detail lines shown under the description. */
  facts?: string[];
  schematic?: SystemSchematic;
  /** Mechanisms the system panel can operate (e.g. gear swing test). */
  actions?: ToggleDefinition[];
}

export interface QuizQuestion {
  id: string;
  /** Small kicker above the prompt, e.g. "IDENTIFY" or "WHICH PART…". */
  kicker: string;
  /** The question itself, e.g. "THE ELEVATOR". */
  prompt: string;
  /** Component ids that count as correct. */
  answers: string[];
  /** Shown after a correct answer (or a reveal). One or two sentences. */
  explain: string;
}

export interface AircraftLight {
  id: string;
  kind: "nav" | "beacon" | "strobe" | "taxi";
  color: string;
  /** Aircraft-space position, or a node/bone in the model to place it at. */
  at?: Vec3;
  node?: string;
  /** Beam direction for taxi lights. */
  dir?: Vec3;
  /** Phase offset (s) so paired lights alternate. */
  phase?: number;
}

/** Jacking the aircraft for a gear swing test. */
export interface JackDefinition {
  toggle: string;
  /** Lift height (m) and the fraction of the toggle used for lifting. */
  lift: number;
  liftPhase: number;
  /** Jack heads (aircraft space, at the lifted height). */
  points: Vec3[];
}

export interface ModelTransform {
  /** Euler rotation in degrees, applied to bring the asset into aircraft space. */
  rotation?: Vec3;
  /** Uniform scale to true size (metres). */
  scale?: number;
  /** "auto" places the lowest point (tyres) on the floor. */
  ground?: "auto" | number;
}

export type ModelSource =
  | { kind: "procedural"; builder: string }
  | {
      kind: "gltf";
      url: string;
      /** Download size in bytes, for honest progress before headers arrive. */
      bytes?: number;
      draco?: boolean;
      transform?: ModelTransform;
      /** Procedural additions for parts the asset lacks (e.g. landing gear). */
      augment?: string[];
      /** Node names to hide (asset leftovers that are not part of the aircraft). */
      hide?: string[];
    };

export interface Credit {
  title: string;
  author: string;
  license: string;
  url: string;
  note?: string;
}

export interface ToggleDefinition {
  key: string;
  labelOn: string;
  labelOff: string;
  cameraPreset?: string;
}

export interface AircraftDefinition {
  id: string;
  /** Archive identifier, e.g. "A320 / 001". */
  designation: string;
  /** Short code used in tables, e.g. "A320". */
  code: string;
  /** Full display name, e.g. "Airbus A320-200". */
  displayName: string;
  manufacturer: string;
  family: string;
  variant: string;
  engine: string;
  /** Configuration note shown with the engine, e.g. "SHARKLETS". */
  configuration?: string;
  model: ModelSource;
  dimensions: {
    length: number;
    wingspan: number;
    height: number;
  };
  /** Verified reference data shown in compare / info. */
  reference: SpecRow[];
  /** Values compared side by side (label → display value). Only verified values. */
  compare: Record<CompareKey, string>;
  sources: string[];
  credits?: Credit[];
  /** Livery / asset notes shown in the info panel. */
  notes?: string[];
  cameraPresets: Record<string, CameraPreset>;
  /** Limits for the free orbit camera. */
  orbit: {
    minDistance: number;
    maxDistance: number;
    targetBounds: { min: Vec3; max: Vec3 };
    /** Point the aircraft attitude demo rotates about. */
    attitudePivot: Vec3;
  };
  components: AircraftComponent[];
  surfaces: ControlSurfaceRig[];
  flapDetents: FlapDetent[];
  demos: Record<ControlAxis, DemoDefinition>;
  systems: AircraftSystem[];
  /** Meshes used as camera colliders so the camera cannot enter the aircraft. */
  colliderMeshes: string[];
  /** Fan nodes spun when the engine demo runs. */
  fanNodes: string[];
  /** Note shown in the flaps lab when detents are conceptual rather than real. */
  flapNote?: string;
  /** Engine explode / airflow study, when the asset supports it. */
  engineStudy?: EngineStudy;
  /** Jacks for maintenance demonstrations. */
  jacks?: JackDefinition;
  /** Seconds for each named toggle to travel (default 4). */
  toggleDurations?: Record<string, number>;
  /** Exterior lights at the modelled light units. */
  lights?: AircraftLight[];
  /** Where the 1.75 m human-scale figure stands (aircraft space). */
  humanSpot?: Vec3;
  /** Quiz questions. Without them, identify-questions are generated from components. */
  quiz?: QuizQuestion[];
}

export type CompareKey = "length" | "wingspan" | "height" | "engines" | "role";

export interface EngineModule {
  id: "fan" | "lpc" | "hpc" | "combustor" | "hpt" | "lpt" | "exhaust";
  name: string;
  /** Verified stage count for this engine, if known. */
  stages?: string;
  description: string;
  /** Axial displacement in the exploded view (m, + forward). */
  explode: number;
}

export interface EngineStudy {
  /** Builder for the internal geometry (lazy-loaded). */
  builder: string;
  engine: string;
  /** Component id → engine node name in the model. */
  engines: Record<string, string>;
  /** Component id → camera preset for the study. */
  presets: Record<string, string>;
  modules: EngineModule[];
  airflowNote: string;
}
