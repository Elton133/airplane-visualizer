import * as THREE from "three";

/**
 * Small toolkit for authoring procedural PBR texture sets on 2D canvases.
 * Colour, height and roughness are painted separately; height is converted to
 * a tangent-space normal map at the end.
 */

export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number, fill?: string): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: false })!;
  if (fill) {
    x.fillStyle = fill;
    x.fillRect(0, 0, w, h);
  }
  return { c, x };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small grayscale white-noise tile, smoothed when drawn upscaled. */
export function noiseTile(size: number, seed: number): HTMLCanvasElement {
  const { c, x } = canvas(size, size);
  const img = x.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(r() * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/**
 * Overlay fractal noise on a context: a few octaves of upscaled noise tiles,
 * blended with low alpha. Cheap — the browser does the filtering.
 */
export function fbmOverlay(
  x: Ctx,
  w: number,
  h: number,
  opts: { seed: number; octaves?: number; base?: number; alpha?: number; mode?: GlobalCompositeOperation },
) {
  const { seed, octaves = 4, base = 6, alpha = 0.08, mode = "overlay" } = opts;
  x.save();
  x.globalCompositeOperation = mode;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  for (let o = 0; o < octaves; o++) {
    const cells = base * Math.pow(2, o);
    const tile = noiseTile(Math.max(4, Math.round(cells)), seed + o * 101);
    x.globalAlpha = alpha / Math.pow(1.35, o);
    x.drawImage(tile, 0, 0, w, h);
  }
  x.restore();
}

/** Convert a grayscale height canvas into a tangent-space (OpenGL) normal map. */
export function heightToNormal(height: HTMLCanvasElement, strength: number, wrapX = true): HTMLCanvasElement {
  const w = height.width;
  const h = height.height;
  const src = height.getContext("2d")!.getImageData(0, 0, w, h).data;
  const { c, x } = canvas(w, h);
  const out = x.createImageData(w, h);
  const d = out.data;
  const H = (px: number, py: number) => {
    if (wrapX) px = (px + w) % w;
    else px = px < 0 ? 0 : px >= w ? w - 1 : px;
    py = py < 0 ? 0 : py >= h ? h - 1 : py;
    return src[(py * w + px) * 4]! / 255;
  };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = (H(px + 1, py) - H(px - 1, py)) * strength;
      const dy = (H(px, py + 1) - H(px, py - 1)) * strength;
      // canvas y runs down while v runs up, hence +dy for the green channel.
      let nx = -dx;
      let ny = dy;
      let nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const i = (py * w + px) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  x.putImageData(out, 0, 0);
  return c;
}

/**
 * Pack AO (R), roughness (G) and metalness (B) the way three.js expects
 * (roughness from G, metalness from B, aoMap from R).
 */
export function packORM(
  rough: HTMLCanvasElement,
  opts: { ao?: HTMLCanvasElement; metal?: number } = {},
): HTMLCanvasElement {
  const w = rough.width;
  const h = rough.height;
  const r = rough.getContext("2d")!.getImageData(0, 0, w, h).data;
  const a = opts.ao?.getContext("2d")!.getImageData(0, 0, w, h).data;
  const { c, x } = canvas(w, h);
  const out = x.createImageData(w, h);
  const m = Math.round((opts.metal ?? 0) * 255);
  for (let i = 0; i < w * h * 4; i += 4) {
    out.data[i] = a ? a[i]! : 255;
    out.data[i + 1] = r[i]!;
    out.data[i + 2] = m;
    out.data[i + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  return c;
}

export interface TexOptions {
  srgb?: boolean;
  repeat?: [number, number];
  anisotropy?: number;
  wrap?: THREE.Wrapping;
}

export function toTexture(c: HTMLCanvasElement, opts: TexOptions = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = opts.wrap ?? THREE.RepeatWrapping;
  t.wrapT = opts.wrap ?? THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = opts.anisotropy ?? 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Yield to the browser so progress UI can paint between heavy steps. */
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function roundRect(x: Ctx, cx: number, cy: number, w: number, h: number, r: number) {
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(x0 + r, y0);
  x.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
  x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  x.arcTo(x0, y0 + h, x0, y0, r);
  x.arcTo(x0, y0, x0 + w, y0, r);
  x.closePath();
}
