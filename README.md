# HANGAR

An interactive Airbus A320 you learn from by touching it. One fixed viewport (100vw × 100dvh, no page scroll), one aircraft, everything explorable.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Collection

| | Aircraft | Model | Reference data |
|---|---|---|---|
| A320 / 001 | Airbus A320-200 (A320ceo), CFM56-5B, sharklets | Procedural, built in code | Airbus ACAP |
| C17A / 002 | Boeing C-17A Globemaster III, 4 × F117-PW-100 | GLB by VTX, CC BY-NC-SA 4.0 (see `public/models/c17.LICENSE.txt`) | USAF fact sheet |

Switch aircraft with the designation menu (top right). **HANGAR is a non-commercial project.** The C-17 model's licence forbids commercial use.

## V2 features

| | |
|---|---|
| Compare | Both aircraft on one floor at 1:1 scale, noses on a common datum, symmetric head-on camera so neither aircraft is favoured by perspective. Verified figures side by side. |
| Engine study (A320) | EXPLODE VIEW separates the CFM56-5B into fan, 4-stage booster, 9-stage HPC, annular combustor, 1-stage HPT, 4-stage LPT and exhaust. AIRFLOW slices the near half of the nacelle away, and particles show bypass and core flow, coloured by relative temperature. The internals are lazy-loaded. |
| Systems (A320) | X-ray schematics for hydraulic (green/blue/yellow, PTU, RAT), electrical (IDGs, APU generator, avionics bay, emergency generator), fuel (inner, outer and centre tanks, feed, crossfeed, APU feed) and propulsion (bleed air). Routing is labelled as conceptual. |
| Landing gear system (A320) | Gear swing test: the aircraft is jacked up and the gear retracts (mains inboard, nose forward). |
| Cargo ramp (C-17) | The ramp and aft door open from the component panel. |
| Measure / human scale | Dimension lines drawn from the model's real extents and labelled with verified values, plus a 1.75 m figure. Both also work in COMPARE. |
| Dark hangar | House lights down. Nav, beacon and strobe lights sit at the modelled light units, plus the A320's taxi light. Flash timing is representative. |
| Sound | Off by default. Synthesized fan and actuator sound, started only by an explicit click. |

Extra keys: `M` measure · `H` human scale · `N` dark hangar.

## V1 scope

| | |
|---|---|
| Aircraft | A320-200 (A320ceo), CFM56-5B, sharklets — one variant used consistently |
| Explore | Orbit / zoom / pan with damping and limits, mesh-level hover + selection, cinematic focus, inspection panel with progressive disclosure, isolation |
| Components | Fuselage, left/right wing, left/right engine, ailerons, flaps, elevators, rudder, landing gear, plus slats and spoilers |
| Systems | Flight controls (others listed, marked V2) |
| Flight Control Lab | Roll (ailerons + roll spoilers 2–5), pitch (elevators), yaw (rudder), flaps (real 0/1/2/3/FULL lever detents driving Fowler flaps and slats) |
| Compare | See V2 |
| Quality | AUTO / HIGH / BALANCED / PERFORMANCE (pixel ratio, shadow map, PCSS, AO, floor reflections) with automatic step-down |

Keyboard: `R` reset · `F` focus · `I` isolate · `L` labels · `1/2/3` modes · `Esc` back · `?` help.

## The asset

V1 ships a **procedural model**, not a purchased or scanned asset. `src/three/a320/` builds the A320 in code at the published overall dimensions (Airbus ACAP: 37.57 m length, 35.80 m span, 11.76 m height, 3.95 m fuselage width, 12.64 m wheelbase, 7.59 m track). It has:

- separate, named meshes for every interactive part
- control surfaces parented to hinge nodes, with real hinge-line pivots (local +X = hinge line)
- Fowler flap motion: aft travel plus rotation on the flap's own frame
- slats that translate forward and droop
- a 36-blade fan on its own rotor node, an intake with depth, and the spinner
- procedural PBR textures: livery, panel lines, rivet rows, doors, windows, and normal and roughness maps

Detailed shaping (nose curvature, airfoils, surface chords) is an engineering approximation. That is stated in the app's info panel.

**For photoreal fidelity, swap in a production GLB.** The app does not need changes for this; see [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md).

## Architecture

```
src/aircraft/            data — the only place aircraft knowledge lives
  types.ts               AircraftDefinition, components, rigs, presets, demos
  a320/definition.ts     A320 registry: mesh mapping, camera presets, rigging, content, sources
  registry.ts            the collection (add an aircraft here)
src/three/               model + material authoring (procedural builder, textures, fx shader)
src/scene/               R3F scene
  Experience.tsx         canvas, quality tiers
  Aircraft.tsx           load → component registry → picking, highlight, surface actuation
  component-registry.ts  semantic component ↔ mesh mapping, per-component materials, BVH
  camera-director.ts     the single owner of authored camera motion (GSAP)
  CameraRig.tsx          CameraControls limits, target bounds, collider, ceiling, panel-aware framing
  HotspotTracker.tsx     anchor projection + BVH occlusion + overlap culling → DOM labels
  Hangar.tsx             environment lighting, floor, structure
  Reveal.tsx             light-up sequence gated on real readiness (build + shader compile)
src/state/               zustand store + controller (every user intent goes through it)
src/ui/                  overlay UI (motion, Hugeicons)
```

**Adding an aircraft** means a new `AircraftDefinition`, a GLB (or builder), and verified data. The C-17 was added this way:

- `model.transform` reorients and rescales the asset.
- `augment` adds the gear the asset lacked.
- Component `meshNames` match the asset's bone names, so skinned meshes bind to the bones that drive them.
- Rigs drive those bones. `worldAxis` handles bones whose frames aren't hinge-aligned.

Nothing in the scene or UI is aircraft-specific.

## Accuracy

The app only shows values verified for this variant. Unverified values are omitted. Control-surface angles in the lab are representative, and the UI says so. The parked aircraft never pretends to fly: the lab shows attitude response as a reference axis. The livery is a fictional HANGAR research scheme, with no Airbus branding.
