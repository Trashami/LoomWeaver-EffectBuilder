import { DiceSkinConfig } from './dice-skin.types';

export const OBSIDIAN_SKIN: DiceSkinConfig = {
  id: 'skin-obsidian-gold',
  name: 'Runed Obsidian & Molten Gold',
  tagline: 'Volcanic glass forged in deep magma veins with molten gold fissures and recessed runes',
  description: 'Volcanic glass forged in deep magma veins with molten gold fissures and recessed runes.',
  materialFamily: 'Volcanic Glass & Gold',
  tier: 'Free',
  rarity: 'Rare',
  unlockSource: 'free',
  priceLabel: 'Free',
  isDefaultUnlocked: true,
  defaultModelId: 'model-classic-chamfer',
  defaultSoundProfileId: 'sfx-stone-rattle',
  defaultNat20EffectId: 'fx-solar-supernova',
  defaultCritFailEffectId: 'fx-basalt-shatter',
  baseColor: '#17151c',
  accentColor: '#e5b85c',
  emissiveColor: '#ff8c3b',
  borderColor: '#e5b85c',
  surfaceStyle: 'obsidian',
  roughness: 0.22,
  metalness: 0.82,
  clearcoat: 0.85,
  clearcoatRoughness: 0.12,
  textStyle: 'recessed',
  textColor: '#e5b85c',
  textStrokeColor: '#0c0a0e',
  textStrokeWidth: 3,
  textEmissive: true,
  emissiveIntensity: 0.95,
  fontFamily: 'Cinzel, Georgia, serif',
  bumpScale: 0.036,
  hasVeinPulse: true,
  particleColor: '#e5b85c'
};

export const obsidianSkin = OBSIDIAN_SKIN;
