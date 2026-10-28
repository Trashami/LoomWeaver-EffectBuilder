import {
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  DicePolyhedronType,
  getRotationForTopValue
} from './models';

export interface DiePhysicsTrajectoryPlan {
  startPos: Vector3;
  bounce1Pos: Vector3;
  bounce2Pos: Vector3;
  endPos: Vector3;
  startQuat: Quaternion;
  midQuat1: Quaternion;
  midQuat2: Quaternion;
  targetQuat: Quaternion;
  bounced1: boolean;
  bounced2: boolean;
}

export function createDieTrajectoryPlan(
  index: number,
  totalDice: number,
  dieType: DicePolyhedronType,
  targetValue: number,
  sizeScale: number
): DiePhysicsTrajectoryPlan {
  const spread = Math.min(3.4, 1.3 + totalDice * 0.42);
  const angleEnd = (index / Math.max(1, totalDice)) * Math.PI * 2 + 0.35;
  const endRadius = totalDice === 1 ? 0.25 : spread * (0.48 + (index % 2) * 0.28);

  const endX = Math.cos(angleEnd) * endRadius;
  const endZ = Math.sin(angleEnd) * endRadius;
  const floorY = 0.88 * sizeScale;

  // Launch from rim of the octagonal tray
  const launchAngle = angleEnd + Math.PI + (Math.random() - 0.5) * 0.65;
  const startPos = new Vector3(
    Math.cos(launchAngle) * 4.4,
    3.6 + (index % 3) * 0.45,
    Math.sin(launchAngle) * 4.4
  );

  // First floor impact
  const bounce1Pos = new Vector3(
    startPos.x * 0.42 + endX * 0.58 + (Math.random() - 0.5) * 0.9,
    floorY,
    startPos.z * 0.42 + endZ * 0.58 + (Math.random() - 0.5) * 0.9
  );

  // Second floor impact
  const bounce2Pos = new Vector3(
    bounce1Pos.x * 0.35 + endX * 0.65,
    floorY,
    bounce1Pos.z * 0.35 + endZ * 0.65
  );

  const endPos = new Vector3(endX, floorY, endZ);

  const startQuat = Quaternion.RotationYawPitchRoll(
    Math.random() * Math.PI * 4,
    Math.random() * Math.PI * 4,
    Math.random() * Math.PI * 4
  );
  const midQuat1 = Quaternion.RotationYawPitchRoll(
    Math.random() * Math.PI * 6,
    Math.random() * Math.PI * 6,
    Math.random() * Math.PI * 6
  );
  const midQuat2 = Quaternion.RotationYawPitchRoll(
    Math.random() * Math.PI * 3,
    Math.random() * Math.PI * 3,
    Math.random() * Math.PI * 3
  );

  const targetQuat = getRotationForTopValue(dieType, targetValue);

  return {
    startPos,
    bounce1Pos,
    bounce2Pos,
    endPos,
    startQuat,
    midQuat1,
    midQuat2,
    targetQuat,
    bounced1: false,
    bounced2: false
  };
}

export function evaluateDieTrajectoryStep(
  plan: DiePhysicsTrajectoryPlan,
  t: number,
  sizeScale: number,
  onBounceImpact?: (intensity: number) => void
): { position: Vector3; rotationQuaternion: Quaternion } {
  const floorY = 0.88 * sizeScale;

  if (t < 0.42) {
    // Phase 1: Initial throw drop to first impact
    const localT = t / 0.42;
    const pos = Vector3.Lerp(plan.startPos, plan.bounce1Pos, localT);
    const arc = Math.sin(localT * Math.PI) * 1.35;
    pos.y = (1 - localT * localT) * (plan.startPos.y - floorY) + floorY + arc * 0.25;
    const rot = Quaternion.Slerp(plan.startQuat, plan.midQuat1, localT);
    return { position: pos, rotationQuaternion: rot };
  }

  if (!plan.bounced1) {
    plan.bounced1 = true;
    onBounceImpact?.(0.9);
  }

  if (t < 0.74) {
    // Phase 2: First rebound arc to second impact
    const localT = (t - 0.42) / 0.32;
    const pos = Vector3.Lerp(plan.bounce1Pos, plan.bounce2Pos, localT);
    pos.y = floorY + Math.sin(localT * Math.PI) * 1.25;
    const rot = Quaternion.Slerp(plan.midQuat1, plan.midQuat2, localT);
    return { position: pos, rotationQuaternion: rot };
  }

  if (!plan.bounced2) {
    plan.bounced2 = true;
    onBounceImpact?.(0.52);
  }

  // Phase 3: Final settle hop onto exact authoritative top face
  const localT = (t - 0.74) / 0.26;
  const smoothT = 1 - Math.pow(1 - localT, 2.4);
  const pos = Vector3.Lerp(plan.bounce2Pos, plan.endPos, smoothT);
  pos.y = floorY + Math.sin(localT * Math.PI) * 0.36 * (1 - localT);
  const rot = Quaternion.Slerp(plan.midQuat2, plan.targetQuat, smoothT);

  return { position: pos, rotationQuaternion: rot };
}

export function createFloatingResultBadge(
  value: number,
  position: Vector3,
  accentHex: string,
  isCritSuccess: boolean,
  isCritFail: boolean,
  scene: Scene
): Mesh {
  const plane = MeshBuilder.CreatePlane(
    `lw-roll-badge-${value}-${ Math.round(Math.random() * 1000) }`,
    { width: 1.05, height: 1.05 },
    scene
  );
  plane.position = position.add(new Vector3(0, 1.35, 0));
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

  const tex = new DynamicTexture(`lw-roll-badge-tex-${value}`, 256, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 256);

  const ringColor = isCritSuccess ? '#ffd166' : isCritFail ? '#ff425b' : accentHex;

  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(5, 16, 12, 0.88)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = ringColor;
  ctx.stroke();

  ctx.font = '800 92px Cinzel, Georgia, serif';
  ctx.fillStyle = isCritSuccess ? '#ffe89e' : isCritFail ? '#ff8fa0' : '#f4f7f5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 132);
  tex.update(false);

  const mat = new StandardMaterial(`lw-roll-badge-mat-${value}`, scene);
  mat.diffuseTexture = tex;
  mat.emissiveTexture = tex;
  mat.opacityTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  plane.material = mat;

  return plane;
}

export function createFullscreenDieTrajectoryPlan(
  index: number,
  totalDice: number,
  dieType: DicePolyhedronType,
  targetValue: number,
  sizeScale: number
): DiePhysicsTrajectoryPlan {
  const goldenAngle = index * 2.39996 + (Math.random() - 0.5) * 0.32;
  const ringRadius = totalDice === 1
    ? 0.4 + Math.random() * 0.8
    : 1.65 + Math.sqrt(index + 0.6) * 1.45;
  const endX = Math.max(-5.6, Math.min(5.2, Math.cos(goldenAngle) * ringRadius * 1.35));
  const endZ = Math.max(-3.1, Math.min(3.1, Math.sin(goldenAngle) * ringRadius * 0.85));
  const floorY = 0.88 * sizeScale;

  // Throw from left/bottom-left or right/bottom-right edge across the full screen
  const fromLeft = index % 2 === 0;
  const startX = (fromLeft ? -9.2 : 9.2) + (Math.random() - 0.5) * 1.4;
  const startZ = -3.8 + (index % 3) * 2.1 + (Math.random() - 0.5) * 1.2;
  const startPos = new Vector3(startX, 4.4 + (index % 3) * 0.55, startZ);

  const bounce1Pos = new Vector3(
    startPos.x * 0.36 + endX * 0.64 + (Math.random() - 0.5) * 1.35,
    floorY,
    startPos.z * 0.36 + endZ * 0.64 + (Math.random() - 0.5) * 1.05
  );

  const bounce2Pos = new Vector3(
    bounce1Pos.x * 0.28 + endX * 0.72 + (Math.random() - 0.5) * 0.5,
    floorY,
    bounce1Pos.z * 0.28 + endZ * 0.72 + (Math.random() - 0.5) * 0.45
  );

  const endPos = new Vector3(endX, floorY, endZ);

  return {
    startPos,
    bounce1Pos,
    bounce2Pos,
    endPos,
    startQuat: Quaternion.RotationYawPitchRoll(
      Math.random() * Math.PI * 6,
      Math.random() * Math.PI * 6,
      Math.random() * Math.PI * 6
    ),
    midQuat1: Quaternion.RotationYawPitchRoll(
      Math.random() * Math.PI * 8,
      Math.random() * Math.PI * 8,
      Math.random() * Math.PI * 8
    ),
    midQuat2: Quaternion.RotationYawPitchRoll(
      Math.random() * Math.PI * 4,
      Math.random() * Math.PI * 4,
      Math.random() * Math.PI * 4
    ),
    targetQuat: getRotationForTopValue(dieType, targetValue),
    bounced1: false,
    bounced2: false
  };
}

export function createDieContactShadowDisc(
  index: number,
  sizeScale: number,
  scene: Scene
): Mesh {
  const disc = MeshBuilder.CreateGround(
    `lw-die-shadow-${index}-${Math.round(Math.random() * 1000)}`,
    { width: 2.35 * sizeScale, height: 2.35 * sizeScale },
    scene
  );
  disc.position.y = 0.02;

  const tex = new DynamicTexture(`lw-die-shadow-tex-${index}`, 128, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 128, 128);

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.52, 'rgba(0, 0, 0, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  tex.update(false);

  const mat = new StandardMaterial(`lw-die-shadow-mat-${index}`, scene);
  mat.diffuseTexture = tex;
  mat.opacityTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  disc.material = mat;

  return disc;
}

