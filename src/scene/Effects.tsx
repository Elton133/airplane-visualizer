"use client";

import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { QualityLevel } from "@/state/store";

/** Restrained, photographic post: AO, bloom only on real lights, filmic tone map. */
export function Effects({ quality }: { quality: QualityLevel }) {
  if (quality === "performance") {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={quality === "high" ? 2.2 : 1.8}
        distanceFalloff={0.9}
        intensity={quality === "high" ? 2.4 : 2.0}
        quality={quality === "high" ? "high" : "medium"}
        halfRes={quality !== "high"}
        color="black"
      />
      <Bloom luminanceThreshold={1.8} luminanceSmoothing={0.2} intensity={0.28} mipmapBlur radius={0.6} />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
}
