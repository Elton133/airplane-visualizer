import { useHangar } from "@/state/store";
import type { ComponentRegistry } from "./component-registry";

/**
 * Component registries of the loaded aircraft, by aircraft id. In-canvas
 * systems (labels, camera colliders) act on the active aircraft's registry.
 */
const registries = new Map<string, ComponentRegistry>();
const listeners = new Set<(r: ComponentRegistry) => void>();

export function setAircraftRegistry(r: ComponentRegistry) {
  registries.set(r.aircraftId, r);
  listeners.forEach((l) => l(r));
}

export function getRegistry(id: string) {
  return registries.get(id) ?? null;
}

/** Registry of the aircraft currently being explored. */
export function getAircraftRegistry() {
  return registries.get(useHangar.getState().aircraftId) ?? null;
}

/** Called for every registry that is (or becomes) available. */
export function onAircraftRegistry(l: (r: ComponentRegistry) => void) {
  registries.forEach((r) => l(r));
  listeners.add(l);
  return () => void listeners.delete(l);
}
