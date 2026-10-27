import { DiceModelDefinition } from './dice-model.types';

export const DICE_MODEL_CATALOG: DiceModelDefinition[] = [
  {
    id: 'model-classic-chamfer',
    name: 'Classic Beveled Polyhedra',
    description: 'Balanced tabletop chamfer (0.955 bevel) with gap-free edge quads and corner caps.',
    geometryMode: 'procedural-chamfer',
    chamferFactor: 0.955,
    scaleMultiplier: 1.0,
    edgeSharpnessLabel: 'Balanced Bevel (0.955)',
    unlockSource: 'free',
    priceLabel: 'Free',
    isDefaultUnlocked: true
  },
  {
    id: 'model-sharp-gem',
    name: 'Razor-Edge Guild Cut',
    description: 'Hand-lapped tournament gem cut (0.990 razor chamfer) with crisp planar facets.',
    geometryMode: 'procedural-chamfer',
    chamferFactor: 0.99,
    scaleMultiplier: 1.02,
    edgeSharpnessLabel: 'Razor Facet (0.990)',
    unlockSource: 'free',
    priceLabel: 'Free',
    isDefaultUnlocked: true
  },
  {
    id: 'model-dwarven-heavy',
    name: 'Kildrid Deep-Forged Ingot',
    description: 'Heavy dwarven stone-and-iron cut (0.912 deep bevel) with wide armored edge chamfers.',
    geometryMode: 'procedural-chamfer',
    chamferFactor: 0.912,
    scaleMultiplier: 1.06,
    edgeSharpnessLabel: 'Deep Ingot Bevel (0.912)',
    unlockSource: 'reward',
    priceLabel: 'Milestone Reward',
    rewardMilestoneId: 'milestone-dwarven-delve',
    loommarksCost: 350,
    isDefaultUnlocked: false
  },
  {
    id: 'model-caged-filigree',
    name: 'Cinth Hollow Filigree Cage',
    description: 'Sculpted hollow-core polyhedral frame designed for Celtic knotwork and Artificer brass.',
    geometryMode: 'procedural-chamfer',
    chamferFactor: 0.94,
    scaleMultiplier: 1.04,
    edgeSharpnessLabel: 'Filigree Frame (0.940)',
    unlockSource: 'loommarks',
    priceLabel: '450 Loommarks',
    loommarksCost: 450,
    priceUsdCents: 299,
    isDefaultUnlocked: false
  },
  {
    id: 'model-custom-glb',
    name: 'Artificer Custom .GLB Mesh',
    description: 'Hybrid .GLB 3D mesh loader slot supporting custom 3D models with automatic polyhedral fallback.',
    geometryMode: 'glb-mesh',
    chamferFactor: 0.97,
    scaleMultiplier: 1.04,
    edgeSharpnessLabel: '3D .GLB Mesh Slot',
    glbAssetDirectory: '/assets/dice/',
    glbFileName: 'custom-dice.glb',
    unlockSource: 'free',
    priceLabel: 'Included',
    isDefaultUnlocked: true
  }
];

export function resolveDiceModel(modelId?: string | null): DiceModelDefinition {
  if (!modelId) return DICE_MODEL_CATALOG[0];
  return DICE_MODEL_CATALOG.find(m => m.id === modelId) ?? DICE_MODEL_CATALOG[0];
}

export function registerDiceModel(model: DiceModelDefinition): void {
  const idx = DICE_MODEL_CATALOG.findIndex(m => m.id === model.id);
  if (idx >= 0) {
    DICE_MODEL_CATALOG[idx] = model;
  } else {
    DICE_MODEL_CATALOG.push(model);
  }
}
