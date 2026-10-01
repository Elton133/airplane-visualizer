import { A320 } from "./a320/definition";
import { C17 } from "./c17/definition";
import type { AircraftDefinition } from "./types";

/** The HANGAR collection. Add a definition here to add an aircraft. */
export const AIRCRAFT: Record<string, AircraftDefinition> = {
  [A320.id]: A320,
  [C17.id]: C17,
};

export const AIRCRAFT_LIST: AircraftDefinition[] = Object.values(AIRCRAFT);

export const DEFAULT_AIRCRAFT = A320.id;

/** Announced, not yet in the collection. No data is shown until verified. */
export const UPCOMING = [{ designation: "B738 / 003", name: "Boeing 737-800" }];

export function getAircraft(id: string): AircraftDefinition {
  const a = AIRCRAFT[id];
  if (!a) throw new Error(`Unknown aircraft: ${id}`);
  return a;
}
