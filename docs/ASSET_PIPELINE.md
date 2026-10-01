# Asset pipeline: replacing the procedural A320 with a production GLB

The scene never references geometry directly. It reads node names through `src/aircraft/a320/definition.ts`. A GLB that follows these conventions drops in by changing one line:

```ts
model: { kind: "gltf", url: "/models/a320.glb" },
```

## 1. Source

Use one specific A320-200 / CFM56-5B / sharklet model with a licence that allows web distribution. Don't mix variants: dimensions, engine nacelle and wingtip must all match the same aircraft.

## 2. Blender preparation

- **Scale and axes:** metres, 1:1. Export with glTF +Y up. In three.js space the nose points to +X, starboard to +Z, and the ground is Y = 0 with tyres touching it (allow a small deflection, about 1–2 cm).
- **Separate meshes** for every interactive part, named so the component registry globs match:

| Component | Node names |
|---|---|
| Fuselage | `A320_Fuselage`, `A320_Windshield_*`, `A320_Cockpit*`, `A320_Pitot_*`, `A320_Antenna_*`, `A320_Beacon_*`, `A320_APU_*` |
| Wings | `A320_Wing_L/R`, `A320_Sharklet_L/R`, `A320_NavLight_L/R` |
| Engines | everything under `A320_Engine_L_*` / `A320_Engine_R_*` |
| Fan rotor | `A320_Engine_L_Fan` / `A320_Engine_R_Fan` (spins about local +X) |
| Ailerons | `A320_Aileron_L/R` under `A320_Aileron_L/R_Hinge` |
| Elevators | `A320_Elevator_L/R` under `A320_Elevator_L/R_Hinge` |
| Rudder | `A320_Rudder` under `A320_Rudder_Hinge` |
| Flaps | `A320_Flap_{L,R}_{Inner,Outer}` under `…_Hinge` |
| Slats | `A320_Slat_{L,R}_{1..5}` under `…_Hinge` |
| Spoilers | `A320_Spoiler_{L,R}_{1..5}` under `…_Hinge` |
| Landing gear | `A320_Gear_*` |

- **Hinge nodes:** an empty whose origin sits on the hinge line, with its local **+X axis along the hinge**. A positive rotation about +X must move the trailing edge **down**. For the rudder, it must move the trailing edge to **starboard**. Put the surface mesh under it with an identity transform. Never pivot a surface about its centre.
- **Fowler flaps:** the rig adds aft travel along the hinge node's local +Z and downward travel along its local −Y, then rotation. Tune `fowler.aft`, `fowler.down` and `fowler.angle` in the definition to the model's track geometry.
- Clean geometry: apply transforms, recalculate normals, remove interior faces, and keep the intake duct and fan as real geometry.
- **Materials:** separate PBR materials per surface type: glossy paint with clearcoat, bare metal, rubber, glass, emissive light lenses. Use 4K texture sets for exterior hero surfaces, and 8K only where it is visibly worth the memory.

## 3. Optimise

```bash
npm i -g @gltf-transform/cli
npm run optimize:model   # → public/models/a320.glb (meshopt + KTX2)
```

The KTX2 transcoder is served from `public/basis/` and the Draco decoder from `public/draco/`. Generate LODs for the exterior. Lazy-load engine internals and cockpit detail (V2) as separate files.

## 4. Verify

- Every `surfaces[].node` in the definition exists. The console warns `[HANGAR] rig node not found` otherwise.
- Hover each component and confirm the highlight covers exactly that part.
- Drive the Flight Control Lab and check the directions:
  - roll right → right aileron up, left aileron down
  - pitch up → elevator trailing edges up
  - yaw right → rudder trailing edge right
- Re-check the hotspot `anchors` and camera presets against the new geometry.

## 5. Skinned / game-converted assets (the C-17 case)

Some assets arrive as skinned meshes driven by bones, often with game-engine names such as `chassis`, `boot` or `gear_door_*`.

**Binding parts to components.** List bone names (globs work) in a component's `meshNames`. A skinned mesh is assigned to the component of its heaviest-weighted bone.

**Picking and occlusion.** At load, each skinned mesh gets a static, BVH-accelerated proxy for picking, hotspot occlusion and camera collision. CPU-skinned raycasts would be far too slow.

**Rigs.** Rigs can target bones directly.

- If a bone's local frame isn't aligned with its hinge, give the rig a `worldAxis` in aircraft space. It is converted into the bone's frame at load.
- For a mirrored axis on the other wing, also mirror the angle signs. Rotations are axial vectors.

**Missing parts.** Add them with an `augment`. `c17Gear` builds the gear at the asset's wheel bones. Then `transform.ground: "auto"` puts the tyres on the floor.

**Verify directions numerically** before trusting the visuals: roll right gives port aileron down and starboard up; pitch up raises the elevator trailing edges; yaw right moves the rudder trailing edge to starboard.
