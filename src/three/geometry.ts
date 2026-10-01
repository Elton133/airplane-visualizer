import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type P3 = [number, number, number];

interface LoftOptions {
  /** Close each section into a loop (default true). */
  closed?: boolean;
  capStart?: boolean;
  capEnd?: boolean;
  /** UV for section i (0‥1 along loft) and point j (0‥1 around section). */
  uv?: (si: number, pj: number, i: number, j: number) => [number, number];
  /** Crease angle in radians. Set to 0 to keep smooth indexed normals. */
  crease?: number;
  /** Force outward orientation using the signed volume (closed shells only). */
  orient?: boolean;
}

/**
 * Loft a list of equal-length point sections into a skinned surface.
 */
export function loft(sections: P3[][], opts: LoftOptions = {}): THREE.BufferGeometry {
  const { closed = true, capStart = false, capEnd = false, crease = 0.9, orient = true } = opts;
  const S = sections.length;
  const M = sections[0]!.length;
  const ringLen = closed ? M + 1 : M;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];

  for (let i = 0; i < S; i++) {
    const sec = sections[i]!;
    for (let j = 0; j < ringLen; j++) {
      const p = sec[j % M]!;
      positions.push(p[0], p[1], p[2]);
      const uv: [number, number] = opts.uv ? opts.uv(i / (S - 1), j / (ringLen - 1), i, j % M) : [i / (S - 1), j / (ringLen - 1)];
      uvs.push(uv[0], uv[1]);
    }
  }
  for (let i = 0; i < S - 1; i++) {
    for (let j = 0; j < ringLen - 1; j++) {
      const a = i * ringLen + j;
      const b = a + 1;
      const c = a + ringLen;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  const addCap = (si: number, reverse: boolean) => {
    const sec = sections[si]!;
    const cx = sec.reduce((s, p) => s + p[0], 0) / M;
    const cy = sec.reduce((s, p) => s + p[1], 0) / M;
    const cz = sec.reduce((s, p) => s + p[2], 0) / M;
    const base = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, 0.5);
    for (let j = 0; j < M; j++) {
      const p = sec[j]!;
      positions.push(p[0], p[1], p[2]);
      uvs.push(0.5, 0.5);
    }
    for (let j = 0; j < M; j++) {
      const a = base + 1 + j;
      const b = base + 1 + ((j + 1) % M);
      if (reverse) index.push(base, a, b);
      else index.push(base, b, a);
    }
  };
  if (capStart) addCap(0, false);
  if (capEnd) addCap(S - 1, true);

  let geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  if (orient) orientOutward(geo);
  if (crease > 0) geo = toCreasedNormals(geo, crease);
  else geo.computeVertexNormals();
  return geo;
}

/** Flip triangle winding if the shell's signed volume is negative. */
export function orientOutward(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!idx) return;
  let vol = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  // Use the centroid as origin so open shells still orient sensibly.
  const ctr = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) ctr.add(a.fromBufferAttribute(pos, i));
  ctr.divideScalar(pos.count);
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i)).sub(ctr);
    b.fromBufferAttribute(pos, idx.getX(i + 1)).sub(ctr);
    c.fromBufferAttribute(pos, idx.getX(i + 2)).sub(ctr);
    vol += a.dot(b.cross(c));
  }
  if (vol < 0) flipWinding(geo);
}

export function flipWinding(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex();
  if (!idx) return;
  const arr = idx.array as Uint32Array | Uint16Array;
  for (let i = 0; i < arr.length; i += 3) {
    const t = arr[i + 1]!;
    arr[i + 1] = arr[i + 2]!;
    arr[i + 2] = t;
  }
  idx.needsUpdate = true;
}

/**
 * Revolve a profile of [x, r] pairs around the X axis.
 * UV: u = along profile (arc length), v = around.
 */
export function revolveX(
  profile: [number, number][],
  segments = 64,
  opts: { crease?: number; phi0?: number; phi1?: number; flip?: boolean } = {},
): THREE.BufferGeometry {
  // Normals face away from the axis when the profile runs toward +X; pass
  // `flip` for profiles that run toward -X or for inward-facing surfaces.
  const { crease = 0.6, phi0 = 0, phi1 = Math.PI * 2, flip = false } = opts;
  const lengths = [0];
  for (let i = 1; i < profile.length; i++) {
    const [x0, r0] = profile[i - 1]!;
    const [x1, r1] = profile[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(x1 - x0, r1 - r0));
  }
  const total = lengths[lengths.length - 1]! || 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const ring = segments + 1;
  for (let i = 0; i < profile.length; i++) {
    const [x, r] = profile[i]!;
    for (let j = 0; j < ring; j++) {
      const phi = phi0 + ((phi1 - phi0) * j) / segments;
      positions.push(x, r * Math.cos(phi), r * Math.sin(phi));
      uvs.push(lengths[i]! / total, j / segments);
    }
  }
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * ring + j;
      const b = a + 1;
      const c = a + ring;
      const d = c + 1;
      if (flip) index.push(a, c, b, b, c, d);
      else index.push(a, b, c, b, d, c);
    }
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  if (crease > 0) geo = toCreasedNormals(geo, crease);
  else geo.computeVertexNormals();
  return geo;
}

/** Convenience: a cylinder between two points. */
export function strut(a: P3, b: P3, radius: number, radial = 14, radiusB = radius): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const geo = new THREE.CylinderGeometry(radiusB, radius, len, radial, 1, false);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  return geo;
}

/** Cosine spacing in [a, b] — clusters samples at both ends. */
export function cosSpace(n: number, a = 0, b = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + (b - a) * 0.5 * (1 - Math.cos((Math.PI * i) / n)));
  return out;
}

export function linSpace(n: number, a = 0, b = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/** Merge station lists, sort, dedupe. */
export function stations(...lists: number[][]): number[] {
  const all = lists.flat().sort((x, y) => x - y);
  const out: number[] = [];
  for (const v of all) if (out.length === 0 || Math.abs(v - out[out.length - 1]!) > 1e-4) out.push(v);
  return out;
}
