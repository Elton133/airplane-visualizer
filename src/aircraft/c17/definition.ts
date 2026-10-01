import type { AircraftDefinition, AircraftComponent } from "../types";
import { C17_SYSTEMS } from "./systems";

/**
 * Boeing C-17A Globemaster III.
 *
 * Reference values: U.S. Air Force C-17 Globemaster III fact sheet.
 * Asset: "C-17A Globemaster III" by VTX (Sketchfab), CC BY-NC-SA 4.0 —
 * rescaled to the published length, reoriented, textures re-encoded and
 * procedural landing gear added (the source carries gear bones but no gear).
 * Bone names below are the asset's own; components bind to them.
 */

const flightControl = (c: Omit<AircraftComponent, "category">): AircraftComponent => ({ ...c, category: "FLIGHT CONTROL" });

export const C17: AircraftDefinition = {
  id: "c17",
  designation: "C17A / 002",
  code: "C-17A",
  displayName: "Boeing C-17A Globemaster III",
  manufacturer: "Boeing",
  family: "C-17",
  variant: "C-17A",
  engine: "F117-PW-100",
  model: {
    kind: "gltf",
    url: "/models/c17.glb",
    bytes: 8458980,
    transform: { rotation: [0, -90, 0], scale: 2.097, ground: "auto" },
    augment: ["c17Gear"],
  },
  dimensions: { length: 53.04, wingspan: 51.75, height: 16.79 },
  reference: [
    { label: "LENGTH", value: "53.04 m" },
    { label: "WINGSPAN", value: "51.75 m" },
    { label: "HEIGHT", value: "16.79 m" },
    { label: "ENGINES", value: "4 × F117-PW-100" },
    { label: "THRUST (EACH)", value: "40,440 lbf" },
    { label: "MAX TAKEOFF WEIGHT", value: "265,352 kg" },
    { label: "CARGO HOLD (L × W × H)", value: "26.82 × 5.49 × 3.76 m" },
    { label: "CREW", value: "3 (2 pilots, loadmaster)" },
  ],
  compare: {
    length: "53.04 m",
    wingspan: "51.75 m",
    height: "16.79 m",
    engines: "4 × F117-PW-100",
    role: "Strategic / tactical airlifter",
  },
  sources: [
    "U.S. Air Force — C-17 Globemaster III fact sheet",
    "Pratt & Whitney — F117 engine product card",
    "Forecast International — C-17 Globemaster III report",
    "Goodyear Aviation — tyre application charts (2022)",
  ],
  credits: [
    {
      title: "C-17A Globemaster III",
      author: "VTX",
      license: "CC BY-NC-SA 4.0",
      url: "https://sketchfab.com/3d-models/c-17a-globemaster-iii-472c12abe72f435a95f9b54f4c469e29",
      note: "Modified for HANGAR: rescaled, reoriented, textures and geometry compressed, procedural landing gear added. The modified model is shared under the same licence.",
    },
  ],
  notes: [
    "Model proportions come from the source asset and may differ slightly from the published dimensions.",
    "Livery: U.S. Air Force markings as supplied with the source model.",
  ],

  cameraPresets: {
    REVEAL: { position: [34, 6.5, -12], target: [16, 5.5, 0], fov: 34 },
    HOME: { position: [52, 12, -56], target: [-4, 6, 0], fov: 34 },
    FUSELAGE: { position: [8, 7, -38], target: [0, 5, 0] },
    WINGS: { position: [20, 17.5, -42], target: [-1, 6, -12] },
    ENGINES: { position: [25, 5.2, -27], target: [5, 4.4, -10.5], minDistance: 5 },
    AILERON: { position: [-20, 13, -36], target: [-7, 5, -21] },
    FLAPS: { position: [-24, 7, -30], target: [-4.5, 4.8, -11] },
    SPOILERS: { position: [-14, 17, -26], target: [-3.5, 6.2, -11] },
    TAIL: { position: [-52, 17.5, -20], target: [-29, 13.5, -2] },
    RUDDER: { position: [-54, 16, 16], target: [-26, 11, 0] },
    RAMP: { position: [-52, 4.5, -10], target: [-16, 3, 0] },
    LANDING_GEAR: { position: [12, 1.5, -15], target: [3, 1.1, -2], minDistance: 4 },
    SYSTEMS: { position: [46, 17, -56], target: [-4, 6, 0] },
    SYSTEMS_XRAY: { position: [38, 17, -44], target: [-4, 5, 0] },
    SYSTEMS_TOP: { position: [16, 17.2, -30], target: [-3, 5, 0], fov: 44 },
    ROLL_DEMO: { position: [-66, 17, 0.01], target: [0, 7, 0] },
    PITCH_DEMO: { position: [-40, 10, -40], target: [-10, 8, 0] },
    YAW_DEMO: { position: [-50, 17.5, -14], target: [-6, 6, 0] },
    FLAPS_DEMO: { position: [-26, 7.5, -31], target: [-4.5, 4.6, -11] },
  },

  orbit: {
    minDistance: 6,
    maxDistance: 75,
    targetBounds: { min: [-30, 0.6, -28], max: [24, 14, 28] },
    attitudePivot: [-2, 6, 0],
  },

  components: [
    {
      id: "fuselage",
      name: "FUSELAGE",
      title: "FUSELAGE &\nCARGO HOLD",
      category: "STRUCTURE",
      meshNames: [
        "bodyshell_*",
        "chassis_*",
        "cockpit_*",
        "crane_*",
        "dials_*",
        "window_*",
        "windscreen_*",
        "steeringwheel_*",
        "seat_*",
        "dashglow_*",
        "lights_*",
        "emissives_*",
        "interiorlight_*",
        "door_dside_f_*",
        "handle_*",
      ],
      anchors: [[4, 4.6, 0]],
      labelDistance: 44,
      cameraPreset: "FUSELAGE",
      content: {
        what: "A wide, high-wing fuselage built around one large, unobstructed cargo hold.",
        does: "Carries outsize cargo, vehicles and troops, loaded straight in over the rear ramp.",
        how: [
          "Mounting the wing on top of the fuselage keeps the wing box out of the hold and lets the cargo floor sit low, close to the ground.",
          "The main landing gear sits in fairings outside the hold, so the full width of the floor stays usable.",
        ],
        connections: ["Wing (high-mounted)", "Rear cargo ramp", "T-tail", "Landing gear fairings"],
        specs: [
          { label: "LENGTH", value: "53.04 m" },
          { label: "CARGO HOLD (L × W × H)", value: "26.82 × 5.49 × 3.76 m" },
          { label: "CREW", value: "3 (2 pilots, loadmaster)" },
        ],
      },
    },
    {
      id: "wings",
      name: "WINGS",
      title: "WINGS",
      category: "STRUCTURE",
      meshNames: ["wing_*", "wingtip_*", "extralight_*"],
      anchors: [
        [-1.5, 6.4, -15],
        [-1.5, 6.4, 15],
      ],
      labelDistance: 44,
      cameraPreset: "WINGS",
      content: {
        what: "A high-mounted, swept wing with winglets at the tips.",
        does: "Produces lift and carries the four engines, the flaps, spoilers and ailerons.",
        how: [
          "The winglets reduce the drag produced by the wingtip vortex.",
          "The engines sit ahead of and below the wing so that, with the flaps lowered, their exhaust can be directed onto the flaps (externally blown flaps).",
        ],
        connections: ["Engine pylons", "Flaps", "Spoilers", "Ailerons"],
        specs: [{ label: "WINGSPAN", value: "51.75 m" }],
      },
    },
    {
      id: "engines",
      name: "ENGINES",
      title: "F117-PW-100\nTURBOFANS",
      category: "PROPULSION",
      meshNames: ["Object_184", "Object_202", "Object_154", "engine_*", "misc_*", "exhaust*", "overheat*"],
      anchors: [
        [5, 4.3, -7.3],
        [5, 4.3, -13.8],
        [5, 4.3, 7.3],
        [5, 4.3, 13.8],
      ],
      labelDistance: 36,
      cameraPreset: "ENGINES",
      content: {
        what: "Four Pratt & Whitney F117-PW-100 high-bypass turbofans, slung under the wing.",
        does: "Produce thrust. Their thrust reversers can also slow the aircraft, and back it up on the ground.",
        how: [
          "Like any turbofan, a large front fan moves most of the air around the engine core, and that bypass air produces most of the thrust.",
          "With the flaps down, the exhaust of the engines is directed onto the flaps, adding lift for steep, slow approaches to short runways.",
        ],
        connections: ["Pylons → wing", "Fuel system", "Flaps (externally blown)", "Thrust reversers"],
        specs: [
          { label: "ENGINES", value: "4 × F117-PW-100" },
          { label: "THRUST (EACH)", value: "40,440 lbf" },
          { label: "BYPASS RATIO", value: "5.9 : 1" },
          { label: "FAN INLET DIAMETER", value: "1.99 m" },
          { label: "MANUFACTURER", value: "Pratt & Whitney" },
        ],
      },
    },
    flightControl({
      id: "ailerons",
      name: "AILERONS",
      title: "AILERONS",
      meshNames: ["aileron_*"],
      anchors: [
        [-7.1, 4.9, -22],
        [-7.1, 4.9, 22],
      ],
      labelDistance: 34,
      cameraPreset: "AILERON",
      demo: "roll",
      content: {
        what: "Hinged surfaces on the outer trailing edge of each wing.",
        does: "Control roll. The left and right ailerons move in opposite directions.",
        how: [
          "Lowering an aileron increases the camber, and so the lift, of that part of the wing; the opposite aileron rises and reduces lift. The lift difference rolls the aircraft.",
        ],
        connections: ["Control stick", "Fly-by-wire flight control computers", "Hydraulic actuators"],
      },
    }),
    flightControl({
      id: "spoilers",
      name: "SPOILERS",
      title: "SPOILERS",
      meshNames: ["airbrake_*"],
      anchors: [
        [-3.5, 6.3, -12],
        [-3.5, 6.3, 12],
      ],
      labelDistance: 30,
      cameraPreset: "SPOILERS",
      demo: "roll",
      content: {
        what: "Panels on the upper surface of each wing, ahead of the flaps.",
        does: "Spoil lift and add drag — for descent, for roll assistance, and on the ground after touchdown.",
        how: ["A raised spoiler disturbs the airflow over the wing and reduces lift on that part of the wing."],
      },
    }),
    {
      id: "flaps",
      name: "FLAPS",
      title: "EXTERNALLY\nBLOWN FLAPS",
      category: "HIGH LIFT",
      meshNames: ["gear_door_rl1_*", "gear_door_rr1_*"],
      anchors: [
        [-4.5, 5.1, -12],
        [-4.5, 5.1, 12],
      ],
      labelDistance: 32,
      cameraPreset: "FLAPS",
      demo: "flaps",
      content: {
        what: "Large trailing-edge flaps across most of each wing.",
        does: "Increase lift at low speed. On the C-17, engine exhaust is directed onto them.",
        how: [
          "Lowered flaps increase the wing's camber. Because the engines blow their exhaust onto the extended flaps, the flaps turn part of the engine thrust into extra lift.",
          "This is what lets a large transport fly steep, slow approaches into short, austere runways.",
        ],
        connections: ["Engines (exhaust)", "Flap actuators"],
      },
    },
    flightControl({
      id: "elevators",
      name: "ELEVATORS",
      title: "ELEVATORS",
      meshNames: ["elevator_*"],
      anchors: [
        [-30.2, 15.4, -6],
        [-30.2, 15.4, 6],
      ],
      labelDistance: 34,
      cameraPreset: "TAIL",
      demo: "pitch",
      content: {
        what: "Hinged surfaces on the trailing edge of the horizontal stabiliser, at the top of the T-tail.",
        does: "Control pitch by changing the aerodynamic force on the tail.",
        how: [
          "Raising the elevators produces a downward force increment at the tail, far behind the centre of gravity, which pitches the nose up.",
          "Mounting the stabiliser on top of the fin keeps it clear of the fuselage wake and of the rear cargo opening.",
        ],
        connections: ["Control stick", "Fly-by-wire flight control computers", "Hydraulic actuators"],
      },
    }),
    flightControl({
      id: "rudder",
      name: "RUDDER",
      title: "RUDDER",
      meshNames: ["rudder_6*"],
      anchors: [[-26.5, 11.3, 0]],
      labelDistance: 34,
      cameraPreset: "RUDDER",
      demo: "yaw",
      content: {
        what: "The hinged trailing edge of the vertical fin.",
        does: "Controls yaw — the nose moving left or right.",
        how: [
          "Deflecting the rudder changes the side force on the fin, far aft of the centre of gravity, producing a yawing moment.",
          "On a four-engine aircraft it is essential for countering the asymmetric thrust of an engine failure.",
        ],
        connections: ["Rudder pedals", "Fly-by-wire flight control computers", "Hydraulic actuators"],
      },
    }),
    {
      id: "empennage",
      name: "T-TAIL",
      title: "T-TAIL",
      category: "STRUCTURE",
      meshNames: ["tail_*"],
      anchors: [[-28.5, 16.6, 0]],
      labelDistance: 34,
      cameraPreset: "TAIL",
      content: {
        what: "A tall vertical fin with the horizontal stabiliser mounted on top.",
        does: "Provides stability in pitch and yaw, and carries the elevators and rudder.",
        how: [
          "Placing the horizontal tail on top of the fin keeps it out of the wing and fuselage wake and clear of the large rear cargo opening.",
        ],
      },
    },
    {
      id: "cargoRamp",
      name: "CARGO RAMP",
      title: "CARGO RAMP\n& AFT DOOR",
      category: "STRUCTURE",
      meshNames: ["boot_*", "door_dside_r_*"],
      anchors: [[-15, 2.6, 0]],
      labelDistance: 34,
      cameraPreset: "RAMP",
      toggle: { key: "ramp", labelOn: "CLOSE RAMP", labelOff: "OPEN RAMP", cameraPreset: "RAMP" },
      content: {
        what: "A hinged ramp under the upswept rear fuselage, with a door above it.",
        does: "Opens the full width of the hold for drive-on loading and airdrop.",
        how: [
          "The ramp lowers to form a slope from the cargo floor to the ground, so vehicles can drive straight into the hold. The door above swings up into the tail to clear tall loads.",
        ],
        connections: ["Cargo hold floor", "Ramp actuators"],
      },
    },
    {
      id: "landingGear",
      name: "LANDING GEAR",
      title: "LANDING GEAR",
      category: "LANDING GEAR",
      meshNames: [
        "C17_Gear*",
        "gear_door_fl_*",
        "gear_door_fr_*",
        "gear_door_rml_*",
        "gear_door_rl2_*",
        "gear_door_rmr_*",
        "gear_door_rr2_*",
        "gear_f_*",
        "gear_lm*",
        "gear_rm*",
        "gear_rl_*",
        "gear_rr_*",
        "Object_303",
      ],
      anchors: [
        [-1.45, 1.0, -4.3],
        [-1.45, 1.0, 4.3],
        [17.4, 0.9, 0],
      ],
      labelDistance: 30,
      cameraPreset: "LANDING_GEAR",
      content: {
        what: "A steerable twin-wheel nose gear and two main gears, each with forward and aft three-wheel struts.",
        does: "Spreads the aircraft's weight over many tyres, so it can operate from semi-prepared runways.",
        how: [
          "The main gear retracts into fairings on the sides of the fuselage rather than into the wing or hold, keeping the cargo floor clear and low.",
        ],
        connections: ["Gear fairings", "Brakes", "Nosewheel steering"],
        specs: [{ label: "WHEELS", value: "14 (2 nose, 12 main)" }],
      },
    },
  ],

  surfaces: [
    { id: "aileronL", node: "aileron_l_32", driver: { axis: "roll", up: 22, down: 22, sign: 1 } },
    { id: "aileronR", node: "aileron_r_47", driver: { axis: "roll", up: 22, down: 22, sign: -1 } },
    { id: "elevatorL", node: "elevator_l_63", driver: { axis: "pitch", up: 25, down: 15 } },
    { id: "elevatorR", node: "elevator_r_64", driver: { axis: "pitch", up: 25, down: 15 } },
    { id: "rudder", node: "rudder_61", axis: "y", driver: { axis: "yaw", max: 25 } },
    { id: "spoilerL", node: "airbrake_l_33", driver: { axis: "rollSpoiler", max: 30, side: "left" } },
    { id: "spoilerR", node: "airbrake_r_48", driver: { axis: "rollSpoiler", max: 30, side: "right" } },
    // The asset's flap bones are not aligned with the hinge: rotate about the
    // trailing-edge span line instead. The source pose has ~16° of flap down.
    {
      id: "flapL",
      node: "gear_door_rl1_42",
      worldAxis: [-0.367, 0, -0.93],
      driver: { axis: "flaps", key: "flap" },
      hingedFlap: { rest: 16, angle: -45 },
    },
    {
      // Mirrored axis ⇒ mirrored angle signs (rotations are axial vectors).
      id: "flapR",
      node: "gear_door_rr1_49",
      worldAxis: [-0.367, 0, 0.93],
      driver: { axis: "flaps", key: "flap" },
      hingedFlap: { rest: -16, angle: 45 },
    },
    { id: "ramp", node: "boot_13", driver: { axis: "toggle", key: "ramp", angle: 14, duration: 4 } },
    { id: "aftDoor", node: "door_dside_r_14", driver: { axis: "toggle", key: "ramp", angle: 40, duration: 4 } },
  ],

  // Conceptual positions — the C-17's actual flap settings are not modelled.
  flapDetents: [
    { label: "UP", slat: 0, flap: 0 },
    { label: "PARTIAL", slat: 0, flap: 0.5 },
    { label: "FULL", slat: 0, flap: 1 },
  ],
  flapNote: "Conceptual positions, not the C-17's flap settings.",

  demos: {
    roll: {
      axis: "roll",
      title: "ROLL",
      summary: "Ailerons change lift distribution between the wings, producing a rolling moment.",
      chain: ["CONTROL INPUT", "AILERON RESPONSE", "ROLLING MOMENT"],
      body: [
        "Move the stick right: the right aileron rises, the left lowers, and the spoilers on the right wing extend.",
        "The left wing now produces more lift than the right, so the aircraft rolls right.",
        "The C-17 is flown with a centre stick through a fly-by-wire system; this lab shows the surface relationship only.",
      ],
      cameraPreset: "ROLL_DEMO",
      negativeLabel: "LEFT",
      positiveLabel: "RIGHT",
    },
    pitch: {
      axis: "pitch",
      title: "PITCH",
      summary: "Elevators on the T-tail change the tail force, producing a pitching moment.",
      chain: ["CONTROL INPUT", "ELEVATOR RESPONSE", "PITCHING MOMENT"],
      body: [
        "Pull back: the elevators rise and create a downward force increment at the tail, high on top of the fin.",
        "Acting far behind the centre of gravity, that force pitches the nose up and increases the wing's angle of attack.",
      ],
      cameraPreset: "PITCH_DEMO",
      negativeLabel: "NOSE DOWN",
      positiveLabel: "NOSE UP",
    },
    yaw: {
      axis: "yaw",
      title: "YAW",
      summary: "The rudder changes the side force on the fin, creating a yawing moment.",
      chain: ["PEDAL INPUT", "RUDDER RESPONSE", "YAWING MOMENT"],
      body: [
        "Right pedal: the rudder moves right, the side force pushes the tail left, and the nose yaws right.",
        "With four engines, the rudder must also be able to counter the yaw from an outboard engine failing.",
      ],
      cameraPreset: "YAW_DEMO",
      negativeLabel: "LEFT",
      positiveLabel: "RIGHT",
    },
    flaps: {
      axis: "flaps",
      title: "FLAPS",
      summary: "Lowered flaps add camber — and on the C-17, engine exhaust blown onto them adds lift.",
      chain: ["FLAP SELECTION", "FLAPS EXTEND", "↑ LIFT AT LOW SPEED  ↑ DRAG"],
      body: [
        "The C-17 uses externally blown flaps: with the flaps lowered, the exhaust from the under-wing engines is directed onto them.",
        "Part of the engine thrust is turned into lift, which supports steep, slow approaches onto short runways.",
      ],
      cameraPreset: "FLAPS_DEMO",
    },
  },

  systems: C17_SYSTEMS,

  // Placed at the asset's own wingtip and tail light bones. Timing representative.
  lights: [
    { id: "navL", kind: "nav", color: "#ff3b2f", node: "wingtip_1_38" },
    { id: "navR", kind: "nav", color: "#2fe07a", node: "wingtip_2_53" },
    { id: "strobeL", kind: "strobe", color: "#ffffff", node: "siren2_37" },
    { id: "strobeR", kind: "strobe", color: "#ffffff", node: "siren1_54" },
    { id: "beaconTop", kind: "beacon", color: "#ff2a1a", node: "siren3_62" },
  ],
  humanSpot: [19.5, 0, -3.6],

  quiz: [
    { id: "id-ramp", kicker: "IDENTIFY", prompt: "THE CARGO RAMP", answers: ["cargoRamp"], explain: "Under the upswept rear fuselage. It lowers to make a slope from the hold floor to the ground." },
    { id: "id-ttail", kicker: "IDENTIFY", prompt: "THE T-TAIL", answers: ["empennage", "elevators", "rudder"], explain: "The horizontal stabiliser sits on top of the fin, clear of the wake and the rear cargo opening." },
    { id: "id-rud", kicker: "IDENTIFY", prompt: "THE RUDDER", answers: ["rudder"], explain: "The trailing edge of the fin; it yaws the nose and counters asymmetric thrust after an engine failure." },
    { id: "id-elev", kicker: "IDENTIFY", prompt: "THE ELEVATORS", answers: ["elevators"], explain: "At the top of the T-tail. They change the tail force to pitch the aircraft." },
    { id: "id-ail", kicker: "IDENTIFY", prompt: "AN AILERON", answers: ["ailerons"], explain: "On the outer trailing edge of each wing; the pair moves in opposite directions to roll the aircraft." },
    { id: "id-gear", kicker: "IDENTIFY", prompt: "THE MAIN LANDING GEAR", answers: ["landingGear"], explain: "Housed in fairings on the fuselage sides, keeping the hold floor clear and low." },
    { id: "fn-ebf", kicker: "WHICH SURFACES DOES THE", prompt: "ENGINE EXHAUST BLOW ONTO?", answers: ["flaps"], explain: "The externally blown flaps: exhaust directed onto them turns part of the thrust into extra lift." },
    { id: "fn-drive", kicker: "WHICH PART LETS VEHICLES", prompt: "DRIVE INTO THE HOLD?", answers: ["cargoRamp"], explain: "The rear cargo ramp, with the aft door above it swinging up for tall loads." },
    { id: "fn-roll", kicker: "WHICH SURFACE CONTROLS", prompt: "ROLL?", answers: ["ailerons"], explain: "The ailerons, by creating a lift difference between the wings." },
    { id: "fn-yaw", kicker: "WHICH SURFACE CONTROLS", prompt: "YAW?", answers: ["rudder"], explain: "The rudder, by changing the side force on the fin." },
    { id: "fn-thrust", kicker: "WHAT PRODUCES", prompt: "THRUST?", answers: ["engines"], explain: "Four Pratt & Whitney F117-PW-100 turbofans under the wing." },
  ],

  colliderMeshes: ["bodyshell_*", "Object_26"],
  fanNodes: [],
};
