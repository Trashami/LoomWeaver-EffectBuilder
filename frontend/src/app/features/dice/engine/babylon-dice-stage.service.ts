import { inject, Injectable, NgZone } from '@angular/core';
import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, GlowLayer,
  HemisphericLight, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Vector3
} from '@babylonjs/core';
import { DiceSoundService } from './audio';
import {
  createDieTrajectoryPlan, createFloatingResultBadge,
  DiePhysicsTrajectoryPlan, evaluateDieTrajectoryStep
} from './dice-physics-trajectory';
import { DiceCritEffectsRunner, resolveCritFailEffect, resolveNat20Effect } from './effects';
import {
  applyVeinPulseToDieMaterials, buildBabylonPolyhedralDie, BuiltBabylonDieInstance,
  disposeDieMaterials, hexToColor3, preloadDiceSurfaceAssets
} from './materials';
import {
  DICE_SIZE_SCALE_MAP, DicePolyhedronType, FACE_VALUES,
  getRotationForTopValue, resolveDiceModel
} from './models';
import {
  createDefaultRuntimeConfigFromSkin, DiceCustomRuntimeConfig,
  DiceSkinConfig, resolveDiceSkin
} from './skins';

export interface DiceSkinPresetPayload {
  id: string;
  name: string;
  materialFamily: string;
  baseColorHex: string;
  accentColorHex: string;
  roughness: number;
  metalness: number;
  particleColorHex: string;
}

const SHOWCASE_DIE_TYPES: DicePolyhedronType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

@Injectable({ providedIn: 'root' })
export class BabylonDiceStageService {
  private readonly ngZone = inject(NgZone);
  private readonly soundService = inject(DiceSoundService);
  private readonly critEffectsRunner = new DiceCritEffectsRunner();

  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private glowLayer: GlowLayer | null = null;
  private accentPointLight: PointLight | null = null;
  private trayRimMat: StandardMaterial | null = null;

  private activeDice: BuiltBabylonDieInstance[] = [];
  private activeBadges: Mesh[] = [];
  private currentSkin: DiceSkinConfig = resolveDiceSkin('skin-obsidian-gold');
  private currentCustom: DiceCustomRuntimeConfig = createDefaultRuntimeConfigFromSkin(this.currentSkin);
  private focusDieType: DicePolyhedronType | 'all' = 'all';
  private isRolling = false;
  private rollAnimationTimer: number | null = null;
  private resizeHandler = () => this.engine?.resize();

  mountStage(canvas: HTMLCanvasElement, initialSkinIdOrPreset?: string | DiceSkinPresetPayload): void {
    this.dispose();
    const skinId = typeof initialSkinIdOrPreset === 'string' ? initialSkinIdOrPreset : initialSkinIdOrPreset?.id;
    this.currentSkin = resolveDiceSkin(skinId);
    this.currentCustom = createDefaultRuntimeConfigFromSkin(this.currentSkin);

    this.ngZone.runOutsideAngular(() => {
      this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
      const scene = new Scene(this.engine);
      scene.clearColor = new Color4(0.02, 0.055, 0.042, 1.0);
      this.scene = scene;

      const camera = new ArcRotateCamera('lw-dice-cam', -Math.PI / 2, Math.PI / 3.05, 12.4, new Vector3(0, 0.45, 0), scene);
      camera.lowerRadiusLimit = 6.5;
      camera.upperRadiusLimit = 20.0;
      camera.lowerBetaLimit = 0.25;
      camera.upperBetaLimit = Math.PI / 2.15;
      camera.wheelPrecision = 36;
      camera.attachControl(canvas, true);

      const hemi = new HemisphericLight('lw-dice-hemi', new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.86;
      hemi.groundColor = new Color3(0.04, 0.1, 0.08);

      const dirLight = new DirectionalLight('lw-dice-dir', new Vector3(-0.45, -1, 0.35), scene);
      dirLight.position = new Vector3(6, 12, -6);
      dirLight.intensity = 1.15;

      const pointLight = new PointLight('lw-dice-accent', new Vector3(0, 6.5, 0), scene);
      pointLight.intensity = 0.85;
      pointLight.diffuse = hexToColor3(this.currentCustom.glowColorHex);
      this.accentPointLight = pointLight;

      this.glowLayer = new GlowLayer('lw-dice-glow', scene, { mainTextureSamples: 4, blurKernelSize: 32 });
      this.glowLayer.intensity = 0.48 * this.currentCustom.glowIntensity;

      this.buildOctagonalTray(scene);
      this.rebuildShowcaseDice();

      void preloadDiceSurfaceAssets().then(() => {
        if (this.scene && !this.isRolling) this.rebuildShowcaseDice();
      });

      const startClock = performance.now();
      this.engine.runRenderLoop(() => {
        if (!this.scene) return;
        const elapsedSec = (performance.now() - startClock) * 0.001;
        if (!this.isRolling) {
          for (let i = 0; i < this.activeDice.length; i++) {
            const die = this.activeDice[i];
            die.mesh.rotation.y += 0.0045 + (i % 3) * 0.001;
            die.mesh.rotation.x = Math.sin(elapsedSec * 1.1 + i) * 0.14;
            applyVeinPulseToDieMaterials(die.faceMaterials, this.currentSkin, this.currentCustom, elapsedSec);
          }
        }
        this.scene.render();
      });

      window.addEventListener('resize', this.resizeHandler);
    });
  }

  getCurrentCustomConfig(): DiceCustomRuntimeConfig {
    return { ...this.currentCustom };
  }

  applySkin(skinOrPreset: DiceSkinConfig | DiceSkinPresetPayload | string): DiceCustomRuntimeConfig {
    const id = typeof skinOrPreset === 'string' ? skinOrPreset : skinOrPreset.id;
    this.currentSkin = resolveDiceSkin(id);
    this.currentCustom = createDefaultRuntimeConfigFromSkin(this.currentSkin);
    this.syncStageLightingAndRebuild();
    return this.getCurrentCustomConfig();
  }

  applyCustomOverrides(overrides: Partial<DiceCustomRuntimeConfig>): DiceCustomRuntimeConfig {
    if (overrides.skinId && overrides.skinId !== this.currentSkin.id) {
      this.currentSkin = resolveDiceSkin(overrides.skinId);
    }
    this.currentCustom = { ...this.currentCustom, ...overrides, skinId: this.currentSkin.id };
    this.syncStageLightingAndRebuild();
    return this.getCurrentCustomConfig();
  }

  setShowcaseFocusDie(focus: DicePolyhedronType | 'all'): void {
    this.focusDieType = focus;
    if (!this.isRolling) this.rebuildShowcaseDice();
  }

  previewCritOutcomeEffect(outcomeKind: 'nat20' | 'critfail'): void {
    if (!this.scene) return;
    const origin = new Vector3(0, 0.65, 0);
    if (outcomeKind === 'nat20') {
      const preset = resolveNat20Effect(this.currentCustom.nat20EffectId);
      this.soundService.playCriticalSuccessFanfare(this.currentCustom.soundProfileId);
      this.critEffectsRunner.triggerCritEffect(preset, origin, this.scene, this.glowLayer, 0.52 * this.currentCustom.glowIntensity);
    } else {
      const preset = resolveCritFailEffect(this.currentCustom.critFailEffectId);
      this.soundService.playCriticalFailureFracture();
      this.critEffectsRunner.triggerCritEffect(preset, origin, this.scene, this.glowLayer, 0.42 * this.currentCustom.glowIntensity);
    }
  }

  animateRoll(expression: string, diceResults: number[], isCriticalSuccess: boolean, isCriticalFailure: boolean): void {
    if (!this.scene) return;
    if (this.rollAnimationTimer !== null) {
      clearTimeout(this.rollAnimationTimer);
      this.rollAnimationTimer = null;
    }

    this.clearFloatingBadges();
    this.critEffectsRunner.clearActiveEffects();
    this.isRolling = true;

    const dieType = this.parseDieTypeFromExpression(expression);
    const results = diceResults.length > 0 ? diceResults : [20];
    const model = resolveDiceModel(this.currentCustom.modelId);
    const sizeScale = (DICE_SIZE_SCALE_MAP[this.currentCustom.sizePreset] ?? 1.0) * (model.scaleMultiplier ?? 1.0);

    this.clearActiveDice();
    const plans: DiePhysicsTrajectoryPlan[] = [];

    for (let i = 0; i < results.length; i++) {
      const built = buildBabylonPolyhedralDie(`lw-roll-die-${i}`, dieType, this.currentSkin, this.currentCustom, model, this.scene);
      const plan = createDieTrajectoryPlan(i, results.length, dieType, results[i], sizeScale);
      built.mesh.position.copyFrom(plan.startPos);
      built.mesh.rotationQuaternion = plan.startQuat.clone();
      this.activeDice.push(built);
      plans.push(plan);
    }

    this.soundService.playRollStartClatter(this.currentCustom.soundProfileId, results.length);
    const startTime = performance.now();
    const durationMs = 880;

    const step = () => {
      if (!this.scene) return;
      const t = Math.min(1, (performance.now() - startTime) / durationMs);

      for (let i = 0; i < this.activeDice.length; i++) {
        const pose = evaluateDieTrajectoryStep(plans[i], t, sizeScale, intensity => {
          if (i <= 1) this.soundService.playBounceImpact(this.currentCustom.soundProfileId, intensity);
        });
        this.activeDice[i].mesh.position.copyFrom(pose.position);
        this.activeDice[i].mesh.rotationQuaternion = pose.rotationQuaternion;
      }

      if (t < 1) {
        this.rollAnimationTimer = window.setTimeout(step, 16);
      } else {
        this.isRolling = false;
        this.rollAnimationTimer = null;
        this.soundService.playSettleChime(this.currentCustom.soundProfileId);

        for (let i = 0; i < this.activeDice.length; i++) {
          const die = this.activeDice[i];
          const val = results[i];
          die.mesh.rotationQuaternion = getRotationForTopValue(dieType, val);
          this.activeBadges.push(
            createFloatingResultBadge(
              val, die.mesh.position, this.currentCustom.glowColorHex,
              isCriticalSuccess && val === Math.max(...FACE_VALUES[dieType]),
              isCriticalFailure && val === 1, this.scene
            )
          );
        }

        if (isCriticalSuccess) this.previewCritOutcomeEffect('nat20');
        else if (isCriticalFailure) this.previewCritOutcomeEffect('critfail');
      }
    };
    step();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.rollAnimationTimer !== null) clearTimeout(this.rollAnimationTimer);
    this.rollAnimationTimer = null;
    this.critEffectsRunner.clearActiveEffects();
    this.clearFloatingBadges();
    this.clearActiveDice();
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
  }

  private syncStageLightingAndRebuild(): void {
    if (!this.scene) return;
    const glowColor = hexToColor3(this.currentCustom.glowColorHex || this.currentSkin.emissiveColor);
    if (this.accentPointLight) this.accentPointLight.diffuse = glowColor;
    if (this.trayRimMat) this.trayRimMat.emissiveColor = glowColor.scale(0.28 * this.currentCustom.glowIntensity);
    if (this.glowLayer) this.glowLayer.intensity = 0.48 * this.currentCustom.glowIntensity;
    if (!this.isRolling) this.rebuildShowcaseDice();
  }

  private rebuildShowcaseDice(): void {
    if (!this.scene) return;
    this.clearFloatingBadges();
    this.clearActiveDice();

    const model = resolveDiceModel(this.currentCustom.modelId);
    const types = this.focusDieType === 'all' ? SHOWCASE_DIE_TYPES : [this.focusDieType];

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const built = buildBabylonPolyhedralDie(`lw-showcase-${type}`, type, this.currentSkin, this.currentCustom, model, this.scene);
      if (types.length === 1) {
        built.mesh.position = new Vector3(0, 1.15, 0);
        built.mesh.scaling.setAll(1.45);
      } else {
        const angle = (i / types.length) * Math.PI * 2 - Math.PI / 2;
        built.mesh.position = new Vector3(Math.cos(angle) * 3.25, 0.98, Math.sin(angle) * 3.25);
      }
      const topQuat = getRotationForTopValue(type, Math.max(...FACE_VALUES[type]));
      built.mesh.rotation = topQuat.toEulerAngles();
      built.mesh.rotationQuaternion = null;
      this.activeDice.push(built);
    }
  }

  private buildOctagonalTray(scene: Scene): void {
    const floor = MeshBuilder.CreateCylinder('lw-tray-floor', { diameter: 11.4, height: 0.35, tessellation: 8 }, scene);
    floor.position.y = -0.18;
    const floorMat = new StandardMaterial('lw-tray-floor-mat', scene);
    floorMat.diffuseColor = new Color3(0.035, 0.085, 0.065);
    floorMat.specularColor = new Color3(0.08, 0.16, 0.12);
    floor.material = floorMat;

    const rim = MeshBuilder.CreateTorus('lw-tray-rim', { diameter: 11.5, thickness: 0.42, tessellation: 8 }, scene);
    rim.position.y = 0.08;
    const rimMat = new StandardMaterial('lw-tray-rim-mat', scene);
    rimMat.diffuseColor = new Color3(0.14, 0.12, 0.08);
    rimMat.specularColor = new Color3(0.55, 0.46, 0.28);
    rimMat.emissiveColor = hexToColor3(this.currentCustom.glowColorHex).scale(0.22);
    rim.material = rimMat;
    this.trayRimMat = rimMat;
  }

  private parseDieTypeFromExpression(expression: string): DicePolyhedronType {
    const match = /d(100|20|12|10|8|6|4)\b/i.exec(expression || '1d20');
    return match ? (`d${match[1]}` as DicePolyhedronType) : 'd20';
  }

  private clearActiveDice(): void {
    for (const d of this.activeDice) {
      disposeDieMaterials(d);
      d.mesh.dispose();
    }
    this.activeDice = [];
  }

  private clearFloatingBadges(): void {
    for (const badge of this.activeBadges) {
      badge.material?.dispose();
      badge.dispose();
    }
    this.activeBadges = [];
  }
}
