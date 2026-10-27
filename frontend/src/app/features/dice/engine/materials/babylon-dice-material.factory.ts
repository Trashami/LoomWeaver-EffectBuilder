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
  const borderColor3 = hexToColor3(skin.borderColor || custom.glowColorHex || skin.accentColor);

  // Specular highlights driven by reflection/metallic & surface roughness
  const specIntensity = 0.18 + metallic * 0.82;
  const specularColor = Color3.Lerp(new Color3(specIntensity, specIntensity, specIntensity), borderColor3, metallic * 0.55);
  const specularPower = Math.round(12 + (1 - roughness) * 116);

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
  if (custom.glowIntensity > 0.25) {
    bevelMat.emissiveColor = glowColor3.scale(custom.glowIntensity * 0.14);
  }
  if (skin.surfaceStyle === 'glass' && skin.refractionAlpha) {
    bevelMat.alpha = Math.min(0.92, skin.refractionAlpha + 0.1);
  }
  materials.push(bevelMat);

  // Slots 1..N: Numbered polyhedral faces
  const faceVals = FACE_VALUES[type];
  const texSize = type === 'd20' || type === 'd12' ? 256 : 384;

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
      custom.recessedNumbers ? 3.1 : 2.5
    );
    faceMat.bumpTexture.level = Math.max(0.35, (skin.bumpScale || 0.025) * 28);

    if (custom.glowIntensity > 0.05) {
      faceMat.emissiveTexture = createBabylonDynamicTextureFromCanvas(
        `lw-face-emis-${type}-${i + 1}`,
        canvases.emissiveCanvas,
        scene
      );
      faceMat.emissiveColor = glowColor3.scale(0.55 + custom.glowIntensity * 0.65);
    } else {
      faceMat.emissiveColor = Color3.Black();
    }

    faceMat.specularColor = specularColor;
    faceMat.specularPower = specularPower;

    if (skin.surfaceStyle === 'glass') {
      faceMat.alpha = skin.refractionAlpha ?? 0.76;
      const fresnel = new FresnelParameters();
      fresnel.bias = 0.15;
      fresnel.power = 2.4;
      fresnel.leftColor = glowColor3;
      fresnel.rightColor = Color3.Black();
      faceMat.emissiveFresnelParameters = fresnel;
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
  const sizeMultiplier = (DICE_SIZE_SCALE_MAP[custom.sizePreset] ?? 1.0) * (model.scaleMultiplier ?? 1.0);
  const builtGeometry = buildBabylonDieVertexData(
    type,
    1.15 * sizeMultiplier,
    model.chamferFactor
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

export function makeShiftedDieMaterials(
  baseMaterials: StandardMaterial[],
  type: DicePolyhedronType,
  shift: number
): StandardMaterial[] {
  if (type === 'd4' || shift === 0) {
    return baseMaterials.slice();
  }
  const N = FACE_VALUES[type].length;
  const normalizedShift = ((shift % N) + N) % N;
  const shifted: StandardMaterial[] = [baseMaterials[0]];
  for (let s = 1; s <= N; s++) {
    const srcIdx = ((s - 1 + normalizedShift) % N) + 1;
    shifted.push(baseMaterials[srcIdx]);
  }
  return shifted;
}

export function applyVeinPulseToDieMaterials(
  materials: StandardMaterial[],
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  elapsedSeconds: number
): void {
  if (!custom.veinPulse || custom.glowIntensity <= 0.05) {
    return;
  }
  const glowColor3 = hexToColor3(custom.glowColorHex || skin.emissiveColor);
  const primary = Math.max(0, Math.sin(elapsedSeconds * 3.1));
  const secondary = Math.max(0, Math.sin(elapsedSeconds * 3.1 - 0.55)) * 0.45;
  const heartbeat = 0.42 + (primary + secondary) * 0.52 * custom.glowIntensity;

  for (let i = 1; i < materials.length; i++) {
    materials[i].emissiveColor = glowColor3.scale(heartbeat);
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
    // Fallback gracefully to the procedural chamfered mesh when custom .glb is not yet uploaded
  }
}
