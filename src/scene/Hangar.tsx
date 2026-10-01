"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { claddingTextures, concreteTextures } from "@/three/a320/textures";
import { applyFx, createFxUniforms } from "@/three/fx-material";
import { setProgress, useHangar, type QualityLevel } from "@/state/store";
import { FIXTURE_ROWS, runtime } from "./runtime";

RectAreaLightUniformsLib.init();

/**
 * A dark, quiet engineering hangar. Interior ≈ 164 × 152 m, 26 m clear height —
 * large enough for two aircraft side by side at true scale.
 * Overhead linear high-bays in rows along X; a partly open door in the
 * starboard wall lets in a strip of cool daylight.
 */

const HALL = { x0: -80, x1: 84, z0: -76, z1: 76, h: 26 };
const ROW_X = Array.from({ length: FIXTURE_ROWS }, (_, i) => -36 + i * 12);
const COL_Z = [-42, -30, -18, -6, 6, 18, 30, 42];
const FIXTURE_Y = 19.5;

const hangarFx = createFxUniforms();

export function Hangar({ quality }: { quality: QualityLevel }) {
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const areaRef = useRef<THREE.RectAreaLight>(null);
  const doorRef = useRef<THREE.RectAreaLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fixturesRef = useRef<THREE.InstancedMesh>(null);
  const scene = useThree((s) => s.scene);

  const concrete = useMemo(() => concreteTextures(quality === "performance" ? 1024 : 2048), [quality]);
  const cladding = useMemo(() => claddingTextures(512), []);

  useEffect(() => {
    const floorRepeat = 240 / concrete.tileSize;
    for (const t of [concrete.map, concrete.normalMap, concrete.roughnessMap]) t.repeat.set(floorRepeat, floorRepeat);
    for (const t of [cladding.map, cladding.normalMap, cladding.roughnessMap]) t.repeat.set(18, 3);
  }, [concrete, cladding]);

  const wallMat = useMemo(
    () =>
      applyFx(
        new THREE.MeshStandardMaterial({
          map: cladding.map,
          normalMap: cladding.normalMap,
          roughnessMap: cladding.roughnessMap,
          roughness: 1,
          metalness: 0.35,
          color: "#9a9ea2",
        }),
        hangarFx,
      ),
    [cladding],
  );
  const steelMat = useMemo(
    () => applyFx(new THREE.MeshStandardMaterial({ color: "#26282b", roughness: 0.6, metalness: 0.6 }), hangarFx),
    [],
  );
  const markingMat = useMemo(
    () =>
      applyFx(
        new THREE.MeshStandardMaterial({
          color: "#8a6f1f",
          roughness: 0.75,
          transparent: true,
          opacity: 0.55,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
        hangarFx,
      ),
    [],
  );

  // Fixture instances (emissive linear high-bays).
  const fixtureLayout = useMemo(() => {
    const out: { x: number; z: number; row: number }[] = [];
    ROW_X.forEach((x, row) => COL_Z.forEach((z) => out.push({ x, z, row })));
    return out;
  }, []);

  useEffect(() => {
    const im = fixturesRef.current;
    if (!im) return;
    const m = new THREE.Matrix4();
    fixtureLayout.forEach((f, i) => {
      m.makeTranslation(f.x, FIXTURE_Y, f.z);
      im.setMatrixAt(i, m);
      im.setColorAt(i, new THREE.Color(0, 0, 0));
    });
    im.instanceMatrix.needsUpdate = true;
  }, [fixtureLayout]);

  useEffect(() => {
    setProgress("environment", 0.5);
  }, []);

  const lastFixtures = useRef<string>("");
  const col = useMemo(() => new THREE.Color(), []);
  const shadowR = useRef(0);
  useFrame((_, frameDt) => {
    const key = keyRef.current;
    if (key && Math.abs(shadowR.current - runtime.shadowRadius) > 0.5) {
      shadowR.current = runtime.shadowRadius;
      const cam = key.shadow.camera;
      cam.left = cam.bottom = -runtime.shadowRadius;
      cam.right = cam.top = runtime.shadowRadius;
      cam.updateProjectionMatrix();
    }
    runtime.dark = THREE.MathUtils.damp(runtime.dark, useHangar.getState().lighting === "dark" ? 1 : 0, 2.2, Math.min(frameDt, 0.05));
    // House lights down for the dark hangar; a little moonlight through the door.
    const night = 1 - runtime.dark * 0.94;
    const dim = (1 - runtime.hangarDim * 0.8) * night;
    hangarFx.uFade.value = (1 - runtime.hangarDim * 0.85) * (1 - runtime.dark * 0.6);
    const lit = runtime.fixtures.reduce((a, b) => a + b, 0) / FIXTURE_ROWS;
    if (keyRef.current) keyRef.current.intensity = 2.4 * runtime.key * dim;
    if (areaRef.current) areaRef.current.intensity = 3.2 * lit * dim;
    if (doorRef.current) doorRef.current.intensity = 2.2 * runtime.door * (1 - runtime.hangarDim * 0.8) * (1 - runtime.dark * 0.75);
    if (hemiRef.current) hemiRef.current.intensity = 0.28 * Math.max(lit, runtime.key) * dim;
    scene.environmentIntensity = 0.03 + 0.97 * runtime.env * (1 - runtime.hangarDim * 0.55) * (1 - runtime.dark * 0.9);

    const im = fixturesRef.current;
    const sig = runtime.fixtures.map((v) => v.toFixed(2)).join() + dim.toFixed(2);
    if (im && sig !== lastFixtures.current) {
      lastFixtures.current = sig;
      fixtureLayout.forEach((f, i) => {
        const v = (runtime.fixtures[f.row] ?? 0) * (0.25 + 0.75 * dim) * (1 - runtime.dark * 0.97);
        col.setRGB(9 * v, 8.6 * v, 8.0 * v);
        im.setColorAt(i, col);
      });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  const floorSize = 240;
  const shadowMap = quality === "high" ? 4096 : quality === "balanced" ? 2048 : 1024;

  return (
    <group>
      <color attach="background" args={["#050607"]} />
      <fogExp2 attach="fog" args={["#07080a", 0.0036]} />

      {/* Reflections: an environment built from the hangar's own light layout. */}
      <Environment resolution={quality === "performance" ? 128 : 256} frames={1} environmentIntensity={1}>
        <color attach="background" args={["#030304"]} />
        {ROW_X.map((x) =>
          COL_Z.map((z) => (
            <Lightformer
              key={`${x}:${z}`}
              form="rect"
              intensity={3.2}
              color="#fff4e8"
              position={[x, FIXTURE_Y, z]}
              rotation-x={Math.PI / 2}
              scale={[0.5, 3.6, 1]}
            />
          )),
        )}
        {/* Long soft strip overhead: produces the long fuselage highlight. */}
        <Lightformer form="rect" intensity={1.4} color="#fdf8f0" position={[0, 22, 0]} rotation-x={Math.PI / 2} scale={[80, 10, 1]} />
        {/* Door daylight. */}
        <Lightformer form="rect" intensity={2.4} color="#d6e1ee" position={[22, 9, HALL.z1]} rotation-y={Math.PI} scale={[7, 18, 1]} />
        {/* Faint wall bounce so reflections never fall to pure black. */}
        <Lightformer form="rect" intensity={0.08} color="#8a8f96" position={[HALL.x0, 10, 0]} rotation-y={Math.PI / 2} scale={[150, 20, 1]} />
        <Lightformer form="rect" intensity={0.08} color="#8a8f96" position={[HALL.x1, 10, 0]} rotation-y={-Math.PI / 2} scale={[130, 20, 1]} />
        <Lightformer form="rect" intensity={0.06} color="#8a8f96" position={[0, 10, HALL.z0]} scale={[150, 20, 1]} />
        {/* Floor bounce. */}
        <Lightformer form="rect" intensity={0.22} color="#6b665f" position={[0, -1, 0]} rotation-x={-Math.PI / 2} scale={[90, 90, 1]} />
      </Environment>

      <directionalLight
        ref={keyRef}
        position={[10, 42, -14]}
        intensity={0}
        color="#fff6ec"
        castShadow
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={10}
        shadow-camera-far={80}
      />
      <rectAreaLight ref={areaRef} position={[0, 19, 0]} rotation-x={-Math.PI / 2} width={56} height={24} intensity={0} color="#fff3e6" />
      <rectAreaLight ref={doorRef} position={[22, 9, HALL.z1 - 1]} rotation-y={Math.PI} width={7} height={18} intensity={0} color="#d8e3f0" />
      <hemisphereLight ref={hemiRef} args={["#c9d2db", "#2a2724", 0]} />

      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[floorSize, floorSize]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            map={concrete.map}
            normalMap={concrete.normalMap}
            normalScale={new THREE.Vector2(0.4, 0.4)}
            roughnessMap={concrete.roughnessMap}
            roughness={0.82}
            metalness={0}
            color="#9b9c9c"
            blur={[600, 160]}
            resolution={1024}
            mixBlur={1}
            mixStrength={1.6}
            mixContrast={1}
            depthScale={0.6}
            minDepthThreshold={0.2}
            maxDepthThreshold={1.3}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial
            map={concrete.map}
            normalMap={concrete.normalMap}
            roughnessMap={concrete.roughnessMap}
            roughness={0.8}
            color="#9b9c9c"
          />
        )}
      </mesh>

      <ContactShadows
        position={[0, 0.012, 0]}
        scale={[130, 130]}
        resolution={quality === "performance" ? 512 : 1024}
        far={5}
        blur={2.4}
        opacity={0.7}
        color="#000000"
        frames={quality === "performance" ? 40 : Infinity}
      />

      {/* Restrained floor marking: stand centreline. */}
      <mesh rotation-x={-Math.PI / 2} position={[2, 0.004, 0]} material={markingMat}>
        <planeGeometry args={[70, 0.15]} />
      </mesh>

      {/* Walls */}
      <mesh position={[HALL.x0, HALL.h / 2, 0]} rotation-y={Math.PI / 2} material={wallMat} receiveShadow>
        <planeGeometry args={[HALL.z1 - HALL.z0, HALL.h]} />
      </mesh>
      <mesh position={[HALL.x1, HALL.h / 2, 0]} rotation-y={-Math.PI / 2} material={wallMat}>
        <planeGeometry args={[HALL.z1 - HALL.z0, HALL.h]} />
      </mesh>
      <mesh position={[(HALL.x0 + HALL.x1) / 2, HALL.h / 2, HALL.z0]} material={wallMat}>
        <planeGeometry args={[HALL.x1 - HALL.x0, HALL.h]} />
      </mesh>
      <DoorWall wallMat={wallMat} steelMat={steelMat} />

      {/* Roof and trusses */}
      <mesh position={[(HALL.x0 + HALL.x1) / 2, HALL.h, 0]} rotation-x={Math.PI / 2} material={steelMat}>
        <planeGeometry args={[HALL.x1 - HALL.x0, HALL.z1 - HALL.z0]} />
      </mesh>
      <Trusses steelMat={steelMat} />

      {/* Overhead fixtures */}
      <instancedMesh ref={fixturesRef} args={[undefined, undefined, fixtureLayout.length]} frustumCulled={false}>
        <boxGeometry args={[0.45, 0.08, 3.6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <Equipment steelMat={steelMat} />
    </group>
  );
}

function DoorWall({ wallMat, steelMat }: { wallMat: THREE.Material; steelMat: THREE.Material }) {
  // Starboard wall with a large sliding door, open ~7 m to daylight.
  const z = HALL.z1;
  const gap0 = 18.5;
  const gap1 = 25.5;
  const left = gap0 - HALL.x0;
  const right = HALL.x1 - gap1;
  return (
    <group>
      <mesh position={[HALL.x0 + left / 2, HALL.h / 2, z]} rotation-y={Math.PI} material={wallMat}>
        <planeGeometry args={[left, HALL.h]} />
      </mesh>
      <mesh position={[gap1 + right / 2, HALL.h / 2, z]} rotation-y={Math.PI} material={wallMat}>
        <planeGeometry args={[right, HALL.h]} />
      </mesh>
      <mesh position={[(gap0 + gap1) / 2, 20.5, z]} rotation-y={Math.PI} material={wallMat}>
        <planeGeometry args={[gap1 - gap0, 11]} />
      </mesh>
      {/* Daylight beyond the door: a bright, slightly cool panel. */}
      <mesh position={[(gap0 + gap1) / 2, 7.5, z + 1.5]} rotation-y={Math.PI}>
        <planeGeometry args={[gap1 - gap0 + 2, 15]} />
        <meshBasicMaterial color={[1.6, 1.75, 1.95]} toneMapped={false} />
      </mesh>
      {/* Door leaf tracks and frame */}
      <mesh position={[(gap0 + gap1) / 2, 15.2, z - 0.4]} material={steelMat}>
        <boxGeometry args={[gap1 - gap0 + 1.2, 0.5, 0.5]} />
      </mesh>
      {[gap0 - 0.3, gap1 + 0.3].map((x) => (
        <mesh key={x} position={[x, 7.6, z - 0.4]} material={steelMat}>
          <boxGeometry args={[0.6, 15.2, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}

function Trusses({ steelMat }: { steelMat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    // Primary trusses spanning Z (top + bottom chords), every 12 m.
    for (let x = HALL.x0 + 6; x < HALL.x1; x += 12) {
      for (const y of [HALL.h - 0.4, HALL.h - 3.2]) {
        out.push(new THREE.Matrix4().compose(p.set(x, y, 0), q.identity(), s.set(0.35, 0.45, HALL.z1 - HALL.z0)));
      }
      // Diagonal web members
      for (let z = HALL.z0 + 3; z < HALL.z1 - 3; z += 6) {
        const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler((z / 6) % 2 === 0 ? 0.75 : -0.75, 0, 0));
        out.push(new THREE.Matrix4().compose(p.set(x, HALL.h - 1.8, z), qq, s.set(0.18, 3.8, 0.18)));
      }
    }
    // Purlins along X.
    for (let z = HALL.z0 + 8; z < HALL.z1; z += 8) {
      out.push(new THREE.Matrix4().compose(p.set((HALL.x0 + HALL.x1) / 2, HALL.h - 0.25, z), q.identity(), s.set(HALL.x1 - HALL.x0, 0.25, 0.2)));
    }
    // Wall columns.
    for (let x = HALL.x0 + 6; x < HALL.x1; x += 12) {
      for (const z of [HALL.z0 + 0.4, HALL.z1 - 0.4]) {
        if (z > 0 && x > 16 && x < 28) continue;
        out.push(new THREE.Matrix4().compose(p.set(x, HALL.h / 2, z), q.identity(), s.set(0.6, HALL.h, 0.5)));
      }
    }
    for (let z = HALL.z0 + 8; z < HALL.z1; z += 16) {
      out.push(new THREE.Matrix4().compose(p.set(HALL.x0 + 0.4, HALL.h / 2, z), q.identity(), s.set(0.5, HALL.h, 0.6)));
    }
    return out;
  }, []);
  useEffect(() => {
    const im = ref.current;
    if (!im) return;
    items.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} material={steelMat}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/** Very subtle equipment silhouettes near the walls. */
function Equipment({ steelMat }: { steelMat: THREE.Material }) {
  return (
    <group>
      {/* Maintenance work platform, far port side. */}
      <group position={[-30, 0, -46]}>
        {[
          [-2.4, -1.2],
          [2.4, -1.2],
          [-2.4, 1.2],
          [2.4, 1.2],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x!, 2.6, z!]} material={steelMat} castShadow>
            <boxGeometry args={[0.12, 5.2, 0.12]} />
          </mesh>
        ))}
        <mesh position={[0, 5.2, 0]} material={steelMat} castShadow>
          <boxGeometry args={[5.2, 0.12, 2.8]} />
        </mesh>
        <mesh position={[0, 6.2, -1.35]} material={steelMat}>
          <boxGeometry args={[5.2, 0.05, 0.05]} />
        </mesh>
      </group>
      {/* Tool cabinets along the back wall. */}
      {[-24, -20.6, -17.2].map((z) => (
        <mesh key={z} position={[HALL.x0 + 1.2, 1, z]} material={steelMat} castShadow>
          <boxGeometry args={[0.9, 2, 3]} />
        </mesh>
      ))}
    </group>
  );
}

export { hangarFx };
