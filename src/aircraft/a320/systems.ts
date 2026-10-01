import type { AircraftSystem, SchematicLine, SchematicNode, Vec3 } from "../types";

/**
 * A320 system schematics. Routing is conceptual — it shows what connects to
 * what, not actual pipe or wire paths — and component locations are
 * approximate. Facts follow the A320 FCOM architecture.
 */

const NOTE = "Schematic — conceptual routing; component locations approximate. Not a maintenance reference.";

const C = {
  green: "#62b57c",
  blue: "#5f8fd6",
  yellow: "#d9bd52",
  ac: "#e09b55",
  dc: "#86a9cf",
  emer: "#d47c7c",
  fuel: "#d7a14c",
  bleed: "#c9d2db",
};

const line = (id: string, color: string, points: Vec3[], flow = 1.6, extra: Partial<SchematicLine> = {}): SchematicLine => ({
  id,
  color,
  points,
  flow,
  ...extra,
});
const node = (id: string, label: string, at: Vec3, color: string, detail?: string): SchematicNode => ({ id, label, at, color, detail });

// Mirror helper for symmetric wing runs.
const m = (p: Vec3): Vec3 => [p[0], p[1], -p[2]];

/** Wing trunk: from the belly hub out along the rear spar to the aileron. */
function wingRun(dz: number, dy: number): Vec3[] {
  return [
    [0, 2.45 + dy, 1.2 + dz],
    [0.8, 2.75 + dy, 3.2 + dz],
    [-0.2, 3.0 + dy, 7 + dz * 0.5],
    [-1.4, 3.35 + dy, 11.5],
    [-2.4, 3.6 + dy, 14.3],
  ];
}

function tailRun(dz: number): Vec3[] {
  return [
    [-0.5, 2.4, dz],
    [-6, 3.2, dz],
    [-12, 4.2, dz],
    [-15.8, 4.85, dz],
    [-16.6, 5.0, 3.4 * Math.sign(dz || 1)],
  ];
}

export const A320_SYSTEMS: AircraftSystem[] = [
  {
    id: "hydraulic",
    name: "HYDRAULIC",
    available: true,
    components: [],
    description:
      "Three independent hydraulic systems — green, blue and yellow — power the flight controls, landing gear and brakes. No single failure removes control of the aircraft.",
    facts: [
      "Nominal pressure 3,000 psi.",
      "Green: engine 1 pump. Yellow: engine 2 pump plus an electric pump. Blue: electric pump, plus the ram air turbine in an emergency.",
      "The power transfer unit (PTU) lets green and yellow pressurise each other without exchanging fluid.",
    ],
    schematic: {
      cameraPreset: "SYSTEMS_XRAY",
      note: NOTE,
      legend: [
        { color: C.green, label: "GREEN · ENGINE 1 PUMP" },
        { color: C.blue, label: "BLUE · ELECTRIC PUMP + RAT" },
        { color: C.yellow, label: "YELLOW · ENGINE 2 PUMP + ELECTRIC PUMP" },
      ],
      lines: [
        line("g-pump", C.green, [[4.2, 2.62, -5.75], [3.2, 2.5, -4.2], [1.4, 2.4, -2.2], [0, 2.45, -0.35]]),
        line("y-pump", C.yellow, [[4.2, 2.62, 5.75], [3.2, 2.5, 4.2], [1.4, 2.4, 2.2], [0, 2.45, 0.35]]),
        line("g-wing-l", C.green, wingRun(-0.2, 0).map(m)),
        line("g-wing-r", C.green, wingRun(-0.2, 0)),
        line("b-wing-l", C.blue, wingRun(0, 0.08).map(m)),
        line("b-wing-r", C.blue, wingRun(0, 0.08)),
        line("y-wing-l", C.yellow, wingRun(0.2, 0.16).map(m)),
        line("y-wing-r", C.yellow, wingRun(0.2, 0.16)),
        line("g-tail", C.green, tailRun(-0.3)),
        line("b-tail", C.blue, tailRun(0.0001)),
        line("y-tail", C.yellow, tailRun(0.3)),
        line("g-gear-l", C.green, [[0, 2.45, -0.35], [1.15, 2.45, -2.4], [1.15, 2.3, -3.6]]),
        line("g-gear-r", C.green, [[0, 2.45, -0.35], [1.15, 2.45, 2.4], [1.15, 2.3, 3.6]]),
        line("y-nws", C.yellow, [[0, 2.45, 0.35], [6, 2.2, 0.4], [12.6, 2.0, 0.3], [13.8, 1.95, 0.15]]),
        line("b-rat", C.blue, [[3.2, 1.85, 0.2], [1.6, 2.1, 0.1], [0, 2.45, 0]]),
        line("ptu", "#9aa3ab", [[0.4, 2.3, -0.35], [0.4, 2.3, 0.35]], 0, { dashed: true, radius: 0.035 }),
      ],
      nodes: [
        node("g", "ENGINE 1 PUMP", [4.2, 2.62, -5.75], C.green, "GREEN"),
        node("y", "ENGINE 2 PUMP", [4.2, 2.62, 5.75], C.yellow, "YELLOW"),
        node("res", "RESERVOIRS · PUMPS", [-0.9, 2.45, 0], "#c9cbc8", "GREEN · BLUE · YELLOW"),
        node("ptu", "PTU", [0.4, 2.3, 0.35], "#9aa3ab", "GREEN ↔ YELLOW"),
        node("rat", "RAM AIR TURBINE", [3.2, 1.85, 0.2], C.blue, "EMERGENCY · BLUE"),
        node("wings", "WING FLIGHT CONTROLS", [-2.4, 3.6, -14.3], "#c9cbc8", "AILERONS · SPOILERS · HIGH LIFT"),
        node("tail", "TAIL FLIGHT CONTROLS", [-16.6, 5.0, -3.4], "#c9cbc8", "ELEVATORS · RUDDER · THS"),
        node("gear", "LANDING GEAR · BRAKES", [1.15, 2.3, -3.6], C.green, "GREEN"),
        node("nws", "NOSEWHEEL STEERING", [13.8, 1.95, 0.15], C.yellow, "YELLOW"),
      ],
    },
  },
  {
    id: "electrical",
    name: "ELECTRICAL",
    available: true,
    components: [],
    description:
      "Each engine drives an integrated drive generator (IDG) supplying 115 V AC at a constant 400 Hz. Transformer-rectifiers convert AC to 28 V DC, and two batteries back up the DC network.",
    facts: [
      "The APU generator can replace either engine generator.",
      "If all main generators are lost, the ram air turbine drives the blue hydraulic system, which turns an emergency generator.",
      "Buses and converters sit in the avionics bay beneath the cockpit.",
    ],
    schematic: {
      cameraPreset: "SYSTEMS_XRAY",
      note: NOTE,
      legend: [
        { color: C.ac, label: "AC GENERATION · 115 V 400 Hz" },
        { color: C.dc, label: "DC · 28 V" },
        { color: C.emer, label: "EMERGENCY GENERATION" },
      ],
      lines: [
        line("idg1", C.ac, [[3.4, 1.62, -5.75], [3.6, 2.6, -5.0], [2.2, 2.5, -2.2], [2.5, 2.1, -0.3], [8, 2.2, -0.3], [12.3, 2.55, -0.3]], 2.4),
        line("idg2", C.ac, [[3.4, 1.62, 5.75], [3.6, 2.6, 5.0], [2.2, 2.5, 2.2], [2.5, 2.1, 0.3], [8, 2.2, 0.3], [12.3, 2.55, 0.3]], 2.4),
        line("apu", C.ac, [[-17.6, 4.9, 0], [-12, 4.1, 0.6], [-4, 2.6, 0.6], [4, 2.15, 0.6], [12.3, 2.55, 0.6]], 2.4),
        line("emer", C.emer, [[3.2, 1.85, 0.2], [6, 2.0, 0], [12.3, 2.45, 0]], 1.8),
        line("dc", C.dc, [[12.3, 2.55, 0], [10.2, 2.4, 0.8]], 0.8),
        line("cabin", C.ac, [[12.3, 2.7, 0], [10, 3.5, 0], [-10, 4.5, 0], [-18, 4.9, 0]], 1.4, { radius: 0.03 }),
      ],
      nodes: [
        node("idg1", "IDG 1", [3.4, 1.62, -5.75], C.ac, "ENGINE 1"),
        node("idg2", "IDG 2", [3.4, 1.62, 5.75], C.ac, "ENGINE 2"),
        node("apu", "APU GENERATOR", [-17.6, 4.9, 0], C.ac, "TAIL CONE"),
        node("bay", "AVIONICS BAY", [12.3, 2.55, 0], "#c9cbc8", "AC / DC BUSES · TR UNITS"),
        node("bat", "BATTERIES (2)", [10.2, 2.4, 0.8], C.dc),
        node("emer", "EMERGENCY GENERATOR", [3.2, 1.85, 0.2], C.emer, "RAT → BLUE HYDRAULICS"),
      ],
    },
  },
  {
    id: "fuel",
    name: "FUEL",
    available: true,
    components: [],
    description:
      "Fuel is carried inside the wing box and in the centre wing box under the cabin. Pumps in each tank feed the engines through a crossfeed-capable manifold.",
    facts: [
      "Each wing has an inner and an outer tank; outer-tank fuel transfers into the inner tank as it empties, keeping weight outboard to relieve wing bending.",
      "The APU draws from the left-side feed line.",
    ],
    schematic: {
      cameraPreset: "SYSTEMS_TOP",
      note: NOTE,
      legend: [
        { color: C.fuel, label: "FUEL TANKS" },
        { color: "#e8d3a3", label: "ENGINE / APU FEED" },
      ],
      zones: [
        { id: "il", label: "INNER TANK", color: C.fuel, corners: [[4.77, 2.62, -2.1], [0.55, 3.3, -11], [-0.76, 3.3, -11], [2.08, 2.62, -2.1]], depth: 0.42 },
        { id: "ol", label: "OUTER TANK", color: C.fuel, corners: [[0.55, 3.3, -11], [-1.65, 3.7, -15.5], [-2.5, 3.7, -15.5], [-0.76, 3.3, -11]], depth: 0.26 },
        { id: "ir", label: "INNER TANK", color: C.fuel, corners: [[4.77, 2.62, 2.1], [0.55, 3.3, 11], [-0.76, 3.3, 11], [2.08, 2.62, 2.1]], depth: 0.42 },
        { id: "or", label: "OUTER TANK", color: C.fuel, corners: [[0.55, 3.3, 11], [-1.65, 3.7, 15.5], [-2.5, 3.7, 15.5], [-0.76, 3.3, 11]], depth: 0.26 },
        { id: "ctr", label: "CENTRE TANK", color: C.fuel, corners: [[4.9, 2.45, -2.1], [4.9, 2.45, 2.1], [2.0, 2.45, 2.1], [2.0, 2.45, -2.1]], depth: 0.5 },
      ],
      lines: [
        line("feed-l", "#e8d3a3", [[2.6, 2.6, -4.8], [3.4, 2.7, -5.75], [4.6, 2.62, -5.75]], 1.2),
        line("feed-r", "#e8d3a3", [[2.6, 2.6, 4.8], [3.4, 2.7, 5.75], [4.6, 2.62, 5.75]], 1.2),
        line("xfeed", "#e8d3a3", [[2.6, 2.4, -4.8], [3.1, 2.3, 0], [2.6, 2.4, 4.8]], 0, { dashed: true, radius: 0.03 }),
        line("apu-feed", "#e8d3a3", [[2.6, 2.4, -1.5], [-4, 2.6, -0.6], [-12, 4.1, -0.4], [-17.4, 4.9, 0]], 1.0, { radius: 0.03 }),
      ],
      nodes: [
        node("ctr", "CENTRE TANK", [3.4, 2.45, 0], C.fuel, "CENTRE WING BOX"),
        node("il", "INNER TANK", [2.0, 2.95, -6.5], C.fuel),
        node("ol", "OUTER TANK", [-1.1, 3.55, -13.2], C.fuel),
        node("feed", "ENGINE FEED", [4.6, 2.62, -5.75], "#e8d3a3"),
        node("xf", "CROSSFEED", [2.85, 2.33, 2.4], "#e8d3a3"),
        node("apu", "APU FEED", [-17.4, 4.9, 0], "#e8d3a3"),
      ],
    },
  },
  {
    id: "flightControls",
    name: "FLIGHT CONTROLS",
    available: true,
    components: ["ailerons", "elevators", "rudder", "spoilers", "flaps", "slats"],
    description:
      "Fly-by-wire: sidestick and pedal inputs go to flight control computers, which command hydraulic actuators on each surface.",
  },
  {
    id: "propulsion",
    name: "PROPULSION",
    available: true,
    components: ["leftEngine", "rightEngine"],
    description:
      "Two CFM56-5B turbofans under full-authority digital engine control (FADEC). Besides thrust, each engine supplies bleed air, electrical power and hydraulic pressure.",
    facts: [
      "Bleed air from the compressor feeds the air conditioning packs in the belly fairing, cabin pressurisation and wing anti-ice.",
      "Open an engine and choose EXPLODE VIEW or AIRFLOW to see inside.",
    ],
    schematic: {
      cameraPreset: "SYSTEMS_XRAY",
      note: NOTE,
      legend: [{ color: C.bleed, label: "BLEED AIR" }],
      lines: [
        line("bleed-l", C.bleed, [[3.0, 1.8, -5.75], [3.4, 2.6, -5.0], [2.0, 2.4, -2.2], [0.5, 2.0, -0.8]], 2.2),
        line("bleed-r", C.bleed, [[3.0, 1.8, 5.75], [3.4, 2.6, 5.0], [2.0, 2.4, 2.2], [0.5, 2.0, 0.8]], 2.2),
        line("ai-l", C.bleed, [[3.4, 2.8, -6.5], [1.2, 3.25, -10], [-0.6, 3.6, -14.5]], 1.8, { radius: 0.03 }),
        line("ai-r", C.bleed, [[3.4, 2.8, 6.5], [1.2, 3.25, 10], [-0.6, 3.6, 14.5]], 1.8, { radius: 0.03 }),
      ],
      nodes: [
        node("packs", "AIR CONDITIONING PACKS", [0.5, 2.0, 0], C.bleed, "BELLY FAIRING"),
        node("ai", "WING ANTI-ICE", [-0.6, 3.6, -14.5], C.bleed, "OUTBOARD SLATS"),
      ],
    },
  },
  {
    id: "landingGear",
    name: "LANDING GEAR",
    available: true,
    components: ["landingGear"],
    description:
      "Hydraulically operated tricycle gear. The main gears retract inboard into the fuselage belly; the nose gear retracts forward.",
    facts: [
      "Normal extension and retraction use the green hydraulic system. If that fails, the gear can be extended by gravity (free fall).",
      "Maintenance crews test the system with a gear swing: the aircraft is raised on jacks and the gear is cycled.",
    ],
    actions: [{ key: "gearSwing", labelOff: "GEAR SWING TEST", labelOn: "LOWER GEAR · REMOVE JACKS", cameraPreset: "GEAR_SWING" }],
  },
];
