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
  DEFAULT_DICE_PHYSICS_CONFIG,
  DicePhysicsConfig
} from './dice-physics.types';
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
  keyframesPos?: Vector3[];
  keyframesQuat?: Quaternion[];
  bounceFrames?: number[];
  bouncedIndices?: Set<number>;
  delayMs?: number;
  durationMs?: number;
}

export function createPhysicsBoxTrajectoryPlans(
  entries: ReadonlyArray<{ dieType: DicePolyhedronType; targetValue: number }>,
  sizeScale: number,
  physics: DicePhysicsConfig = DEFAULT_DICE_PHYSICS_CONFIG,
  cameraPosition?: Vector3
): DiePhysicsTrajectoryPlan[] {
  const count = entries.length;
  const halfW = Math.max(2.5, (physics.boundaryWidth ?? 14) * 0.5 - 0.85 * sizeScale);
  const halfD = Math.max(2.0, (physics.boundaryDepth ?? 10) * 0.5 - 0.85 * sizeScale);
  const floorY = 0.82 * sizeScale;
  const dt = 1 / 60;
  const totalSteps = 90;

  const grav = 24.0 * Math.max(0.15, physics.gravity ?? 1.0);
  const massFactor = 1.0 / Math.max(0.25, Math.pow(physics.mass ?? 1.0, 0.35));
  const throwMag = (3.5 + (physics.throwForce ?? 5.0) * 2.15) * massFactor;
  const startY = Math.max(1.8, (physics.startingHeight ?? 8.0) * 0.85);
  const airDrag = Math.max(0, Math.min(0.96, physics.linearDamping ?? 0.5));
  const angDrag = Math.max(0, Math.min(0.96, physics.angularDamping ?? 0.4));
  const floorFriction = Math.max(0.05, Math.min(0.98, physics.friction ?? 0.8));
  const floorRestitution = Math.max(0.02, Math.min(0.92, physics.restitution ?? 0.35));
  const wallBounce = Math.max(0.15, Math.min(0.98, physics.wallRestitution ?? 0.72));
  const spinRate = (physics.spinForce ?? 6.0) * 2.4;

  // Initial state per die: thrown from edge of boundary box inward
  const positions: Vector3[] = [];
  const velocities: Vector3[] = [];
  const angVels: Vector3[] = [];
  const quats: Quaternion[] = [];
  const keyframesPos: Vector3[][] = Array.from({ length: count }, () => []);
  const keyframesQuat: Quaternion[][] = Array.from({ length: count }, () => []);
  const bounceFrames: number[][] = Array.from({ length: count }, () => []);

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const zSpread = count === 1 ? 0 : ((i / Math.max(1, count - 1)) - 0.5) * halfD * 1.1;
    const sx = side * (halfW * 0.92);
    const sz = Math.max(-halfD * 0.85, Math.min(halfD * 0.85, zSpread + (Math.random() - 0.5) * 1.2));
    const sy = startY + (i % 3) * 0.55;

    positions.push(new Vector3(sx, sy, sz));

    const aimX = -side * throwMag * (0.85 + Math.random() * 0.35);
    const aimZ = (-sz * 0.45 + (Math.random() - 0.5) * 3.8) * (0.5 + (physics.throwForce ?? 5) * 0.08);
    const aimY = -1.5 - Math.random() * 2.0;
    velocities.push(new Vector3(aimX, aimY, aimZ));

    angVels.push(
      new Vector3(
        (Math.random() - 0.5) * spinRate * 2.2,
        (Math.random() - 0.5) * spinRate * 2.2,
        (Math.random() - 0.5) * spinRate * 2.2
      )
    );
    quats.push(
      Quaternion.RotationYawPitchRoll(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      )
    );
  }

  const minSeparation = 1.95 * sizeScale;

  for (let step = 0; step <= totalSteps; step++) {
    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      const vel = velocities[i];
      const av = angVels[i];

      // Gravity + Air resistance
      vel.y -= grav * dt;
      const linFactor = Math.max(0.82, 1 - airDrag * dt * 1.8);
      vel.x *= linFactor;
      vel.z *= linFactor;
      av.scaleInPlace(Math.max(0.84, 1 - angDrag * dt * 1.6));

      pos.addInPlace(vel.scale(dt));

      // Floor collision & resistance
      if (pos.y <= floorY) {
        pos.y = floorY;
        if (Math.abs(vel.y) > 1.35 && bounceFrames[i].length < 4) {
          bounceFrames[i].push(step);
        }
        vel.y = Math.abs(vel.y) * floorRestitution;
        if (vel.y < 0.85) {
          vel.y = 0;
        }
        const fFactor = Math.max(0.45, 1 - floorFriction * 0.28);
        vel.x *= fFactor;
        vel.z *= fFactor;
        av.scaleInPlace(Math.max(0.55, 1 - floorFriction * 0.22));
      }

      // Imaginary Box Boundary Wall Collisions
      if (pos.x > halfW) {
        pos.x = halfW;
        vel.x = -Math.abs(vel.x) * wallBounce;
        av.y += (Math.random() - 0.5) * 4;
        if (bounceFrames[i].length < 4) bounceFrames[i].push(step);
      } else if (pos.x < -halfW) {
        pos.x = -halfW;
        vel.x = Math.abs(vel.x) * wallBounce;
        av.y += (Math.random() - 0.5) * 4;
        if (bounceFrames[i].length < 4) bounceFrames[i].push(step);
      }

      if (pos.z > halfD) {
        pos.z = halfD;
        vel.z = -Math.abs(vel.z) * wallBounce;
        av.x += (Math.random() - 0.5) * 4;
        if (bounceFrames[i].length < 4) bounceFrames[i].push(step);
      } else if (pos.z < -halfD) {
        pos.z = -halfD;
        vel.z = Math.abs(vel.z) * wallBounce;
        av.x += (Math.random() - 0.5) * 4;
        if (bounceFrames[i].length < 4) bounceFrames[i].push(step);
      }

      // Integrate angular velocity into quaternion
      const angle = av.length() * dt;
      if (angle > 0.0001) {
        const axis = av.normalizeToNew();
        const deltaQ = Quaternion.RotationAxis(axis, angle);
        quats[i] = deltaQ.multiply(quats[i]).normalize();
      }
    }

    // Die-to-die elastic separation
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = positions[j].x - positions[i].x;
        const dz = positions[j].z - positions[i].z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.0001 && dist < minSeparation && Math.abs(positions[j].y - positions[i].y) < minSeparation) {
          const overlap = (minSeparation - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          positions[i].x = Math.max(-halfW, Math.min(halfW, positions[i].x - nx * overlap));
          positions[i].z = Math.max(-halfD, Math.min(halfD, positions[i].z - nz * overlap));
          positions[j].x = Math.max(-halfW, Math.min(halfW, positions[j].x + nx * overlap));
          positions[j].z = Math.max(-halfD, Math.min(halfD, positions[j].z + nz * overlap));

          const rvx = velocities[j].x - velocities[i].x;
          const rvz = velocities[j].z - velocities[i].z;
          const vn = rvx * nx + rvz * nz;
          if (vn < 0) {
            const imp = -(1 + floorRestitution) * vn * 0.5;
            velocities[i].x -= imp * nx;
            velocities[i].z -= imp * nz;
            velocities[j].x += imp * nx;
            velocities[j].z += imp * nz;
          }
        }
      }
    }

    for (let i = 0; i < count; i++) {
      keyframesPos[i].push(positions[i].clone());
      keyframesQuat[i].push(quats[i].clone());
    }
  }

  const camPos = cameraPosition ?? new Vector3(0, 15.5, -1.2);
  const plans: DiePhysicsTrajectoryPlan[] = [];

  for (let i = 0; i < count; i++) {
    const endPos = keyframesPos[i][totalSteps].clone();
    endPos.y = floorY;
    const toCam = camPos.subtract(endPos).normalize();
    const targetQuat = getRotationForTopValue(entries[i].dieType, entries[i].targetValue, 0, toCam);

    // Smoothly slerp final 24% of keyframes into authoritative targetQuat & settled floorY
    const blendStart = Math.floor(totalSteps * 0.72);
    const preBlendQuat = keyframesQuat[i][blendStart].clone();
    for (let s = blendStart; s <= totalSteps; s++) {
      const alpha = (s - blendStart) / Math.max(1, totalSteps - blendStart);
      const smooth = 1 - Math.pow(1 - alpha, 2.5);
      keyframesQuat[i][s] = Quaternion.Slerp(preBlendQuat, targetQuat, smooth);
      keyframesPos[i][s].y = keyframesPos[i][s].y * (1 - smooth) + floorY * smooth;
    }

    plans.push({
      startPos: keyframesPos[i][0],
      bounce1Pos: keyframesPos[i][Math.floor(totalSteps * 0.38)],
      bounce2Pos: keyframesPos[i][Math.floor(totalSteps * 0.72)],
      endPos,
      startQuat: keyframesQuat[i][0],
      midQuat1: keyframesQuat[i][Math.floor(totalSteps * 0.38)],
      midQuat2: keyframesQuat[i][Math.floor(totalSteps * 0.72)],
      targetQuat,
      bounced1: false,
      bounced2: false,
      keyframesPos: keyframesPos[i],
      keyframesQuat: keyframesQuat[i],
      bounceFrames: bounceFrames[i],
      bouncedIndices: new Set<number>(),
      delayMs: i * Math.max(0, physics.delay ?? 10),
      durationMs: Math.max(650, Math.min(2200, 1080 / Math.sqrt(Math.max(0.3, physics.gravity ?? 1.0))))
    });
  }

  return plans;
}

export function createDieTrajectoryPlan(
  index: number,
  totalDice: number,
  dieType: DicePolyhedronType,
  targetValue: number,
  sizeScale: number,
  physics: DicePhysicsConfig = DEFAULT_DICE_PHYSICS_CONFIG
): DiePhysicsTrajectoryPlan {
  const entries = Array.from({ length: Math.max(1, totalDice) }, (_, idx) => ({
    dieType,
    targetValue: idx === index ? targetValue : 1
  }));
  const all = createPhysicsBoxTrajectoryPlans(entries, sizeScale, physics);
  return all[Math.min(index, all.length - 1)];
}

export function evaluateDieTrajectoryStep(
  plan: DiePhysicsTrajectoryPlan,
  t: number,
  sizeScale: number,
  onBounceImpact?: (intensity: number) => void
): { position: Vector3; rotationQuaternion: Quaternion } {
  if (plan.keyframesPos && plan.keyframesQuat && plan.keyframesPos.length > 1) {
    const maxIdx = plan.keyframesPos.length - 1;
    const exact = Math.max(0, Math.min(1, t)) * maxIdx;
    const idx0 = Math.floor(exact);
    const idx1 = Math.min(maxIdx, idx0 + 1);
    const frac = exact - idx0;

    if (plan.bounceFrames && plan.bouncedIndices) {
      for (const bf of plan.bounceFrames) {
        if (idx0 >= bf && !plan.bouncedIndices.has(bf)) {
          plan.bouncedIndices.add(bf);
          onBounceImpact?.(Math.max(0.25, 0.95 - (bf / maxIdx) * 0.65));
        }
      }
    }

    return {
      position: Vector3.Lerp(plan.keyframesPos[idx0], plan.keyframesPos[idx1], frac),
      rotationQuaternion: Quaternion.Slerp(plan.keyframesQuat[idx0], plan.keyframesQuat[idx1], frac)
    };
  }

  const floorY = 0.88 * sizeScale;
  if (t < 0.42) {
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
    `lw-roll-badge-${value}-${Math.round(Math.random() * 1000)}`,
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
  return createDieTrajectoryPlan(index, totalDice, dieType, targetValue, sizeScale, DEFAULT_DICE_PHYSICS_CONFIG);
}

export function createDieContactShadowDisc(
  index: number,
  sizeScale: number,
  scene: Scene,
  shadowTransparency = 0.8
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

  const alpha = Math.max(0, Math.min(1, shadowTransparency));
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, `rgba(0, 0, 0, ${(0.72 * alpha).toFixed(2)})`);
  grad.addColorStop(0.52, `rgba(0, 0, 0, ${(0.36 * alpha).toFixed(2)})`);
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
