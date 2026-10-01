import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import type { AircraftDefinition, ControlSurfaceRig } from "@/aircraft/types";
import { applyFx, createFxUniforms, type FxUniforms } from "@/three/fx-material";

// BVH-accelerated raycasting for picking, label occlusion and camera colliders.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

declare module "three" {
  interface BufferGeometry {
    computeBoundsTree: typeof computeBoundsTree;
    disposeBoundsTree: typeof disposeBoundsTree;
  }
}

export const OTHER = "__other";

export interface RigInstance {
  rig: ControlSurfaceRig;
  node: THREE.Object3D;
  axis: THREE.Vector3;
  basePosition: THREE.Vector3;
  baseQuaternion: THREE.Quaternion;
}

export interface ComponentRegistry {
  aircraftId: string;
  /** Meshes used for picking and occlusion (static proxies stand in for skinned meshes). */
  meshes: THREE.Mesh[];
  componentOf: Map<THREE.Object3D, string>;
  meshesOf: Map<string, THREE.Mesh[]>;
  uniforms: Map<string, FxUniforms>;
  rigs: RigInstance[];
  fans: THREE.Object3D[];
  colliders: THREE.Mesh[];
  /** Aircraft-space bounds of the whole model. */
  bounds: THREE.Box3;
}

/** Glob match: trailing `*` is a prefix wildcard. */
export function matches(pattern: string, name: string) {
  return pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

export function findNode(root: THREE.Object3D, pattern: string): THREE.Object3D | undefined {
  if (!pattern.endsWith("*")) return root.getObjectByName(pattern);
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && matches(pattern, o.name)) found = o;
  });
  return found;
}

/** Bones that drive a skinned mesh, heaviest first. */
function dominantBones(m: THREE.SkinnedMesh): THREE.Bone[] {
  const si = m.geometry.attributes.skinIndex;
  const sw = m.geometry.attributes.skinWeight;
  if (!si || !sw) return [];
  const sums = new Map<number, number>();
  const step = Math.max(1, Math.floor(si.count / 4000));
  for (let i = 0; i < si.count; i += step) {
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w > 0) sums.set(si.getComponent(i, k), (sums.get(si.getComponent(i, k)) ?? 0) + w);
    }
  }
  return [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => m.skeleton.bones[i]!)
    .filter(Boolean);
}

/**
 * A static, BVH-accelerated copy of a skinned mesh in its posed shape, in
 * root space. Used for picking, label occlusion and camera collision —
 * CPU-skinned raycasts would be far too slow on large assets.
 */
function staticProxy(m: THREE.SkinnedMesh, root: THREE.Object3D): THREE.Mesh {
  const src = m.geometry;
  const count = src.attributes.position!.count;
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(m.matrixWorld);
  for (let i = 0; i < count; i++) {
    m.getVertexPosition(i, v);
    v.applyMatrix4(toRoot);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (src.index) geo.setIndex(src.index.clone());
  geo.computeBoundsTree();
  const proxy = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  proxy.name = `${m.name}__proxy`;
  proxy.userData.proxyOf = m;
  return proxy;
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/**
 * Map semantic components to actual meshes. Educational logic only sees
 * component ids; mesh naming stays an asset-pipeline concern. For skinned
 * assets, a mesh is also matched by the bones that drive it.
 */
export function createRegistry(root: THREE.Object3D, def: AircraftDefinition): ComponentRegistry {
  const reg: ComponentRegistry = {
    aircraftId: def.id,
    meshes: [],
    componentOf: new Map(),
    meshesOf: new Map(),
    uniforms: new Map(),
    rigs: [],
    fans: [],
    colliders: [],
    bounds: new THREE.Box3(),
  };
  for (const c of [...def.components.map((c) => c.id), OTHER]) {
    reg.meshesOf.set(c, []);
    reg.uniforms.set(c, createFxUniforms());
  }
  const byNames = (names: string[]): string | null => {
    for (const n of names) for (const c of def.components) if (c.meshNames.some((p) => matches(p, n))) return c.id;
    return null;
  };
  const resolve = (obj: THREE.Object3D): string => {
    const names: string[] = [];
    for (let o: THREE.Object3D | null = obj; o; o = o.parent) names.push(o.name);
    const direct = byNames(names);
    if (direct) return direct;
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      for (const b of dominantBones(obj as THREE.SkinnedMesh)) {
        const chain: string[] = [];
        for (let o: THREE.Object3D | null = b; o && (o as THREE.Bone).isBone; o = o.parent) chain.push(o.name);
        const id = byNames(chain);
        if (id) return id;
      }
    }
    return OTHER;
  };

  root.updateMatrixWorld(true);
  const cache = new Map<string, THREE.Material>();
  const visual: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.proxyOf) visual.push(m);
  });
  for (const m of visual) {
    const id = resolve(m);
    reg.meshesOf.get(id)!.push(m);
    reg.componentOf.set(m, id);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mat) => {
      const key = `${id}:${mat.uuid}`;
      let c = cache.get(key);
      if (!c) {
        c = applyFx(mat.clone() as THREE.MeshStandardMaterial, reg.uniforms.get(id)!);
        cache.set(key, c);
      }
      return c;
    });
    m.material = Array.isArray(m.material) ? next : next[0]!;

    let pick: THREE.Mesh = m;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      const sk = m as THREE.SkinnedMesh;
      sk.skeleton.update();
      pick = staticProxy(sk, root);
      root.add(pick);
      // The visual skinned mesh is never raycast directly.
      sk.raycast = () => undefined;
      reg.componentOf.set(pick, id);
    } else if (!m.geometry.boundsTree) {
      m.geometry.computeBoundsTree();
    }
    reg.meshes.push(pick);
    const names: string[] = [];
    for (let o: THREE.Object3D | null = m; o; o = o.parent) names.push(o.name);
    if (def.colliderMeshes.some((p) => names.some((n) => matches(p, n)))) reg.colliders.push(pick);
  }

  for (const rig of def.surfaces) {
    const node = findNode(root, rig.node);
    if (!node) {
      console.warn(`[HANGAR] rig node not found: ${rig.node}`);
      continue;
    }
    let axis = AXES[rig.axis ?? "x"].clone();
    if (rig.worldAxis) {
      // World (aircraft-space) direction → the node's local frame.
      const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
      const nodeQ = node.getWorldQuaternion(new THREE.Quaternion());
      const rel = rootQ.invert().multiply(nodeQ);
      axis = new THREE.Vector3(...rig.worldAxis).normalize().applyQuaternion(rel.invert());
    }
    reg.rigs.push({
      rig,
      node,
      axis,
      basePosition: node.position.clone(),
      baseQuaternion: node.quaternion.clone(),
    });
  }
  for (const n of def.fanNodes) {
    const f = findNode(root, n);
    if (f) reg.fans.push(f);
  }
  reg.bounds.setFromObject(root, true);
  // Bounds in root space (root sits at the origin of its slot).
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  reg.bounds.applyMatrix4(inv);
  return reg;
}

export function componentFromObject(reg: ComponentRegistry, obj: THREE.Object3D): string | null {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
    const id = reg.componentOf.get(o);
    if (id) return id === OTHER ? null : id;
  }
  return null;
}
