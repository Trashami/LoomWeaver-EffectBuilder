import {
  PROJECTILE_CORE_DEFAULTS,
  parseProjectileCore,
  ProjectileCoreSettings,
} from './projectile-core';

export interface SkyProjectileSettings extends ProjectileCoreSettings {
  skyHeight: number;
  skySlantX: number;
  skySlantZ: number;
  hitOffsetX: number;
  hitOffsetZ: number;
  hitHeight: number;
  arc: number;
}

export interface SkyBeamSettings {
  skyHeight: number;
  skySlantX: number;
  skySlantZ: number;
  hitOffsetX: number;
  hitOffsetZ: number;
  hitHeight: number;
  coreWidth: number;
  haloWidth: number;
  taper: number;
  waveAmp: number;
  waveFreq: number;
  skyAperture: number;
  impactFlare: number;
}

export interface SkyLightningSettings {
  skyHeight: number;
  skySlantX: number;
  skySlantZ: number;
  hitOffsetX: number;
  hitOffsetZ: number;
  hitHeight: number;
  arcCount: number;
  forkCount: number;
  forkSpread: number;
  forkLength: number;
  jaggedness: number;
  complexity: number;
  flickerRate: number;
  coreWidth: number;
  glowWidth: number;
  coreColor: string;
  glowColor: string;
  emitterColor: string;
  emitterCount: number;
  emitterSpread: number;
}

export const SKY_PROJECTILE_DEFAULTS: SkyProjectileSettings = {
  ...PROJECTILE_CORE_DEFAULTS,
  skyHeight: 95,
  skySlantX: -35,
  skySlantZ: -20,
  hitOffsetX: 0,
  hitOffsetZ: 0,
  hitHeight: 6,
  arc: 18,
};

export const SKY_BEAM_DEFAULTS: SkyBeamSettings = {
  skyHeight: 105,
  skySlantX: 0,
  skySlantZ: 0,
  hitOffsetX: 0,
  hitOffsetZ: 0,
  hitHeight: 4,
  coreWidth: 14,
  haloWidth: 34,
  taper: 0,
  waveAmp: 0,
  waveFreq: 6,
  skyAperture: 28,
  impactFlare: 32,
};

export const SKY_LIGHTNING_DEFAULTS: SkyLightningSettings = {
  skyHeight: 110,
  skySlantX: -15,
  skySlantZ: -10,
  hitOffsetX: 0,
  hitOffsetZ: 0,
  hitHeight: 6,
  arcCount: 2,
  forkCount: 8,
  forkSpread: 38,
  forkLength: 0.45,
  jaggedness: 42,
  complexity: 36,
  flickerRate: 14,
  coreWidth: 5,
  glowWidth: 18,
  coreColor: '#ffffff',
  glowColor: '#7ab8ff',
  emitterColor: '#c4e2ff',
  emitterCount: 24,
  emitterSpread: 22,
};

export const SKY_ORIGIN_CONTROLS: readonly {
  key: 'skyHeight' | 'skySlantX' | 'skySlantZ' | 'hitOffsetX' | 'hitOffsetZ' | 'hitHeight';
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'skyHeight', label: 'Sky origin altitude', min: 20, max: 180, step: 1 },
  { key: 'skySlantX', label: 'Sky origin X slant (left/right)', min: -140, max: 140, step: 1 },
  { key: 'skySlantZ', label: 'Sky origin Z slant (depth)', min: -140, max: 140, step: 1 },
  { key: 'hitOffsetX', label: 'Target hit offset X', min: -80, max: 80, step: 1 },
  { key: 'hitOffsetZ', label: 'Target hit offset Z', min: -80, max: 80, step: 1 },
  { key: 'hitHeight', label: 'Target impact height', min: 0, max: 50, step: 1 },
];

export const SKY_BEAM_CONTROLS: readonly {
  key: keyof SkyBeamSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  ...SKY_ORIGIN_CONTROLS,
  { key: 'coreWidth', label: 'Inner beam core width', min: 2, max: 60, step: 1 },
  { key: 'haloWidth', label: 'Outer beam halo width', min: 4, max: 120, step: 1 },
  { key: 'taper', label: 'Beam taper (sky to target)', min: -1, max: 1, step: 0.05 },
  { key: 'waveAmp', label: 'Turbulent wave amplitude', min: 0, max: 40, step: 0.5 },
  { key: 'waveFreq', label: 'Wave frequency along beam', min: 1, max: 24, step: 1 },
  { key: 'skyAperture', label: 'Sky portal / aperture ring size', min: 0, max: 80, step: 1 },
  { key: 'impactFlare', label: 'Ground strike flare size', min: 0, max: 80, step: 1 },
];

export const SKY_LIGHTNING_CONTROLS: readonly {
  key: Exclude<keyof SkyLightningSettings, 'coreColor' | 'glowColor' | 'emitterColor'>;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  ...SKY_ORIGIN_CONTROLS,
  { key: 'arcCount', label: 'Primary lightning arcs', min: 1, max: 8, step: 1 },
  { key: 'forkCount', label: 'Branching lightning lines / forks', min: 0, max: 24, step: 1 },
  { key: 'forkSpread', label: 'Branch spread angle (°)', min: 5, max: 85, step: 1 },
  { key: 'forkLength', label: 'Branch reach length', min: 0.1, max: 1, step: 0.05 },
  { key: 'jaggedness', label: 'Lightning line variance / jaggedness', min: 0, max: 100, step: 1 },
  { key: 'complexity', label: 'Fractal segment complexity', min: 12, max: 80, step: 2 },
  { key: 'flickerRate', label: 'Conductivity / flicker speed', min: 0, max: 30, step: 1 },
  { key: 'coreWidth', label: 'Inner core bolt width', min: 1, max: 25, step: 0.5 },
  { key: 'glowWidth', label: 'Outer electrical glow width', min: 2, max: 60, step: 1 },
  { key: 'emitterCount', label: 'Outer spark emitter count', min: 0, max: 60, step: 1 },
  { key: 'emitterSpread', label: 'Outer emitter radial spread', min: 2, max: 70, step: 1 },
];

const clampNum = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const colorOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

export function parseSkyProjectile(raw: unknown, variant = 'fireball', color = '#ff5b16'): SkyProjectileSettings {
  const r = (raw ?? {}) as Partial<SkyProjectileSettings>;
  const base = parseProjectileCore(r, variant === 'starfall' ? 'shard' : 'meteor', color);
  return {
    ...base,
    skyHeight: clampNum(r.skyHeight, 20, 180, SKY_PROJECTILE_DEFAULTS.skyHeight),
    skySlantX: clampNum(r.skySlantX, -140, 140, SKY_PROJECTILE_DEFAULTS.skySlantX),
    skySlantZ: clampNum(r.skySlantZ, -140, 140, SKY_PROJECTILE_DEFAULTS.skySlantZ),
    hitOffsetX: clampNum(r.hitOffsetX, -80, 80, SKY_PROJECTILE_DEFAULTS.hitOffsetX),
    hitOffsetZ: clampNum(r.hitOffsetZ, -80, 80, SKY_PROJECTILE_DEFAULTS.hitOffsetZ),
    hitHeight: clampNum(r.hitHeight, 0, 50, SKY_PROJECTILE_DEFAULTS.hitHeight),
    arc: clampNum(r.arc, -120, 120, SKY_PROJECTILE_DEFAULTS.arc),
  };
}

export function parseSkyBeam(raw: unknown): SkyBeamSettings {
  const r = (raw ?? {}) as Partial<SkyBeamSettings>;
  return {
    skyHeight: clampNum(r.skyHeight, 20, 180, SKY_BEAM_DEFAULTS.skyHeight),
    skySlantX: clampNum(r.skySlantX, -140, 140, SKY_BEAM_DEFAULTS.skySlantX),
    skySlantZ: clampNum(r.skySlantZ, -140, 140, SKY_BEAM_DEFAULTS.skySlantZ),
    hitOffsetX: clampNum(r.hitOffsetX, -80, 80, SKY_BEAM_DEFAULTS.hitOffsetX),
    hitOffsetZ: clampNum(r.hitOffsetZ, -80, 80, SKY_BEAM_DEFAULTS.hitOffsetZ),
    hitHeight: clampNum(r.hitHeight, 0, 50, SKY_BEAM_DEFAULTS.hitHeight),
    coreWidth: clampNum(r.coreWidth, 2, 60, SKY_BEAM_DEFAULTS.coreWidth),
    haloWidth: clampNum(r.haloWidth, 4, 120, SKY_BEAM_DEFAULTS.haloWidth),
    taper: clampNum(r.taper, -1, 1, SKY_BEAM_DEFAULTS.taper),
    waveAmp: clampNum(r.waveAmp, 0, 40, SKY_BEAM_DEFAULTS.waveAmp),
    waveFreq: clampNum(r.waveFreq, 1, 24, SKY_BEAM_DEFAULTS.waveFreq),
    skyAperture: clampNum(r.skyAperture, 0, 80, SKY_BEAM_DEFAULTS.skyAperture),
    impactFlare: clampNum(r.impactFlare, 0, 80, SKY_BEAM_DEFAULTS.impactFlare),
  };
}

export function parseSkyLightning(raw: unknown): SkyLightningSettings {
  const r = (raw ?? {}) as Partial<SkyLightningSettings>;
  return {
    skyHeight: clampNum(r.skyHeight, 20, 180, SKY_LIGHTNING_DEFAULTS.skyHeight),
    skySlantX: clampNum(r.skySlantX, -140, 140, SKY_LIGHTNING_DEFAULTS.skySlantX),
    skySlantZ: clampNum(r.skySlantZ, -140, 140, SKY_LIGHTNING_DEFAULTS.skySlantZ),
    hitOffsetX: clampNum(r.hitOffsetX, -80, 80, SKY_LIGHTNING_DEFAULTS.hitOffsetX),
    hitOffsetZ: clampNum(r.hitOffsetZ, -80, 80, SKY_LIGHTNING_DEFAULTS.hitOffsetZ),
    hitHeight: clampNum(r.hitHeight, 0, 50, SKY_LIGHTNING_DEFAULTS.hitHeight),
    arcCount: Math.round(clampNum(r.arcCount, 1, 8, SKY_LIGHTNING_DEFAULTS.arcCount)),
    forkCount: Math.round(clampNum(r.forkCount, 0, 24, SKY_LIGHTNING_DEFAULTS.forkCount)),
    forkSpread: clampNum(r.forkSpread, 5, 85, SKY_LIGHTNING_DEFAULTS.forkSpread),
    forkLength: clampNum(r.forkLength, 0.1, 1, SKY_LIGHTNING_DEFAULTS.forkLength),
    jaggedness: clampNum(r.jaggedness, 0, 100, SKY_LIGHTNING_DEFAULTS.jaggedness),
    complexity: Math.round(clampNum(r.complexity, 12, 80, SKY_LIGHTNING_DEFAULTS.complexity)),
    flickerRate: clampNum(r.flickerRate, 0, 30, SKY_LIGHTNING_DEFAULTS.flickerRate),
    coreWidth: clampNum(r.coreWidth, 1, 25, SKY_LIGHTNING_DEFAULTS.coreWidth),
    glowWidth: clampNum(r.glowWidth, 2, 60, SKY_LIGHTNING_DEFAULTS.glowWidth),
    coreColor: colorOr(r.coreColor, SKY_LIGHTNING_DEFAULTS.coreColor),
    glowColor: colorOr(r.glowColor, SKY_LIGHTNING_DEFAULTS.glowColor),
    emitterColor: colorOr(r.emitterColor, SKY_LIGHTNING_DEFAULTS.emitterColor),
    emitterCount: Math.round(clampNum(r.emitterCount, 0, 60, SKY_LIGHTNING_DEFAULTS.emitterCount)),
    emitterSpread: clampNum(r.emitterSpread, 2, 70, SKY_LIGHTNING_DEFAULTS.emitterSpread),
  };
}
