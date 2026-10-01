import type { AircraftSystem, SchematicLine, SchematicNode, Vec3 } from "../types";

/**
 * C-17A system schematics. Only facts with corroborating sources are used;
 * where sources disagree or are missing (hydraulic consumer mapping, generator
 * ratings, extended-range tank capacity) the detail is deliberately omitted.
 * Routing is conceptual and component locations approximate.
 */

const NOTE = "Schematic — conceptual routing; component locations approximate. Not a maintenance reference.";

const C = {
  hyd: "#7fb6d9",
  aux: "#9aa3ab",
  rat: "#d48a6a",
  ac: "#e09b55",
  dc: "#86a9cf",
  fuel: "#d7a14c",
  feed: "#e8d3a3",
};

const line = (id: string, color: string, points: Vec3[], flow = 1.6, extra: Partial<SchematicLine> = {}): SchematicLine => ({
  id,
  color,
  points,
  flow,
  ...extra,
});
const node = (id: string, label: string, at: Vec3, color: string, detail?: string): SchematicNode => ({ id, label, at, color, detail });
const m = (p: Vec3): Vec3 => [p[0], p[1], -p[2]];

// Engine pylon roots (aircraft space), from the model.
const ENG_IN: Vec3 = [5.5, 5.4, 7.3];
const ENG_OUT: Vec3 = [3.0, 5.0, 13.8];
const HUB: Vec3 = [0.5, 6.3, 0];
const POD_R_FWD: Vec3 = [2.4, 2.4, 4.4];
const POD_R_AFT: Vec3 = [-3.0, 1.9, 4.4];

const toHub = (p: Vec3, dz: number): Vec3[] => [
  p,
  [p[0] - 1.5, 6.6, p[2] * 0.85],
  [1.0, 6.7, Math.sign(p[2]) * 3 + dz],
  [HUB[0], HUB[1], dz],
];

export const C17_SYSTEMS: AircraftSystem[] = [
  {
    id: "hydraulic",
    name: "HYDRAULIC",
    available: true,
    components: [],
    description:
      "Four independent hydraulic systems at about 4,000 psi. Pumps on every engine pressurise them, and each system also has an AC electric auxiliary pump.",
    facts: [
      "Each primary flight control surface is powered by more than one system, so a single failure does not remove control.",
      "A ram air turbine housed in the right main gear pod keeps the flight controls powered after a major power failure.",
      "Which system powers each consumer is not shown: we could not verify it.",
    ],
    schematic: {
      cameraPreset: "SYSTEMS_XRAY",
      note: NOTE,
      legend: [
        { color: C.hyd, label: "ENGINE-DRIVEN PUMPS" },
        { color: C.aux, label: "AC ELECTRIC AUX PUMPS" },
        { color: C.rat, label: "RAM AIR TURBINE · EMERGENCY" },
      ],
      lines: [
        line("e1", C.hyd, toHub(m(ENG_OUT), -0.3)),
        line("e2", C.hyd, toHub(m(ENG_IN), -0.15)),
        line("e3", C.hyd, toHub(ENG_IN, 0.15)),
        line("e4", C.hyd, toHub(ENG_OUT, 0.3)),
        line("wing-l", C.hyd, [HUB, [-2.5, 6.4, -6], [-4.5, 6.0, -14], [-6.5, 5.4, -21.5]]),
        line("wing-r", C.hyd, [HUB, [-2.5, 6.4, 6], [-4.5, 6.0, 14], [-6.5, 5.4, 21.5]]),
        line("tail", C.hyd, [HUB, [-8, 7.2, 0], [-18, 8.6, 0], [-25, 11.5, 0], [-29.5, 15.2, 0]]),
        line("ramp", C.hyd, [HUB, [-6, 6.0, 0.4], [-12, 4.0, 0.4], [-15, 2.8, 0.4]], 1.2),
        line("aux", C.aux, [[2.5, 4.6, 0.6], [1.0, 5.6, 0.3], HUB], 0, { dashed: true, radius: 0.035 }),
        line("rat", C.rat, [POD_R_AFT, [-1.5, 3.6, 3.0], [0.5, 5.6, 0.8], HUB], 1.4),
      ],
      nodes: [
        node("edp", "ENGINE-DRIVEN PUMPS", ENG_IN, C.hyd, "EVERY ENGINE"),
        node("hub", "4 INDEPENDENT SYSTEMS", HUB, "#c9cbc8", "≈ 4,000 PSI"),
        node("aux", "AUX ELECTRIC PUMPS", [2.5, 4.6, 0.6], C.aux, "ONE PER SYSTEM"),
        node("rat", "RAM AIR TURBINE", POD_R_AFT, C.rat, "RIGHT GEAR POD"),
        node("wing", "WING FLIGHT CONTROLS", [-6.5, 5.4, -21.5], "#c9cbc8", "AILERONS · SPOILERS · FLAPS · SLATS"),
        node("tail", "TAIL FLIGHT CONTROLS", [-29.5, 15.2, 0], "#c9cbc8", "ELEVATORS · RUDDER · STABILISER"),
        node("ramp", "CARGO RAMP & DOORS", [-15, 2.8, 0.4], "#c9cbc8"),
      ],
    },
  },
  {
    id: "electrical",
    name: "ELECTRICAL",
    available: true,
    components: [],
    description:
      "Each of the four engines drives a generator, and the APU adds a fifth. The AC network runs at 115 V, 400 Hz; transformer-rectifiers supply 28 V DC, and batteries back up the DC side.",
    facts: ["The APU — a Honeywell GTCP331-250G — sits in the forward part of the right main gear pod, one reason the two pods differ in length."],
    schematic: {
      cameraPreset: "SYSTEMS_XRAY",
      note: NOTE,
      legend: [
        { color: C.ac, label: "AC GENERATION · 115 V 400 Hz" },
        { color: C.dc, label: "DC · 28 V" },
      ],
      lines: [
        line("g1", C.ac, [...toHub(m(ENG_OUT), -0.3), [6, 6.2, -0.3], [11, 5.4, -0.3]], 2.2),
        line("g2", C.ac, [...toHub(m(ENG_IN), -0.15), [6, 6.2, -0.15], [11, 5.4, -0.15]], 2.2),
        line("g3", C.ac, [...toHub(ENG_IN, 0.15), [6, 6.2, 0.15], [11, 5.4, 0.15]], 2.2),
        line("g4", C.ac, [...toHub(ENG_OUT, 0.3), [6, 6.2, 0.3], [11, 5.4, 0.3]], 2.2),
        line("apu", C.ac, [POD_R_FWD, [4.5, 3.6, 3.0], [9, 4.6, 0.6], [11, 5.4, 0.45]], 2.0),
        line("dc", C.dc, [[11, 5.4, 0], [13.5, 4.4, -0.6]], 0.8),
      ],
      nodes: [
        node("gen", "ENGINE GENERATORS (4)", ENG_IN, C.ac, "ONE PER ENGINE"),
        node("apu", "APU GENERATOR", POD_R_FWD, C.ac, "RIGHT GEAR POD · GTCP331-250G"),
        node("dist", "AC / DC DISTRIBUTION", [11, 5.4, 0], "#c9cbc8", "TR UNITS → 28 V DC"),
        node("bat", "BATTERIES", [13.5, 4.4, -0.6], C.dc),
      ],
    },
  },
  {
    id: "fuel",
    name: "FUEL",
    available: true,
    components: [],
    description:
      "Fuel is carried in the wing: four main tanks, plus an extended-range tank in the centre wing on later aircraft. Total capacity is 35,546 US gallons.",
    facts: [
      "The C-17 refuels in flight through a receptacle on top of the fuselage, behind the flight deck.",
      "Fuel is shown here as tank volumes; the capacity of each tank is not shown.",
    ],
    schematic: {
      cameraPreset: "SYSTEMS_TOP",
      note: NOTE,
      legend: [
        { color: C.fuel, label: "FUEL TANKS" },
        { color: C.feed, label: "ENGINE / APU FEED · REFUELLING" },
      ],
      zones: [
        ...([1, -1] as const).flatMap((s) => [
          {
            id: `in${s}`,
            label: "MAIN TANK",
            color: C.fuel,
            corners: [
              [4.0, 6.7, 4.9 * s],
              [0.3, 5.9, 13 * s],
              [-3.2, 5.9, 13 * s],
              [-0.9, 6.7, 4.9 * s],
            ] as [Vec3, Vec3, Vec3, Vec3],
            depth: 0.55,
          },
          {
            id: `out${s}`,
            label: "MAIN TANK",
            color: C.fuel,
            corners: [
              [0.3, 5.9, 13 * s],
              [-3.7, 5.05, 21 * s],
              [-5.9, 5.05, 21 * s],
              [-3.2, 5.9, 13 * s],
            ] as [Vec3, Vec3, Vec3, Vec3],
            depth: 0.38,
          },
        ]),
        {
          id: "er",
          label: "ER TANK",
          color: C.fuel,
          corners: [
            [4.2, 6.95, -4.6],
            [4.2, 6.95, 4.6],
            [-1.2, 6.95, 4.6],
            [-1.2, 6.95, -4.6],
          ],
          depth: 0.5,
        },
      ],
      lines: [
        line("f1", C.feed, [[0.6, 6.0, -9], [3.0, 5.6, -13.8], [5.0, 4.9, -13.8]], 1.2),
        line("f2", C.feed, [[1.5, 6.3, -6.5], [5.5, 5.6, -7.3], [7.5, 5.2, -7.3]], 1.2),
        line("f3", C.feed, [[1.5, 6.3, 6.5], [5.5, 5.6, 7.3], [7.5, 5.2, 7.3]], 1.2),
        line("f4", C.feed, [[0.6, 6.0, 9], [3.0, 5.6, 13.8], [5.0, 4.9, 13.8]], 1.2),
        line("apu", C.feed, [[1.5, 6.3, 4.5], [2.4, 4.4, 4.4], POD_R_FWD], 1.0, { radius: 0.03 }),
        line("air", C.feed, [[15.6, 7.15, 0], [10, 7.4, 0], [3.5, 7.0, 0]], 1.0, { radius: 0.035 }),
      ],
      nodes: [
        node("main", "MAIN TANKS (4)", [0.4, 6.3, -9], C.fuel, "TWO PER WING"),
        node("er", "EXTENDED-RANGE TANK", [1.5, 6.95, 0], C.fuel, "CENTRE WING · LATER AIRCRAFT"),
        node("rcpt", "AIR-REFUELLING RECEPTACLE", [15.6, 7.15, 0], C.feed, "BEHIND FLIGHT DECK"),
        node("feed", "ENGINE FEED", [7.5, 5.2, -7.3], C.feed),
        node("apu", "APU FEED", POD_R_FWD, C.feed, "RIGHT GEAR POD"),
      ],
    },
  },
  {
    id: "flightControls",
    name: "FLIGHT CONTROLS",
    available: true,
    components: ["ailerons", "elevators", "rudder", "spoilers", "flaps"],
    description:
      "Quadruplex digital fly-by-wire with a mechanical backup, flown with a centre stick rather than a yoke. Stick and pedal inputs go to the flight control computers, which command the surface actuators.",
    facts: ["Spoilers on each wing assist the ailerons in roll; flaps and slats provide high lift."],
  },
  {
    id: "propulsion",
    name: "PROPULSION",
    available: true,
    components: ["engines"],
    description:
      "Four Pratt & Whitney F117-PW-100 turbofans, the military member of the PW2000 family, each rated at 40,440 lbf and controlled by FADEC.",
    facts: [
      "Bypass ratio 5.9:1; fan inlet diameter 78.5 in (1.99 m).",
      "Directed-flow thrust reversers can be deployed in flight for steep tactical descents. On the ground they can back a fully loaded aircraft up a 2° slope.",
    ],
  },
  {
    id: "landingGear",
    name: "LANDING GEAR",
    available: true,
    components: ["landingGear"],
    description:
      "A twin-wheel nose gear and a 12-wheel main gear: two three-wheel struts on each side, retracting into pods on the sides of the fuselage.",
    facts: [
      "Tyres: main 50×21.0-20, nose 40×16.",
      "Keeping the gear outside the hold leaves the full width of the cargo floor clear.",
    ],
  },
];
