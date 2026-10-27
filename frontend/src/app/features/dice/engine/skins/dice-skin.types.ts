import { DiceSizePreset } from '../models/dice-model.types';

export type DiceTextureStyle =
  | 'stone'
  | 'wood'
  | 'obsidian'
  | 'void'
  | 'metal'
  | 'glass'
  | 'plastic'
  | 'resin';

export type DiceSkinSurfaceStyle = DiceTextureStyle;

export type DiceOverlayType = 'none' | 'celtic-cage' | 'arcane-runes' | 'recessed-plate';

export type DiceUnlockSource = 'free' | 'purchase' | 'reward' | 'loommarks' | 'tier';

export interface DiceMaterialOptions {
  readonly metalness: number;
  readonly roughness: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness: number;
  readonly bumpScale: number;
  readonly emissive: string;
  readonly emissiveIntensity: number;
  readonly envMapIntensity?: number;
  readonly transmission?: number;
  readonly ior?: number;
  readonly thickness?: number;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly textureStyle: DiceTextureStyle;
  readonly accentColor?: string;
  readonly overlayType: DiceOverlayType;
  readonly numberEngraving: 'recessed' | 'raised' | 'flush';
  readonly veinPulse: boolean;
}

export interface DiceSkinConfig {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description?: string;
  readonly materialFamily: string;
  readonly tier: string;
  readonly rarity: string;
  readonly unlockSource: DiceUnlockSource;
  readonly priceLabel: string;
  readonly loommarksCost?: number;
  readonly priceUsdCents?: number;
  readonly rewardMilestoneId?: string;
  readonly rewardRequirementText?: string;
  readonly isDefaultUnlocked: boolean;
  readonly defaultModelId: string;
  readonly defaultSoundProfileId: string;
  readonly defaultNat20EffectId: string;
  readonly defaultCritFailEffectId: string;
  readonly baseColor: string;
  readonly accentColor: string;
  readonly emissiveColor: string;
  readonly borderColor: string;
  readonly surfaceStyle: DiceSkinSurfaceStyle;
  readonly roughness: number;
  readonly metalness: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness: number;
  readonly refractionAlpha?: number;
  readonly indexOfRefraction?: number;
  readonly textStyle: 'recessed' | 'raised' | 'flush';
  readonly textColor: string;
  readonly textStrokeColor: string;
  readonly textStrokeWidth: number;
  readonly textEmissive: boolean;
  readonly emissiveIntensity: number;
  readonly fontFamily: string;
  readonly bumpScale: number;
  readonly hasVeinPulse: boolean;
  readonly hasCelticBorder?: boolean;
  readonly hasArcaneRunes?: boolean;
  readonly particleColor: string;
}

export type DiceSkinDefinition = DiceSkinConfig;

export interface DiceCustomRuntimeConfig {
  readonly skinId: string;
  readonly modelId: string;
  readonly sizePreset: DiceSizePreset;
  readonly diceSize?: DiceSizePreset;
  readonly coreColorHex: string;
  readonly numberColorHex: string;
  readonly glowColorHex: string;
  readonly glowIntensity: number;
  readonly reflectionMetallic: number;
  readonly surfaceRoughness: number;
  readonly clearcoat?: number;
  readonly recessedNumbers: boolean;
  readonly numberEngraving?: 'recessed' | 'raised' | 'flush';
  readonly veinPulse: boolean;
  readonly nat20EffectId: string;
  readonly critFailEffectId: string;
  readonly soundProfileId: string;
}

export function createDefaultRuntimeConfigFromSkin(skin: DiceSkinConfig): DiceCustomRuntimeConfig {
  return {
    skinId: skin.id,
    modelId: skin.defaultModelId || 'model-classic-chamfer',
    sizePreset: 'medium',
    diceSize: 'medium',
    coreColorHex: skin.baseColor,
    numberColorHex: skin.textColor,
    glowColorHex: skin.emissiveColor,
    glowIntensity: skin.emissiveIntensity,
    reflectionMetallic: skin.metalness,
    surfaceRoughness: skin.roughness,
    clearcoat: skin.clearcoat,
    recessedNumbers: skin.textStyle === 'recessed',
    numberEngraving: skin.textStyle,
    veinPulse: skin.hasVeinPulse,
    nat20EffectId: skin.defaultNat20EffectId,
    critFailEffectId: skin.defaultCritFailEffectId,
    soundProfileId: skin.defaultSoundProfileId
  };
}
