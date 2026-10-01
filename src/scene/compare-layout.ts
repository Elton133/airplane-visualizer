import type { AircraftDefinition, CameraPreset, Vec3 } from "@/aircraft/types";
import { getRegistry } from "./scene-refs";

/**
 * COMPARE places both aircraft on the same floor at true 1:1 scale, wingtip
 * to wingtip with a fixed gap, noses on a common datum line. Nothing is
 * resized to fit.
 */
const WINGTIP_GAP = 6;
const NOSE_DATUM = 20;

export function compareLayout(a: AircraftDefinition, b: AircraftDefinition): Record<string, Vec3> {
  const halfA = a.dimensions.wingspan / 2;
  const halfB = b.dimensions.wingspan / 2;
  // A on +Z (screen left when viewed from ahead), B on −Z; centre the pair on z = 0.
  const zA = halfA + WINGTIP_GAP / 2;
  const zB = -(halfB + WINGTIP_GAP / 2);
  const shift = -((zA + halfA + (zB - halfB)) / 2);
  const nose = (d: AircraftDefinition) => getRegistry(d.id)?.bounds.max.x ?? d.dimensions.length / 2;
  return {
    [a.id]: [NOSE_DATUM - nose(a), 0, zA + shift],
    [b.id]: [NOSE_DATUM - nose(b), 0, zB + shift],
  };
}

/**
 * Head-on, slightly elevated and on the centreline between the pair, so both
 * aircraft are the same distance from the lens — perspective must not make
 * the nearer one look bigger.
 */
export function compareCamera(a: AircraftDefinition, b: AircraftDefinition): CameraPreset {
  const len = Math.max(a.dimensions.length, b.dimensions.length);
  return {
    position: [NOSE_DATUM + 56, 15, 0.01],
    target: [NOSE_DATUM - len * 0.35, 4.2, 0],
    fov: 44,
  };
}

export const COMPARE_ORBIT = {
  minDistance: 10,
  maxDistance: 110,
  targetBounds: { min: [-40, 0.6, -52] as Vec3, max: [30, 14, 52] as Vec3 },
};
