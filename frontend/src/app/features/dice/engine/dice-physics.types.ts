import { DicePolyhedronType } from './models/dice-model.types';

export type DiceForgeToolId =
  | 'skin'
  | 'core'
  | 'font'
  | 'numbers'
  | 'effects'
  | 'physics'
  | 'crit'
  | 'market';

export type DiceBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'additive';

export type DicePulseWaveform = 'sine' | 'heartbeat' | 'sawtooth' | 'flicker';

export interface DicePhysicsConfig {
  readonly gravity: number;
  readonly mass: number;
  readonly friction: number;
  readonly restitution: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly spinForce: number;
  readonly throwForce: number;
  readonly startingHeight: number;
  readonly settleTimeout: number;
  readonly delay: number;
  readonly scale: number;
  readonly enableShadows: boolean;
  readonly shadowTransparency: number;
  readonly lightIntensity: number;
  readonly suspendSimulation: boolean;
  readonly boundaryWidth: number;
  readonly boundaryDepth: number;
  readonly wallRestitution: number;
  readonly showBoundaryBox: boolean;
  readonly rollCameraPitchDeg: number;
  readonly rollCameraYawDeg: number;
  readonly rollCameraDistance: number;
}

export interface QueuedDiePoolEntry {
  readonly dieType: DicePolyhedronType;
  readonly sides: number;
}

export const DEFAULT_DICE_PHYSICS_CONFIG: DicePhysicsConfig = {
  gravity: 1.0,
  mass: 1.0,
  friction: 0.8,
  restitution: 0.35,
  linearDamping: 0.5,
  angularDamping: 0.4,
  spinForce: 6.0,
  throwForce: 5.0,
  startingHeight: 8.0,
  settleTimeout: 5000,
  delay: 10,
  scale: 5.0,
  enableShadows: true,
  shadowTransparency: 0.8,
  lightIntensity: 1.0,
  suspendSimulation: false,
  boundaryWidth: 14.0,
  boundaryDepth: 10.0,
  wallRestitution: 0.72,
  showBoundaryBox: false,
  rollCameraPitchDeg: 84,
  rollCameraYawDeg: -90,
  rollCameraDistance: 15.5
};
