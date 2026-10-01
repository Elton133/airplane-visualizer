import * as THREE from "three";
import type { AircraftDefinition } from "@/aircraft/types";
import { setProgress, useHangar, type QualityLevel } from "@/state/store";
import { nextFrame } from "@/three/texture-kit";
import { matches } from "./component-registry";

type Builder = (textureRes: number, onProgress: Progress) => Promise<THREE.Group>;
type Progress = (key: "model" | "textures", value: number) => void;
type Augment = (root: THREE.Object3D) => Promise<void> | void;

/** Procedural builders, loaded on demand so their code stays out of the initial bundle. */
const BUILDERS: Record<string, Builder> = {
  a320: async (res, onProgress) => {
    const [{ createA320Materials }, { buildA320 }] = await Promise.all([
      import("@/three/a320/materials"),
      import("@/three/a320/build"),
    ]);
    onProgress("model", 0.1);
    const mats = await createA320Materials(res, (p) => onProgress("textures", p));
    await nextFrame();
    const root = buildA320(mats);
    onProgress("model", 0.8);
    return root;
  },
};

/** Procedural additions for parts an asset is missing. */
const AUGMENTS: Record<string, Augment> = {
  c17Gear: async (root) => {
    const { addC17Gear } = await import("@/three/c17/gear");
    addC17Gear(root);
  },
};

async function loadGltf(url: string, bytes: number | undefined, draco: boolean | undefined, onProgress: Progress) {
  const [{ GLTFLoader }, { MeshoptDecoder }, { KTX2Loader }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
    import("three/examples/jsm/loaders/KTX2Loader.js"),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ktx2 = new KTX2Loader().setTranscoderPath("/basis/");
  const gl = (globalThis as { __hangarRenderer?: THREE.WebGLRenderer }).__hangarRenderer;
  if (gl) ktx2.detectSupport(gl);
  loader.setKTX2Loader(ktx2);
  if (draco) {
    const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath("/draco/"));
  }
  const gltf = await loader.loadAsync(url, (e) => {
    const total = e.total || bytes;
    if (total) {
      const p = Math.min(1, e.loaded / total);
      onProgress("model", p * 0.7);
      onProgress("textures", p * 0.9);
    }
  });
  onProgress("textures", 1);
  return gltf.scene;
}

/**
 * Bring an asset into aircraft space (nose +X, starboard +Z, metres, floor
 * at Y = 0) using the definition's transform, then add any augmentations.
 */
async function prepareGltf(def: AircraftDefinition, scene: THREE.Group): Promise<THREE.Group> {
  if (def.model.kind !== "gltf") return scene;
  const t = def.model.transform ?? {};
  const root = new THREE.Group();
  root.name = def.id;
  const content = new THREE.Group();
  content.name = `${def.id}_content`;
  root.add(content);
  const r = t.rotation ?? [0, 0, 0];
  scene.rotation.set(THREE.MathUtils.degToRad(r[0]), THREE.MathUtils.degToRad(r[1]), THREE.MathUtils.degToRad(r[2]));
  scene.scale.setScalar(t.scale ?? 1);
  content.add(scene);

  const hide = def.model.hide ?? [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (hide.some((p) => matches(p, o.name))) o.visible = false;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      // Skinned meshes are posed by bones; keep them from being culled by
      // their rest-pose bounds.
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
    }
  });
  root.updateMatrixWorld(true);
  for (const a of def.model.augment ?? []) {
    const fn = AUGMENTS[a];
    if (!fn) console.warn(`[HANGAR] unknown augment ${a}`);
    else await fn(content);
  }
  root.updateMatrixWorld(true);
  if ((t.ground ?? "auto") === "auto") {
    const box = new THREE.Box3().setFromObject(content, true);
    content.position.y -= box.min.y;
  } else if (typeof t.ground === "number") {
    content.position.y += t.ground;
  }
  root.updateMatrixWorld(true);
  return root;
}

const cache = new Map<string, Promise<THREE.Group>>();

/**
 * Load (once) and cache an aircraft model. Progress is reported to the
 * global loader during the first reveal, and to the switcher afterwards.
 */
export function loadAircraftModel(def: AircraftDefinition, quality: QualityLevel): Promise<THREE.Group> {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const initial = useHangar.getState().phase === "loading";
  const onProgress: Progress = (key, value) => {
    if (initial) setProgress(key, value);
    else {
      const cur = useHangar.getState().aircraftLoading;
      if (cur?.id === def.id) useHangar.setState({ aircraftLoading: { id: def.id, progress: Math.max(cur.progress, value) } });
    }
  };
  if (!initial) useHangar.setState({ aircraftLoading: { id: def.id, progress: 0 } });
  const res = quality === "high" ? 4096 : 2048;
  const p = (async () => {
    let root: THREE.Group;
    if (def.model.kind === "procedural") {
      const b = BUILDERS[def.model.builder];
      if (!b) throw new Error(`No builder for ${def.model.builder}`);
      root = await b(res, onProgress);
    } else {
      const scene = await loadGltf(def.model.url, def.model.bytes, def.model.draco, onProgress);
      root = await prepareGltf(def, scene);
    }
    onProgress("model", 1);
    return root;
  })();
  p.catch(() => cache.delete(def.id)).finally(() => {
    if (useHangar.getState().aircraftLoading?.id === def.id) useHangar.setState({ aircraftLoading: null });
  });
  cache.set(def.id, p);
  return p;
}
