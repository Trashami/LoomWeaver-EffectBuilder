import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import { hexToColor3 } from '../materials/babylon-dice-material.factory';
import { DiceCritEffectPreset } from './dice-crit-effects.catalog';

interface ActiveBurstParticle {
  mesh: Mesh;
  velocity: Vector3;
}

export class DiceCritEffectsRunner {
  private activeDisposables: Mesh[] = [];
  private activeTimerIds: number[] = [];

  triggerCritEffect(
    preset: DiceCritEffectPreset,
    origin: Vector3,
    scene: Scene,
    glowLayer: GlowLayer | null,
    baseGlowIntensity = 0.55
  ): void {
    this.clearActiveEffects();

    const primaryColor = hexToColor3(preset.primaryColorHex);
    const secondaryColor = hexToColor3(preset.secondaryColorHex);

    // 1. Shockwave Ring on Tray Floor
    const ringMesh = MeshBuilder.CreateTorus(
      `lw-crit-ring-${preset.id}`,
      { diameter: 1.5, thickness: 0.14, tessellation: 48 },
      scene
    );
    ringMesh.position = new Vector3(origin.x, 0.12, origin.z);
    const ringMat = new StandardMaterial(`lw-crit-ring-mat-${preset.id}`, scene);
    ringMat.diffuseColor = primaryColor;
    ringMat.emissiveColor = primaryColor.scale(1.25);
    ringMat.alpha = 0.92;
    ringMesh.material = ringMat;
    this.activeDisposables.push(ringMesh);

    // Secondary concentric shockwave ring
    const innerRing = MeshBuilder.CreateTorus(
      `lw-crit-inner-ring-${preset.id}`,
      { diameter: 0.9, thickness: 0.08, tessellation: 40 },
      scene
    );
    innerRing.position = new Vector3(origin.x, 0.16, origin.z);
    const innerMat = new StandardMaterial(`lw-crit-inner-mat-${preset.id}`, scene);
    innerMat.diffuseColor = secondaryColor;
    innerMat.emissiveColor = secondaryColor.scale(1.15);
    innerMat.alpha = 0.85;
    innerRing.material = innerMat;
    this.activeDisposables.push(innerRing);

    // 2. Optional Celestial Light Pillar (Nat 20)
    let pillarMesh: Mesh | null = null;
    let pillarMat: StandardMaterial | null = null;
    if (preset.hasLightPillar) {
      pillarMesh = MeshBuilder.CreateCylinder(
        `lw-crit-pillar-${preset.id}`,
        { height: 7.5, diameterTop: 0.35, diameterBottom: 1.85, tessellation: 28 },
        scene
      );
      pillarMesh.position = new Vector3(origin.x, 3.6, origin.z);
      pillarMat = new StandardMaterial(`lw-crit-pillar-mat-${preset.id}`, scene);
      pillarMat.diffuseColor = primaryColor;
      pillarMat.emissiveColor = Color3.Lerp(primaryColor, secondaryColor, 0.35);
      pillarMat.alpha = 0.36;
      pillarMat.backFaceCulling = false;
      pillarMesh.material = pillarMat;
      this.activeDisposables.push(pillarMesh);
    }

    // 3. 3D Ember / Spark Particle Burst
    const particles: ActiveBurstParticle[] = [];
    const count = Math.min(40, preset.particleCount);
    const sharedMatA = new StandardMaterial(`lw-crit-part-a-${preset.id}`, scene);
    sharedMatA.diffuseColor = primaryColor;
    sharedMatA.emissiveColor = primaryColor;

    const sharedMatB = new StandardMaterial(`lw-crit-part-b-${preset.id}`, scene);
    sharedMatB.diffuseColor = secondaryColor;
    sharedMatB.emissiveColor = secondaryColor;

    for (let i = 0; i < count; i++) {
      const pMesh = MeshBuilder.CreateSphere(
        `lw-crit-ember-${i}`,
        { diameter: i % 3 === 0 ? 0.18 : 0.12, segments: 6 },
        scene
      );
      pMesh.position = origin.add(new Vector3(0, 0.35, 0));
      pMesh.material = i % 2 === 0 ? sharedMatA : sharedMatB;
      this.activeDisposables.push(pMesh);

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const radialSpeed = 1.6 + Math.random() * 3.4;
      const vy =
        preset.outcomeKind === 'nat20'
          ? 2.2 + Math.random() * preset.upwardDriftSpeed
          : 1.4 + Math.random() * 1.8;

      particles.push({
        mesh: pMesh,
        velocity: new Vector3(Math.cos(angle) * radialSpeed, vy, Math.sin(angle) * radialSpeed)
      });
    }

    // 4. Animate Shockwave, Pillar, Particles & GlowLayer Bloom Envelope
    const startTime = performance.now();
    const durationMs = 1150;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const dt = 0.016;

      // Expand shockwave rings
      const scaleOuter = 1 + t * 4.4;
      ringMesh.scaling.set(scaleOuter, 1, scaleOuter);
      ringMat.alpha = Math.max(0, (1 - t) * 0.9);

      const scaleInner = 1 + t * 3.1;
      innerRing.scaling.set(scaleInner, 1, scaleInner);
      innerMat.alpha = Math.max(0, (1 - t) * 0.82);

      if (pillarMesh && pillarMat) {
        pillarMesh.scaling.set(1 - t * 0.45, 1 + t * 0.25, 1 - t * 0.45);
        pillarMat.alpha = Math.max(0, Math.sin(t * Math.PI) * 0.42);
      }

      // Update ember particles
      const gravity = preset.outcomeKind === 'nat20' ? -1.8 : -6.8;
      for (const p of particles) {
        p.velocity.y += gravity * dt;
        p.mesh.position.addInPlace(p.velocity.scale(dt));
        if (p.mesh.position.y < 0.08) {
          p.mesh.position.y = 0.08;
          p.velocity.y = Math.abs(p.velocity.y) * 0.35;
        }
        const s = Math.max(0.05, 1 - t * 0.85);
        p.mesh.scaling.setAll(s);
      }

      // Bloom kick envelope on GlowLayer
      if (glowLayer) {
        const envelope = Math.sin(t * Math.PI);
        glowLayer.intensity = baseGlowIntensity + envelope * preset.bloomBoost * 0.65;
      }

      if (t < 1) {
        const timerId = window.setTimeout(step, 16);
        this.activeTimerIds.push(timerId);
      } else {
        if (glowLayer) {
          glowLayer.intensity = baseGlowIntensity;
        }
        this.clearActiveEffects();
      }
    };

    step();
  }

  clearActiveEffects(): void {
    for (const id of this.activeTimerIds) {
      clearTimeout(id);
    }
    this.activeTimerIds = [];

    for (const mesh of this.activeDisposables) {
      if (!mesh.isDisposed()) {
        mesh.material?.dispose();
        mesh.dispose();
      }
    }
    this.activeDisposables = [];
  }
}
