import * as THREE from "three";
import { charcoalTextures, fuselageTextures, nacelleTextures, wingTextures, type PBRSet } from "./textures";
import { nextFrame } from "../texture-kit";

export interface A320Materials {
  fuselage: THREE.MeshPhysicalMaterial;
  wing: THREE.MeshPhysicalMaterial;
  charcoal: THREE.MeshPhysicalMaterial;
  nacelle: THREE.MeshPhysicalMaterial;
  lip: THREE.MeshPhysicalMaterial;
  liner: THREE.MeshStandardMaterial;
  fanBlade: THREE.MeshPhysicalMaterial;
  spinner: THREE.MeshPhysicalMaterial;
  core: THREE.MeshStandardMaterial;
  exhaust: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  gear: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshPhysicalMaterial;
  tire: THREE.MeshStandardMaterial;
  hub: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  interior: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  lensRed: THREE.MeshPhysicalMaterial;
  lensGreen: THREE.MeshPhysicalMaterial;
  lensClear: THREE.MeshPhysicalMaterial;
  antenna: THREE.MeshStandardMaterial;
}

function paint(set: PBRSet, clearcoat: number, normalScale = 0.6) {
  return new THREE.MeshPhysicalMaterial({
    map: set.map,
    normalMap: set.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: set.roughnessMap,
    roughness: 1,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1,
  });
}

export async function createA320Materials(
  res: number,
  onProgress: (p: number) => void,
): Promise<A320Materials> {
  const fus = fuselageTextures(res);
  onProgress(0.4);
  await nextFrame();
  const wing = wingTextures(Math.min(res, 2048));
  onProgress(0.65);
  await nextFrame();
  const charcoal = charcoalTextures(1024);
  const nac = nacelleTextures(1024);
  onProgress(0.9);
  await nextFrame();

  const lens = (color: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.08,
      metalness: 0,
      transmission: 0,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1,
    });

  const m: A320Materials = {
    fuselage: paint(fus, 0.55, 0.55),
    wing: paint(wing, 0.2, 0.7),
    charcoal: paint(charcoal, 0.4, 0.5),
    nacelle: paint(nac, 0.5, 0.6),
    lip: new THREE.MeshPhysicalMaterial({ color: "#c9ccd0", metalness: 1, roughness: 0.2 }),
    liner: new THREE.MeshStandardMaterial({ color: "#1b1c1e", roughness: 0.72, metalness: 0.1 }),
    fanBlade: new THREE.MeshPhysicalMaterial({ color: "#9ea2a7", metalness: 1, roughness: 0.3 }),
    spinner: new THREE.MeshPhysicalMaterial({ color: "#7a7d82", metalness: 0.85, roughness: 0.32, clearcoat: 0.3 }),
    core: new THREE.MeshStandardMaterial({ color: "#7b7f83", roughness: 0.55, metalness: 0.35 }),
    exhaust: new THREE.MeshStandardMaterial({ color: "#5e544c", roughness: 0.5, metalness: 0.85 }),
    frame: new THREE.MeshStandardMaterial({ color: "#121314", roughness: 0.85, metalness: 0.2 }),
    gear: new THREE.MeshPhysicalMaterial({ color: "#c3c6c8", roughness: 0.42, metalness: 0.15, clearcoat: 0.3 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: "#e6e9ec", metalness: 1, roughness: 0.06 }),
    tire: new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.9, metalness: 0 }),
    hub: new THREE.MeshStandardMaterial({ color: "#9a9ea2", roughness: 0.38, metalness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: "#0d0e0f", roughness: 0.85, metalness: 0.1 }),
    interior: new THREE.MeshStandardMaterial({ color: "#16181a", roughness: 0.8, side: THREE.BackSide }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#0e1418",
      roughness: 0.035,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.9,
      envMapIntensity: 1.6,
      ior: 1.52,
      specularIntensity: 1,
    }),
    lensRed: lens("#5a1612"),
    lensGreen: lens("#123a22"),
    lensClear: lens("#c8ccd0"),
    antenna: new THREE.MeshStandardMaterial({ color: "#d8d9d8", roughness: 0.45 }),
  };
  onProgress(1);
  return m;
}
