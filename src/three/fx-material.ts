import * as THREE from "three";

/**
 * Per-component visual state injected into standard/physical materials:
 *  - uHL / uHLAmt: subtle brighten (hover / selection)
 *  - uRim: thin fresnel rim in uHL colour (selection, active system)
 *  - uFade: overall dimming (isolation, systems mode)
 *  - uDesat: desaturation toward a technical ghost look
 * All materials share one program; only uniform values differ.
 */
export interface FxUniforms {
  uHL: { value: THREE.Color };
  uHLAmt: { value: number };
  uRim: { value: number };
  uFade: { value: number };
  uDesat: { value: number };
}

export function createFxUniforms(): FxUniforms {
  return {
    uHL: { value: new THREE.Color(1, 1, 1) },
    uHLAmt: { value: 0 },
    uRim: { value: 0 },
    uFade: { value: 1 },
    uDesat: { value: 0 },
  };
}

type FxMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;

export function applyFx<T extends FxMaterial>(material: T, u: FxUniforms): T {
  const isLit = !(material instanceof THREE.MeshBasicMaterial);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader =
      `uniform vec3 uHL;\nuniform float uHLAmt;\nuniform float uRim;\nuniform float uFade;\nuniform float uDesat;\n` +
      shader.fragmentShader;
    if (isLit) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 fxView = normalize(vViewPosition);
          float fxFres = pow(1.0 - clamp(abs(dot(normal, fxView)), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += uHL * (uHLAmt * (0.35 + 0.65 * fxFres) + uRim * fxFres);
        }`,
      );
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
      {
        float fxL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(fxL), uDesat) * uFade;
      }`,
    );
  };
  material.customProgramCacheKey = () => (isLit ? "hangar-fx-lit" : "hangar-fx-basic");
  material.needsUpdate = true;
  return material;
}
