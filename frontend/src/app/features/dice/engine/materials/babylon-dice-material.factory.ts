import {
  Color3,
  FresnelParameters,
  Mesh,
  MultiMaterial,
  Scene,
  SceneLoader,
  StandardMaterial,
  SubMesh
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { DicePulseWaveform } from '../dice-physics.types';
import {
  buildBabylonDieVertexData,
  BuiltBabylonDieGeometry,
  D4_FACE_NUMBERS,
  DICE_SIZE_SCALE_MAP,
  DiceModelDefinition,
  DicePolyhedronType,
  FACE_VALUES
} from '../models';
import { DiceCustomRuntimeConfig, DiceSkinConfig } from '../skins/dice-skin.types';
import {
  createBevelCanvas,
  createD4FaceCanvas,
  createFaceCanvas
} from './face-overlays.drawer';
import { hexToRgbTuple } from './face-patterns.drawer';
import {
  createBabylonDynamicTextureFromCanvas,
  createBabylonNormalTextureFromHeightCanvas
} from './normal-emissive.generator';

export interface BuiltBabylonDieInstance {
  mesh: Mesh;
  dieType: DicePolyhedronType;
  faceMaterials: StandardMaterial[];
  multiMaterial: MultiMaterial;
  builtGeometry: BuiltBabylonDieGeometry;
}

export function hexToColor3(hex: string): Color3 {
  const [r, g, b] = hexToRgbTuple(hex);
  return new Color3(r / 255, g / 255, b / 255);
}

function evaluateWaveform(waveform: DicePulseWaveform, tSec: number, speedHz: number, minVal: number, maxVal: number): number {
  const phase = tSec * Math.max(0.1, speedHz);
  let norm = 0.5;
  switch (waveform) {
    case 'heartbeat': {
      const p1 = Math.max(0, Math.sin(phase * Math.PI * 2));
      const p2 = Math.max(0, Math.sin(phase * Math.PI * 2 - 0.65)) * 0.55;
      norm = Math.min(1, p1 + p2);
      break;
    }
    case 'sawtooth':
      norm = phase - Math.floor(phase);
      break;
    case 'flicker':
      norm = 0.5 + 0.35 * Math.sin(phase * 9.7) + 0.15 * Math.cos(phase * 23.3);
      break;
    case 'sine':
    default:
      norm = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      break;
  }
  const lo = Math.min(minVal, maxVal);
  const hi = Math.max(minVal, maxVal);
  return lo + Math.max(0, Math.min(1, norm)) * (hi - lo);
}

export function buildDieFaceMaterials(
  type: DicePolyhedronType,
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  scene: Scene
): StandardMaterial[] {
  const materials: StandardMaterial[] = [];
  const metallic = Math.max(0, Math.min(1, custom.reflectionMetallic ?? skin.metalness));
  const roughness = Math.max(0.04, Math.min(1, custom.surfaceRoughness ?? skin.roughness));
  const glowColor3 = hexToColor3(custom.glowColorHex || skin.emissiveColor);
  const borderColor3 = hexToColor3(custom.borderColorHex || skin.borderColor || custom.glowColorHex || skin.accentColor);
  const coreAlpha = Math.max(0.12, Math.min(1, custom.coreOpacity ?? 1.0));
  const bumpIntensity = Math.max(0, Math.min(3.0, custom.bumpMapIntensity ?? 1.0));
  const numberDepth = Math.abs(custom.numberDepth ?? 0.75);

  const specIntensity = 0.18 + metallic * 0.82;
  const specularColor = Color3.Lerp(new Color3(specIntensity, specIntensity, specIntensity), borderColor3, metallic * 0.55);
  const specularPower = Math.round(12 + (1 - roughness) * 116 + (custom.clearcoat ?? 0) * 48);

  // Slot 0: Chamfer bevel / frame material
  const bevelMat = new StandardMaterial(`lw-die-bevel-${type}-${skin.id}`, scene);
  const bevelCanvas = createBevelCanvas(skin, custom, 128);
  bevelMat.diffuseTexture = createBabylonDynamicTextureFromCanvas(
    `lw-bevel-diff-${type}-${skin.id}`,
    bevelCanvas,
    scene
  );
  bevelMat.specularColor = specularColor;
  bevelMat.specularPower = specularPower;
  if (custom.glowIntensity > 0.2 || custom.coreOuterGlowEnabled) {
    const cGlow = hexToColor3(custom.coreOuterGlowColor || custom.glowColorHex || skin.emissiveColor);
    bevelMat.emissiveColor = cGlow.scale(Math.max(custom.glowIntensity, custom.coreOuterGlowOpacity ?? 0) * 0.18);
  }
  if (coreAlpha < 0.99) {
    bevelMat.alpha = Math.min(0.96, coreAlpha + 0.06);
  }
  materials.push(bevelMat);

  // Slots 1..N: Numbered polyhedral faces
  const faceVals = FACE_VALUES[type];
  const texSize = type === 'd20' || type === 'd12' ? 256 : 384;
  const normalStrength = 1.4 + bumpIntensity * 1.1 + numberDepth * 1.8;

  for (let i = 0; i < faceVals.length; i++) {
    const val = faceVals[i];
    const label = type === 'd100' ? (val === 10 ? '00' : `${val * 10}`) : type === 'd10' && val === 10 ? '0' : String(val);

    const canvases =
      type === 'd4'
        ? createD4FaceCanvas(D4_FACE_NUMBERS[i] ?? [1, 2, 3], skin, custom, texSize)
        : createFaceCanvas(label, skin, custom, texSize);

    const faceMat = new StandardMaterial(`lw-die-face-${type}-${i + 1}`, scene);
    faceMat.diffuseTexture = createBabylonDynamicTextureFromCanvas(
      `lw-face-diff-${type}-${i + 1}`,
      canvases.diffuseCanvas,
      scene
    );
    faceMat.bumpTexture = createBabylonNormalTextureFromHeightCanvas(
      `lw-face-norm-${type}-${i + 1}`,
      canvases.heightCanvas,
      scene,
      normalStrength
    );
    faceMat.bumpTexture.level = Math.max(0.05, bumpIntensity * 0.85 + numberDepth * 0.55);

    const hasEmissive =
      custom.glowIntensity > 0.05 ||
      custom.coreInnerGlowEnabled ||
      custom.coreOuterGlowEnabled ||
      custom.numberInnerGlowEnabled ||
      custom.numberOuterGlowEnabled;

    if (hasEmissive) {
      faceMat.emissiveTexture = createBabylonDynamicTextureFromCanvas(
        `lw-face-emis-${type}-${i + 1}`,
        canvases.emissiveCanvas,
        scene
      );
      faceMat.emissiveColor = glowColor3.scale(0.5 + custom.glowIntensity * 0.7);
    } else {
      faceMat.emissiveColor = Color3.Black();
    }

    faceMat.specularColor = specularColor;
    faceMat.specularPower = specularPower;

    if (coreAlpha < 0.99 || (custom.fresnelIntensity ?? 0) > 0.15) {
      faceMat.alpha = coreAlpha;
      if ((custom.fresnelIntensity ?? 0) > 0.15) {
        const fresnel = new FresnelParameters();
        fresnel.bias = 0.12;
        fresnel.power = Math.max(1.2, 3.4 - (custom.fresnelIntensity ?? 0.35) * 1.6);
        fresnel.leftColor = glowColor3.scale(custom.fresnelIntensity ?? 0.5);
        fresnel.rightColor = Color3.Black();
        faceMat.emissiveFresnelParameters = fresnel;
      }
    }

    materials.push(faceMat);
  }

  return materials;
}

export function buildBabylonPolyhedralDie(
  name: string,
  type: DicePolyhedronType,
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  model: DiceModelDefinition,
  scene: Scene
): BuiltBabylonDieInstance {
  const physicsScale = (custom.physics?.scale ?? 5) / 5;
  const sizeMultiplier = (DICE_SIZE_SCALE_MAP[custom.sizePreset] ?? 1.0) * (model.scaleMultiplier ?? 1.0) * physicsScale;
  const chamfer = custom.chamferBevelFactor ?? model.chamferFactor ?? 0.955;
  const builtGeometry = buildBabylonDieVertexData(
    type,
    1.15 * sizeMultiplier,
    chamfer
  );

  const mesh = new Mesh(name, scene);
  builtGeometry.vertexData.applyToMesh(mesh, true);

  const faceMaterials = buildDieFaceMaterials(type, skin, custom, scene);
  const multiMat = new MultiMaterial(`${name}-multimat`, scene);
  multiMat.subMaterials = faceMaterials.slice();
  mesh.material = multiMat;

  applySubMeshesToDieMesh(mesh, builtGeometry);

  if (model.geometryMode === 'glb-mesh' && model.glbAssetDirectory && model.glbFileName) {
    void attachOptionalGlbChildMesh(mesh, type, model, scene);
  }

  return {
    mesh,
    dieType: type,
    faceMaterials,
    multiMaterial: multiMat,
    builtGeometry
  };
}

export function applySubMeshesToDieMesh(
  mesh: Mesh,
  builtGeometry: BuiltBabylonDieGeometry
): void {
  mesh.subMeshes = [];
  const totalVertices = mesh.getTotalVertices();
  for (const range of builtGeometry.subMeshRanges) {
    new SubMesh(
      range.materialIndex,
      0,
      totalVertices,
      range.indexStart,
      range.indexCount,
      mesh
    );
  }
}

export function applyVeinPulseToDieMaterials(
  materials: StandardMaterial[],
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  elapsedSeconds: number
): void {
  const anyPulse = custom.veinPulse || custom.corePulseEnabled || custom.numberPulseEnabled;
  if (!anyPulse) {
    return;
  }

  const coreGlow = hexToColor3(custom.coreOuterGlowColor || custom.glowColorHex || skin.emissiveColor);
  const numGlow = hexToColor3(custom.numberOuterGlowColor || custom.glowColorHex || skin.emissiveColor);

  const coreFactor = custom.corePulseEnabled
    ? evaluateWaveform(
        custom.corePulseWaveform ?? 'heartbeat',
        elapsedSeconds,
        custom.corePulseSpeed ?? 1.4,
        custom.corePulseMin ?? 0.3,
        custom.corePulseMax ?? 1.0
      )
    : 0.65;

  const numFactor = custom.numberPulseEnabled
    ? evaluateWaveform(
        custom.numberPulseWaveform ?? 'sine',
        elapsedSeconds,
        custom.numberPulseSpeed ?? 1.6,
        custom.numberPulseMin ?? 0.4,
        custom.numberPulseMax ?? 1.0
      )
    : coreFactor;

  if (materials[0] && custom.corePulseEnabled) {
    materials[0].emissiveColor = coreGlow.scale(0.22 * coreFactor);
  }

  const blendedColor = Color3.Lerp(coreGlow, numGlow, 0.55);
  const pulseLevel = Math.max(0.1, (coreFactor * 0.45 + numFactor * 0.55) * Math.max(0.35, custom.glowIntensity));

  for (let i = 1; i < materials.length; i++) {
    materials[i].emissiveColor = blendedColor.scale(pulseLevel);
  }
}

export function disposeDieMaterials(instance: BuiltBabylonDieInstance): void {
  for (const mat of instance.faceMaterials) {
    mat.diffuseTexture?.dispose();
    mat.bumpTexture?.dispose();
    mat.emissiveTexture?.dispose();
    mat.dispose();
  }
  instance.multiMaterial.dispose();
}

async function attachOptionalGlbChildMesh(
  parentMesh: Mesh,
  type: DicePolyhedronType,
  model: DiceModelDefinition,
  scene: Scene
): Promise<void> {
  try {
    const result = await SceneLoader.ImportMeshAsync(
      type,
      model.glbAssetDirectory!,
      model.glbFileName!,
      scene
    );
    for (const imported of result.meshes) {
      if (imported !== result.meshes[0]) {
        imported.parent = parentMesh;
      }
    }
  } catch {
    // Fallback gracefully to the procedural chamfered mesh
  }
}
