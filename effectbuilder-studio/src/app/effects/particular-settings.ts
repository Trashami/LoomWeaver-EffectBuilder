import { FxPoint, seeded } from './fireball-motion';

/**
 * Adobe After Effects Trapcode Particular-inspired 3D Sprite & Particle Physics System.
 * Provides full Emitter, Particle/Sprite, Physics (Gravity/Buoyancy/Air Resistance/Turbulence Field/Spin/Bounce),
 * and Aux Trail Sub-Particle controls for spell layers.
 */
export type ParticularSpriteType =
  | 'flame_tongues'
  | 'smoke_plume'
  | 'ember_sparks'
  | 'plasma_orb'
  | 'star_flare'
  | 'crystal_shard'
  | 'shock_ring'
  | 'arc_filament'
  | 'molten_slag';

export type ParticularEmitterType =
  | 'point'
  | 'sphere'
  | 'box'
  | 'ring'
  | 'disc'
  | 'directional';

export type ParticularSizeCurve =
  | 'grow_fade'
  | 'fade_out'
  | 'pulse'
  | 'expand'
  | 'sharp_pop';

export type ParticularOpacityCurve =
  | 'bell'
  | 'fade_out'
  | 'flash_decay'
  | 'sustain'
  | 'flicker';

export type ParticularColorGradient =
  | 'fire_gradient'
  | 'core_to_main'
  | 'smoke_cooling'
  | 'cool_to_hot'
  | 'main_only';

export interface ParticularSettings {
  enabled: boolean;
  // Emitter
  emitterType: ParticularEmitterType;
  emitterSizeX: number; // 0..120 design px
  emitterSizeY: number; // 0..120 design px
  emitterSizeZ: number; // 0..120 vertical 3D height px
  velocity: number; // 0..250 speed
  velocityRandom: number; // 0..100 %
  directionSpread: number; // 0..180 deg cone
  // Particle / Sprite
  spriteType: ParticularSpriteType;
  particleSize: number; // 1..80 px
  sizeRandom: number; // 0..100 %
  sizeOverLife: ParticularSizeCurve;
  opacityOverLife: ParticularOpacityCurve;
  colorOverLife: ParticularColorGradient;
  spriteRotationSpeed: number; // -8..8 rad/s
  orientToMotion: boolean;
  motionStretch: number; // 1..6 velocity stretch
  // Physics & Turbulence Field
  gravity: number; // -150 (buoyant thermal lift) .. +150 (heavy fall)
  airResistance: number; // 0..4 exponential drag
  windY: number; // -100..100 vertical updraft/downdraft
  turbulencePosition: number; // 0..120 curl-noise field displacement
  turbulenceScale: number; // 0.2..4 spatial frequency
  turbulenceEvolution: number; // 0..5 animated evolution speed
  spinAmplitude: number; // -6..6 vortex swirl around vertical axis
  floorBounce: number; // 0..0.95 restitution bounce on ground (height <= 2)
  // Aux System (Sub-Particles emitted behind primary particles)
  auxEmitRate: number; // 0..3 sub-particles per primary particle
  auxSpriteType: ParticularSpriteType;
  auxSizeScale: number; // 0.15..1.2
}

export const PARTICULAR_SPRITE_TYPES: readonly {
  id: ParticularSpriteType;
  name: string;
  tile: number;
}[] = [
  { id: 'flame_tongues', name: 'Flame Tongues (Animated)', tile: 4 },
  { id: 'smoke_plume', name: 'Volumetric Lit Smoke Plume', tile: 0 },
  { id: 'ember_sparks', name: 'Ballistic Ember Sparks', tile: 2 },
  { id: 'plasma_orb', name: 'Hot Plasma Core Orb', tile: 1 },
  { id: 'star_flare', name: 'Celestial Star Flare', tile: 6 },
  { id: 'crystal_shard', name: 'Faceted Crystal / Ice Shard', tile: 5 },
  { id: 'shock_ring', name: 'Expanding Shock Ring', tile: 3 },
  { id: 'arc_filament', name: 'Crackling Electric Filament', tile: 7 },
  { id: 'molten_slag', name: 'Molten Magma Slag Glob', tile: 8 },
];

export const PARTICULAR_EMITTER_TYPES: readonly {
  id: ParticularEmitterType;
  name: string;
}[] = [
  { id: 'sphere', name: '3D Sphere Volume' },
  { id: 'point', name: 'Point Detonation' },
  { id: 'ring', name: '3D Shockwave Ring' },
  { id: 'disc', name: 'Ground Disc / Crater' },
  { id: 'box', name: '3D Box Volume' },
  { id: 'directional', name: 'Directional Cone Jet' },
];

export const PARTICULAR_SIZE_CURVES: readonly {
  id: ParticularSizeCurve;
  name: string;
}[] = [
  { id: 'grow_fade', name: 'Grow Then Dissolve' },
  { id: 'sharp_pop', name: 'Explosive Pop & Taper' },
  { id: 'expand', name: 'Continuous Plume Expansion' },
  { id: 'fade_out', name: 'Shrink Over Life' },
  { id: 'pulse', name: 'Harmonic Pulse' },
];

export const PARTICULAR_OPACITY_CURVES: readonly {
  id: ParticularOpacityCurve;
  name: string;
}[] = [
  { id: 'flash_decay', name: 'Explosive Flash & Decay' },
  { id: 'bell', name: 'Smooth Bell Curve' },
  { id: 'fade_out', name: 'Linear Fade Out' },
  { id: 'sustain', name: 'Long Sustain & Drop' },
  { id: 'flicker', name: 'Cinder Flicker' },
];

export const PARTICULAR_COLOR_GRADIENTS: readonly {
  id: ParticularColorGradient;
  name: string;
}[] = [
  { id: 'fire_gradient', name: 'White-Hot -> Flame -> Charcoal' },
  { id: 'core_to_main', name: 'Core Color -> Main Color' },
  { id: 'smoke_cooling', name: 'Incandescent -> Dark Ash Smoke' },
  { id: 'cool_to_hot', name: 'Main Color -> Bright Core' },
  { id: 'main_only', name: 'Uniform Layer Color' },
];

export const PARTICULAR_DEFAULTS: ParticularSettings = {
  enabled: true,
  emitterType: 'sphere',
  emitterSizeX: 28,
  emitterSizeY: 28,
  emitterSizeZ: 24,
  velocity: 92,
  velocityRandom: 45,
  directionSpread: 180,
  spriteType: 'flame_tongues',
  particleSize: 18,
  sizeRandom: 42,
  sizeOverLife: 'grow_fade',
  opacityOverLife: 'flash_decay',
  colorOverLife: 'fire_gradient',
  spriteRotationSpeed: 2.2,
  orientToMotion: true,
  motionStretch: 1.65,
  gravity: -38,
  airResistance: 1.35,
  windY: 28,
  turbulencePosition: 34,
  turbulenceScale: 1.4,
  turbulenceEvolution: 2.1,
  spinAmplitude: 1.2,
  floorBounce: 0.35,
  auxEmitRate: 1,
  auxSpriteType: 'ember_sparks',
  auxSizeScale: 0.32,
};

export type NumericParticularKey = {
  [K in keyof ParticularSettings]: ParticularSettings[K] extends number ? K : never;
}[keyof ParticularSettings];

export const PARTICULAR_EMITTER_CONTROLS: readonly {
  key: NumericParticularKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'emitterSizeX', label: 'Emitter Size X', min: 0, max: 140, step: 1 },
  { key: 'emitterSizeY', label: 'Emitter Size Y', min: 0, max: 140, step: 1 },
  { key: 'emitterSizeZ', label: 'Emitter Height Z (3D)', min: 0, max: 140, step: 1 },
  { key: 'velocity', label: 'Emission Velocity', min: 0, max: 260, step: 2 },
  { key: 'velocityRandom', label: 'Velocity Random (%)', min: 0, max: 100, step: 1 },
  { key: 'directionSpread', label: '3D Cone Spread (deg)', min: 5, max: 180, step: 5 },
];

export const PARTICULAR_PARTICLE_CONTROLS: readonly {
  key: NumericParticularKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'particleSize', label: 'Sprite Base Size', min: 1, max: 85, step: 0.5 },
  { key: 'sizeRandom', label: 'Size Random (%)', min: 0, max: 100, step: 1 },
  { key: 'spriteRotationSpeed', label: 'Sprite Spin Speed', min: -8, max: 8, step: 0.1 },
  { key: 'motionStretch', label: '3D Velocity Stretch', min: 1, max: 6, step: 0.05 },
];

export const PARTICULAR_PHYSICS_CONTROLS: readonly {
  key: NumericParticularKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'gravity', label: 'Gravity (-Buoyancy / +Fall)', min: -160, max: 160, step: 2 },
  { key: 'airResistance', label: 'Air Resistance Drag', min: 0, max: 4, step: 0.05 },
  { key: 'windY', label: 'Thermal Updraft Z', min: -120, max: 120, step: 2 },
  { key: 'turbulencePosition', label: 'Turbulence Field Displace', min: 0, max: 120, step: 1 },
  { key: 'turbulenceScale', label: 'Turbulence Frequency', min: 0.2, max: 4, step: 0.1 },
  { key: 'turbulenceEvolution', label: 'Turbulence Evolution', min: 0, max: 5, step: 0.1 },
  { key: 'spinAmplitude', label: '3D Vortex Swirl', min: -6, max: 6, step: 0.1 },
  { key: 'floorBounce', label: 'Ground Bounce', min: 0, max: 0.95, step: 0.05 },
];

export const PARTICULAR_AUX_CONTROLS: readonly {
  key: NumericParticularKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'auxEmitRate', label: 'Aux Trail Sub-Particles', min: 0, max: 3, step: 1 },
  { key: 'auxSizeScale', label: 'Aux Particle Scale', min: 0.1, max: 1.2, step: 0.05 },
];

export function spriteTypeToTile(sprite: ParticularSpriteType): number {
  return PARTICULAR_SPRITE_TYPES.find((s) => s.id === sprite)?.tile ?? 4;
}

export function defaultParticularForLayer(
  kind: string,
  variant: string,
  color = '#ff651c'
): ParticularSettings {
  const isFire =
    variant === 'fire' ||
    variant === 'flame' ||
    variant === 'embers' ||
    variant === 'meteor' ||
    color.toLowerCase().startsWith('#ff') ||
    color.toLowerCase().startsWith('#f');
  const isIce = variant === 'frost' || variant === 'ice' || variant === 'shards' || variant === 'blizzard';
  const isStorm = kind === 'lightning' || kind === 'sky_lightning' || variant === 'storm' || variant === 'arc';
  const isSmoke = kind === 'cloud' || variant === 'mist' || variant === 'fog' || variant === 'smoke';

  if (kind === 'burst' && isFire) {
    return {
      ...PARTICULAR_DEFAULTS,
      emitterType: 'sphere',
      emitterSizeX: 34,
      emitterSizeY: 34,
      emitterSizeZ: 28,
      velocity: 118,
      velocityRandom: 52,
      directionSpread: 180,
      spriteType: 'flame_tongues',
      particleSize: 22,
      sizeRandom: 46,
      sizeOverLife: 'sharp_pop',
      opacityOverLife: 'flash_decay',
      colorOverLife: 'fire_gradient',
      spriteRotationSpeed: 2.6,
      orientToMotion: true,
      motionStretch: 1.75,
      gravity: -44,
      airResistance: 1.55,
      windY: 36,
      turbulencePosition: 42,
      turbulenceScale: 1.5,
      turbulenceEvolution: 2.4,
      spinAmplitude: 1.45,
      floorBounce: 0.42,
      auxEmitRate: 2,
      auxSpriteType: 'ember_sparks',
      auxSizeScale: 0.28,
    };
  }
  if (kind === 'aura' && isFire) {
    return {
      ...PARTICULAR_DEFAULTS,
      emitterType: 'ring',
      emitterSizeX: 38,
      emitterSizeY: 38,
      emitterSizeZ: 14,
      velocity: 54,
      velocityRandom: 38,
      directionSpread: 75,
      spriteType: 'flame_tongues',
      particleSize: 16,
      sizeRandom: 40,
      sizeOverLife: 'grow_fade',
      opacityOverLife: 'bell',
      colorOverLife: 'fire_gradient',
      spriteRotationSpeed: 2.1,
      orientToMotion: true,
      motionStretch: 1.55,
      gravity: -58,
      airResistance: 0.9,
      windY: 45,
      turbulencePosition: 28,
      turbulenceScale: 1.6,
      turbulenceEvolution: 2.2,
      spinAmplitude: 2.6,
      floorBounce: 0,
      auxEmitRate: 1,
      auxSpriteType: 'ember_sparks',
      auxSizeScale: 0.25,
    };
  }
  if (isIce) {
    return {
      ...PARTICULAR_DEFAULTS,
      emitterType: 'sphere',
      spriteType: 'crystal_shard',
      particleSize: 14,
      sizeOverLife: 'sharp_pop',
      opacityOverLife: 'flash_decay',
      colorOverLife: 'core_to_main',
      gravity: 48,
      windY: -12,
      floorBounce: 0.55,
      auxEmitRate: 1,
      auxSpriteType: 'star_flare',
      auxSizeScale: 0.35,
    };
  }
  if (isStorm) {
    return {
      ...PARTICULAR_DEFAULTS,
      emitterType: 'point',
      spriteType: 'arc_filament',
      particleSize: 15,
      velocity: 135,
      sizeOverLife: 'sharp_pop',
      opacityOverLife: 'flicker',
      colorOverLife: 'core_to_main',
      motionStretch: 2.4,
      gravity: 15,
      windY: 0,
      turbulencePosition: 48,
      auxEmitRate: 1,
      auxSpriteType: 'ember_sparks',
    };
  }
  if (isSmoke) {
    return {
      ...PARTICULAR_DEFAULTS,
      emitterType: 'disc',
      emitterSizeX: 52,
      emitterSizeY: 52,
      emitterSizeZ: 22,
      velocity: 32,
      spriteType: 'smoke_plume',
      particleSize: 28,
      sizeOverLife: 'expand',
      opacityOverLife: 'bell',
      colorOverLife: 'smoke_cooling',
      orientToMotion: false,
      motionStretch: 1.1,
      gravity: -22,
      windY: 20,
      auxEmitRate: 0,
    };
  }
  return {
    ...PARTICULAR_DEFAULTS,
    spriteType: isFire ? 'flame_tongues' : 'plasma_orb',
    colorOverLife: isFire ? 'fire_gradient' : 'core_to_main',
  };
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}

export function parseParticular(
  raw: unknown,
  kind = 'burst',
  variant = 'fire',
  color = '#ff651c'
): ParticularSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const d = defaultParticularForLayer(kind, variant, color);
  const spriteType = PARTICULAR_SPRITE_TYPES.some((s) => s.id === r['spriteType'])
    ? (r['spriteType'] as ParticularSpriteType)
    : d.spriteType;
  const auxSpriteType = PARTICULAR_SPRITE_TYPES.some((s) => s.id === r['auxSpriteType'])
    ? (r['auxSpriteType'] as ParticularSpriteType)
    : d.auxSpriteType;
  const emitterType = PARTICULAR_EMITTER_TYPES.some((e) => e.id === r['emitterType'])
    ? (r['emitterType'] as ParticularEmitterType)
    : d.emitterType;
  const sizeOverLife = PARTICULAR_SIZE_CURVES.some((c) => c.id === r['sizeOverLife'])
    ? (r['sizeOverLife'] as ParticularSizeCurve)
    : d.sizeOverLife;
  const opacityOverLife = PARTICULAR_OPACITY_CURVES.some((c) => c.id === r['opacityOverLife'])
    ? (r['opacityOverLife'] as ParticularOpacityCurve)
    : d.opacityOverLife;
  const colorOverLife = PARTICULAR_COLOR_GRADIENTS.some((c) => c.id === r['colorOverLife'])
    ? (r['colorOverLife'] as ParticularColorGradient)
    : d.colorOverLife;

  const out: ParticularSettings = {
    ...d,
    enabled: r['enabled'] !== false,
    emitterType,
    spriteType,
    auxSpriteType,
    sizeOverLife,
    opacityOverLife,
    colorOverLife,
    orientToMotion: typeof r['orientToMotion'] === 'boolean' ? r['orientToMotion'] : d.orientToMotion,
  };
  for (const c of [
    ...PARTICULAR_EMITTER_CONTROLS,
    ...PARTICULAR_PARTICLE_CONTROLS,
    ...PARTICULAR_PHYSICS_CONTROLS,
    ...PARTICULAR_AUX_CONTROLS,
  ]) {
    out[c.key] = clampNum(r[c.key], c.min, c.max, d[c.key]);
  }
  out.auxEmitRate = Math.round(out.auxEmitRate);
  return out;
}

export interface EvaluatedParticularSprite {
  x: number;
  y: number;
  height: number;
  size: number;
  alpha: number;
  tile: number;
  rotation: number;
  stretch: number;
  color: string;
  dirX: number;
  dirY: number;
  dirZ: number;
}

function evalSizeCurve(curve: ParticularSizeCurve, age: number): number {
  switch (curve) {
    case 'grow_fade':
      return Math.sin(Math.pow(age, 0.58) * Math.PI) * 1.18 + 0.12;
    case 'sharp_pop':
      return age < 0.14
        ? (age / 0.14) * 1.35
        : Math.max(0.08, 1.35 * Math.pow(1 - (age - 0.14) / 0.86, 0.72));
    case 'expand':
      return 0.35 + age * 1.55;
    case 'fade_out':
      return Math.max(0.08, 1.15 * (1 - age * 0.88));
    case 'pulse':
      return (0.65 + 0.35 * Math.sin(age * Math.PI * 3)) * (1 - age * 0.45);
  }
}

function evalOpacityCurve(curve: ParticularOpacityCurve, age: number, seed: number): number {
  switch (curve) {
    case 'flash_decay':
      return Math.min(1, age * 10) * Math.pow(Math.max(0, 1 - age), 1.45);
    case 'bell':
      return Math.sin(age * Math.PI);
    case 'fade_out':
      return Math.max(0, 1 - age);
    case 'sustain':
      return age < 0.75 ? Math.min(1, age * 7) : Math.max(0, (1 - age) / 0.25);
    case 'flicker': {
      const f = 0.58 + 0.42 * Math.sin(age * 38 + seed * 19);
      return Math.min(1, age * 8) * Math.pow(Math.max(0, 1 - age), 1.1) * f;
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 6 ? clean : 'ff651c', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(r1 + (r2 - r1) * u, g1 + (g2 - g1) * u, b1 + (b2 - b1) * u);
}

function evalColorGradient(
  grad: ParticularColorGradient,
  age: number,
  mainColor: string,
  coreColor: string
): string {
  switch (grad) {
    case 'fire_gradient':
      if (age < 0.22) return lerpColor('#fff9de', coreColor, age / 0.22);
      if (age < 0.68) return lerpColor(coreColor, mainColor, (age - 0.22) / 0.46);
      return lerpColor(mainColor, '#3b2522', (age - 0.68) / 0.32);
    case 'core_to_main':
      return lerpColor(coreColor, mainColor, Math.pow(age, 0.75));
    case 'smoke_cooling':
      if (age < 0.28) return lerpColor(coreColor, mainColor, age / 0.28);
      return lerpColor(mainColor, '#2e272b', (age - 0.28) / 0.72);
    case 'cool_to_hot':
      return lerpColor(mainColor, coreColor, age);
    case 'main_only':
      return mainColor;
  }
}

/**
 * Evaluates a 3D Trapcode Particular particle field + Aux sub-particle trails in design space
 * (with true 3D height and 3D world velocity vectors for perspective camera alignment).
 */
export function evaluateParticularSprites(
  settings: ParticularSettings,
  origin: FxPoint,
  baseHeight: number,
  progress: number,
  clock: number,
  count: number,
  scale: number,
  seedBase: number,
  mainColor: string,
  coreColor: string,
  headingAngle = 0
): EvaluatedParticularSprite[] {
  if (!settings.enabled) return [];
  const out: EvaluatedParticularSprite[] = [];
  const TAU = Math.PI * 2;
  const total = Math.max(6, Math.min(140, count));
  const mainTile = spriteTypeToTile(settings.spriteType);
  const auxTile = spriteTypeToTile(settings.auxSpriteType);
  const isBurstPhase = progress <= 1;

  for (let i = 0; i < total; i++) {
    const s1 = seeded(i * 13 + 7, seedBase);
    const s2 = seeded(i * 29 + 31, seedBase);
    const s3 = seeded(i * 53 + 79, seedBase);
    const s4 = seeded(i * 97 + 131, seedBase);

    // Stagger birth so explosive bursts have an immediate wave + rolling secondary waves
    const birthWindow = 0.38;
    const birth = s1 * birthWindow;
    const rawAge = isBurstPhase
      ? (progress - birth) / Math.max(0.22, 1 - birth * 0.65)
      : (clock * 0.85 + s1) % 1;
    if (rawAge <= 0.001 || rawAge >= 0.999) continue;
    const age = Math.max(0.001, Math.min(0.999, rawAge));

    // 1. 3D Emitter Spawn Offset (X, Y on ground plane, Z vertical height)
    const theta = s2 * TAU;
    const phi = (s3 - 0.5) * Math.PI;
    let emitX = 0;
    let emitY = 0;
    let emitZ = 0;
    const rx = settings.emitterSizeX * scale;
    const ry = settings.emitterSizeY * scale;
    const rz = settings.emitterSizeZ * scale;

    switch (settings.emitterType) {
      case 'sphere': {
        const rad = Math.pow(s4, 0.35);
        emitX = Math.cos(theta) * Math.cos(phi) * rx * rad;
        emitY = Math.sin(theta) * Math.cos(phi) * ry * rad;
        emitZ = Math.sin(phi) * rz * rad;
        break;
      }
      case 'box':
        emitX = (s2 - 0.5) * 2 * rx;
        emitY = (s3 - 0.5) * 2 * ry;
        emitZ = (s4 - 0.5) * 2 * rz;
        break;
      case 'ring':
        emitX = Math.cos(theta) * rx * (0.82 + 0.25 * s4);
        emitY = Math.sin(theta) * ry * (0.82 + 0.25 * s4);
        emitZ = (s3 - 0.5) * rz * 0.4;
        break;
      case 'disc': {
        const r = Math.sqrt(s4);
        emitX = Math.cos(theta) * rx * r;
        emitY = Math.sin(theta) * ry * r;
        emitZ = (s3 - 0.5) * rz * 0.25;
        break;
      }
      case 'directional':
      case 'point':
      default:
        emitX = Math.cos(theta) * rx * 0.18 * s4;
        emitY = Math.sin(theta) * ry * 0.18 * s4;
        emitZ = (s3 - 0.5) * rz * 0.18;
        break;
    }

    // 2. 3D Initial Velocity Vector
    const spreadRad = (settings.directionSpread * Math.PI) / 180;
    const yaw =
      settings.emitterType === 'directional'
        ? headingAngle + (s2 - 0.5) * spreadRad
        : theta;
    const elev =
      settings.emitterType === 'ring'
        ? (s3 - 0.35) * 0.45
        : settings.emitterType === 'disc'
          ? 0.35 + s3 * 0.95
          : ((s3 - 0.22) * spreadRad) * 0.65;

    const velRand = 1 + (s4 - 0.5) * 2 * (settings.velocityRandom / 100);
    const speed = settings.velocity * Math.max(0.15, velRand) * scale;

    const vx0 = Math.cos(yaw) * Math.cos(elev) * speed;
    const vy0 = Math.sin(yaw) * Math.cos(elev) * speed;
    const vz0 = Math.sin(elev) * speed * 0.95;

    // 3. Analytical Drag Integration + Gravity/Buoyancy + 3D Turbulence Field + Vortex Spin
    const drag = Math.max(0.05, settings.airResistance);
    const dragDist = (1 - Math.exp(-drag * age * 2.2)) / drag;
    const instDrag = Math.exp(-drag * age * 2.2);

    // 3D Curl-like Turbulence Field
    const freq = settings.turbulenceScale;
    const evo = clock * settings.turbulenceEvolution;
    const turbPhase1 = i * 1.71 + age * 4.2 * freq + evo;
    const turbPhase2 = i * 2.93 - age * 3.7 * freq + evo * 0.85;
    const turbAmp = settings.turbulencePosition * scale * Math.pow(age, 0.75);
    const turbX = Math.cos(turbPhase1) * Math.sin(turbPhase2) * turbAmp;
    const turbY = Math.sin(turbPhase1) * Math.cos(turbPhase2 * 0.9) * turbAmp;
    const turbZ = Math.sin(turbPhase1 + turbPhase2) * turbAmp * 0.75;

    // Vertical Thermal Lift / Gravity
    const verticalAccel = (-settings.gravity + settings.windY) * scale;
    const zLift = 0.5 * verticalAccel * age * age * 1.45;

    // Raw position before vortex spin
    let dx = emitX + vx0 * dragDist + turbX;
    let dy = emitY + vy0 * dragDist + turbY;
    let dz = emitZ + vz0 * dragDist + zLift + turbZ;

    // Apply 3D Vortex Spin around emitter vertical axis
    if (Math.abs(settings.spinAmplitude) > 0.01) {
      const spinAngle = settings.spinAmplitude * age * 2.4;
      const cs = Math.cos(spinAngle);
      const sn = Math.sin(spinAngle);
      const rxSpin = dx * cs - dy * sn;
      const rySpin = dx * sn + dy * cs;
      dx = rxSpin;
      dy = rySpin;
    }

    // Instantaneous 3D velocity vector (for 3D perspective velocity-aligned billboard stretching)
    let ivx = vx0 * instDrag - Math.sin(turbPhase1) * turbAmp * 1.5 - dy * settings.spinAmplitude;
    let ivy = vy0 * instDrag + Math.cos(turbPhase1) * turbAmp * 1.5 + dx * settings.spinAmplitude;
    let ivz = vz0 * instDrag + verticalAccel * age * 1.45 + Math.cos(turbPhase2) * turbAmp;

    // 4. Floor Bounce Physics
    let worldH = baseHeight + dz;
    const floorH = 2.5 * scale;
    if (worldH < floorH) {
      if (settings.floorBounce > 0.02) {
        const penetration = floorH - worldH;
        worldH = floorH + Math.abs(Math.sin(penetration * 0.12)) * penetration * settings.floorBounce;
        ivz = Math.abs(ivz) * settings.floorBounce;
      } else {
        worldH = floorH;
        ivz = Math.max(0, ivz);
      }
    }

    // 5. Size, Opacity, and Color Over Life Curves
    const sizeVar = 1 + (s2 - 0.5) * 2 * (settings.sizeRandom / 100);
    const sizeCurve = evalSizeCurve(settings.sizeOverLife, age);
    const finalSize = Math.max(0.8 * scale, settings.particleSize * scale * Math.max(0.2, sizeVar) * sizeCurve);
    const finalAlpha = Math.max(0, Math.min(1, evalOpacityCurve(settings.opacityOverLife, age, s3)));
    const finalColor = evalColorGradient(settings.colorOverLife, age, mainColor, coreColor);

    const rot =
      s1 * TAU +
      clock * settings.spriteRotationSpeed * (i % 2 === 0 ? 1 : -1) +
      age * settings.spriteRotationSpeed * 2.2;
    const stretch = settings.orientToMotion ? settings.motionStretch : 1;

    out.push({
      x: origin.x + dx,
      y: origin.y + dy,
      height: worldH,
      size: finalSize,
      alpha: finalAlpha,
      tile: mainTile,
      rotation: rot,
      stretch,
      color: finalColor,
      dirX: ivx,
      dirY: ivz, // 3D Y is vertical height
      dirZ: ivy, // 3D Z is ground Y
    });

    // 6. Aux System: Trailing sub-particles emitted along the primary particle's 3D path
    if (settings.auxEmitRate > 0 && age > 0.06 && age < 0.88) {
      for (let aIdx = 1; aIdx <= settings.auxEmitRate; aIdx++) {
        const lag = aIdx * 0.055;
        const auxAge = Math.max(0.01, age - lag);
        const auxDragDist = (1 - Math.exp(-drag * auxAge * 2.2)) / drag;
        const adx = emitX + vx0 * auxDragDist + turbX * 0.78;
        const ady = emitY + vy0 * auxDragDist + turbY * 0.78;
        const adz = Math.max(
          floorH,
          baseHeight + emitZ + vz0 * auxDragDist + 0.5 * verticalAccel * auxAge * auxAge * 1.2
        );
        out.push({
          x: origin.x + adx,
          y: origin.y + ady,
          height: adz,
          size: Math.max(0.7 * scale, finalSize * settings.auxSizeScale * (1 - aIdx * 0.18)),
          alpha: finalAlpha * (0.78 - aIdx * 0.18),
          tile: auxTile,
          rotation: rot + aIdx * 0.9,
          stretch: Math.max(1.2, stretch * 1.25),
          color: aIdx === 1 ? coreColor : finalColor,
          dirX: ivx,
          dirY: ivz,
          dirZ: ivy,
        });
      }
    }
  }

  return out;
}
