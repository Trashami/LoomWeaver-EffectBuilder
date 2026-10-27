import { Injectable, signal } from '@angular/core';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';
import {
  CelestialLightConfig,
  SceneLightingController,
} from '../lighting/scene-lighting.controller';
import {
  MapRenderMode,
  MapSceneGraphState,
  MapStampNode,
  WallDrawMode,
} from '../map-scene-contract';
import { PathRibbonEngine } from '../paths/path-ribbon.engine';
import { SeededScatterEngine } from '../scatter/seeded-scatter.engine';
import { TerrainMeshBuilder } from '../terrain/terrain-mesh.builder';
import { WallMeshBuilder } from '../walls/wall-mesh.builder';
import { WaterSplineBuilder } from '../water/water-spline.builder';
import { GlbModelCache } from './glb-model-cache';

export interface GhostAssetConfig {
  readonly enabled: boolean;
  readonly label: string;
  readonly kind: 'prop' | 'wall' | 'light' | 'terrain' | 'decal';
  readonly modelUrl?: string;
  readonly albedoUrl?: string;
  readonly normalUrl?: string;
  readonly scale: number;
  readonly rotationRad: number;
  readonly heightMeters: number;
  readonly thicknessMeters: number;
  readonly wallDrawMode: WallDrawMode;
}

@Injectable({ providedIn: 'root' })
export class BabylonMapStageService {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;
  private selectedPosition: Vector3 | null = null;
  private hideGmSecrets = false;
  private snapToGrid = true;
  private lastState: MapSceneGraphState | null = null;
  private pointerDownClientX = 0;
  private pointerDownClientY = 0;
  private ghostConfig: GhostAssetConfig = {
    enabled: false,
    label: 'Stone Wall Segment',
    kind: 'wall',
    scale: 1,
    rotationRad: 0,
    heightMeters: 3.0,
    thicknessMeters: 0.45,
    wallDrawMode: 'line',
  };
  private wallStartAnchor: { x: number; z: number } | null = null;

  readonly fps = signal<number>(60);
  readonly activeInstanceCount = signal<number>(0);
  readonly lastPickedCoords = signal<{ x: number; z: number }>({ x: 0, z: 0 });
  readonly hoverCoords = signal<{ x: number; z: number }>({ x: 0, z: 0 });

  mountCanvas(
    canvas: HTMLCanvasElement,
    initialState: MapSceneGraphState,
    onGroundClicked: (x: number, z: number, pickedMeshName?: string) => void,
    onGroundHovered?: (x: number, z: number) => void,
  ): void {
    this.dispose();

    try {
      this.engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      this.scene = new Scene(this.engine);
      this.scene.clearColor = new Color4(0.02, 0.06, 0.04, 1);
      this.scene.shadowsEnabled = true;
      GlbModelCache.ensureScene(this.scene);

      this.camera = new ArcRotateCamera(
        'lw-map-cam',
        -Math.PI / 2.25,
        0.78,
        26,
        Vector3.Zero(),
        this.scene,
      );
      this.camera.lowerRadiusLimit = 6;
      this.camera.upperRadiusLimit = 58;
      this.camera.wheelPrecision = 18;
      this.camera.attachControl(canvas, true);

      this.scene.onPointerObservable.add((pointerInfo) => {
        if (!this.scene) return;

        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          const evt = pointerInfo.event as PointerEvent;
          this.pointerDownClientX = evt.clientX;
          this.pointerDownClientY = evt.clientY;
          return;
        }

        const pick = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY,
          (m) =>
            m.name === 'lw-terrain-ground' ||
            m.name.startsWith('lw-wall-') ||
            m.name.startsWith('lw-stamp-') ||
            Boolean(m.metadata?.lwNodeName),
        );
        if (!pick?.hit || !pick.pickedPoint) return;

        const rawX = pick.pickedPoint.x;
        const rawZ = pick.pickedPoint.z;
        const useExactPointer = !this.snapToGrid || this.ghostConfig.kind === 'terrain';
        const gx = useExactPointer ? Math.round(rawX * 100) / 100 : Math.round(rawX * 2) / 2;
        const gz = useExactPointer ? Math.round(rawZ * 100) / 100 : Math.round(rawZ * 2) / 2;

        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          this.hoverCoords.set({ x: gx, z: gz });
          this.updateGhostMeshAt(gx, gz);
          if (onGroundHovered) {
            onGroundHovered(gx, gz);
          }
        } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
          const evt = pointerInfo.event as PointerEvent;
          const dragDist = Math.hypot(
            evt.clientX - this.pointerDownClientX,
            evt.clientY - this.pointerDownClientY,
          );
          // Ignore camera orbit/pan drags or right-clicks
          if (evt.button !== 0 || dragDist > 6) {
            return;
          }
          this.lastPickedCoords.set({ x: gx, z: gz });
          const pickedName =
            (pick.pickedMesh?.metadata?.lwNodeName as string | undefined) ??
            pick.pickedMesh?.name;
          onGroundClicked(gx, gz, pickedName);
        }
      });

      this.syncSceneGraph(initialState);

      this.engine.runRenderLoop(() => {
        if (this.scene && this.engine) {
          this.scene.render();
          this.fps.set(Math.round(this.engine.getFps()));
        }
      });
    } catch {
      // Headless or non-WebGL browser environment fallback
    }
  }

  setSnapToGrid(snap: boolean): void {
    this.snapToGrid = snap;
  }

  setGhostConfig(config: GhostAssetConfig, wallAnchor: { x: number; z: number } | null): void {
    this.ghostConfig = config;
    this.wallStartAnchor = wallAnchor;
    if (this.scene && config.modelUrl) {
      GlbModelCache.getOrLoadTemplate(this.scene, config.modelUrl, () => {
        const h = this.hoverCoords();
        this.updateGhostMeshAt(h.x, h.z);
      });
    }
    const h = this.hoverCoords();
    this.updateGhostMeshAt(h.x, h.z);
  }

  private clearGhostMeshes(): void {
    if (!this.scene) return;
    this.scene.transformNodes
      .filter((n) => n.name.startsWith('lw-ghost-'))
      .forEach((n) => n.dispose());
    this.scene.meshes
      .filter((m) => m.name.startsWith('lw-ghost-'))
      .forEach((m) => m.dispose());
  }

  private updateGhostMeshAt(gx: number, gz: number): void {
    if (!this.scene) return;
    this.clearGhostMeshes();

    if (!this.ghostConfig.enabled) return;

    if (this.ghostConfig.kind === 'wall' && this.wallStartAnchor) {
      WallMeshBuilder.renderGhostWallPreview(
        this.scene,
        this.ghostConfig.wallDrawMode,
        this.wallStartAnchor.x,
        this.wallStartAnchor.z,
        gx,
        gz,
        this.ghostConfig.heightMeters,
        this.ghostConfig.thicknessMeters,
        this.ghostConfig.modelUrl,
      );
      return;
    }

    const groundY = TerrainMeshBuilder.sampleElevationAt(this.scene, gx, gz);

    // Terrain brush: ONLY an outline circle conforming to the terrain (no filled 3D cylinder)
    if (this.ghostConfig.kind === 'terrain') {
      const radius = Math.max(1.0, this.ghostConfig.scale);
      const pts: Vector3[] = [];
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const px = gx + Math.cos(angle) * radius;
        const pz = gz + Math.sin(angle) * radius;
        const py = TerrainMeshBuilder.sampleElevationAt(this.scene, px, pz) + 0.08;
        pts.push(new Vector3(px, py, pz));
      }
      const ring = MeshBuilder.CreateLines('lw-ghost-terrain-ring', { points: pts }, this.scene);
      ring.color = Color3.FromHexString('#49e892');
      ring.isPickable = false;
      return;
    }

    // 2D Cutout Stamp Decal Ghost
    if (this.ghostConfig.kind === 'decal' && this.ghostConfig.albedoUrl) {
      const size = 2.6 * this.ghostConfig.scale;
      const decal = MeshBuilder.CreateGround(
        'lw-ghost-cursor-decal',
        { width: size, height: size },
        this.scene,
      );
      decal.position.set(gx, groundY + 0.05, gz);
      decal.rotation.y = this.ghostConfig.rotationRad;
      const dMat = new StandardMaterial('lw-ghost-decal-mat', this.scene);
      const tex = new Texture(this.ghostConfig.albedoUrl, this.scene);
      tex.hasAlpha = true;
      dMat.diffuseTexture = tex;
      dMat.useAlphaFromDiffuseTexture = true;
      dMat.alpha = 0.72;
      decal.material = dMat;
      decal.isPickable = false;
      return;
    }

    // 3D GLB Model Ghost
    if (this.ghostConfig.modelUrl) {
      const tpl = GlbModelCache.getOrLoadTemplate(this.scene, this.ghostConfig.modelUrl);
      if (tpl) {
        const isWall = this.ghostConfig.kind === 'wall';
        const inst = GlbModelCache.instantiateClone(
          this.scene,
          tpl,
          'lw-ghost-cursor-glb',
          isWall ? 2.2 : 2.2 * this.ghostConfig.scale,
          isWall ? this.ghostConfig.heightMeters : 2.2 * this.ghostConfig.scale,
          isWall ? this.ghostConfig.thicknessMeters : 2.2 * this.ghostConfig.scale,
          !isWall,
          true,
        );
        inst.position.set(gx, groundY, gz);
        inst.rotation.y = this.ghostConfig.rotationRad;
        return;
      }
    }

    const mat = new StandardMaterial('lw-ghost-cursor-mat', this.scene);
    mat.diffuseColor = Color3.FromHexString('#49e892');
    mat.emissiveColor = Color3.FromHexString('#2ee66b').scale(0.5);
    mat.alpha = 0.42;

    if (this.ghostConfig.kind === 'light') {
      const orb = MeshBuilder.CreateSphere(
        'lw-ghost-cursor-mesh',
        { diameter: 0.75, segments: 12 },
        this.scene,
      );
      orb.position.set(gx, groundY + 2.2, gz);
      orb.material = mat;
      orb.isPickable = false;
    }
  }

  applyFloorBumpMap(albedoUrl: string, normalUrl: string, tilingScale = 10): void {
    if (!this.scene) return;
    TerrainMeshBuilder.applyFloorBumpTexture(this.scene, albedoUrl, normalUrl, tilingScale);
  }

  resetTerrainElevations(): void {
    TerrainMeshBuilder.resetElevations();
    if (this.scene) {
      const existingGround = this.scene.getMeshByName('lw-terrain-ground');
      existingGround?.dispose();
      if (this.lastState) {
        TerrainMeshBuilder.buildTerrainAndGrid(
          this.scene,
          this.lastState.biome,
          this.lastState.terrainRelief,
        );
      }
    }
  }

  sculptTerrainAt(
    worldX: number,
    worldZ: number,
    radius: number,
    deltaY: number,
    mode: 'raise' | 'lower' | 'flatten',
  ): void {
    if (!this.scene) return;
    TerrainMeshBuilder.sculptElevationAt(this.scene, worldX, worldZ, radius, deltaY, mode);
    this.updateGhostMeshAt(worldX, worldZ);
  }

  updateCelestialLight(config: CelestialLightConfig): void {
    if (!this.scene) return;
    SceneLightingController.syncCelestialDirectionalLight(this.scene, config);
  }

  setGridMode(mode: string): void {
    if (!this.scene) return;
    TerrainMeshBuilder.setGridMode(this.scene, mode);
  }

  setCameraMode(mode: MapRenderMode | string): void {
    if (!this.camera) return;
    if (mode === '2D Blueprint' || mode === 'top-down' || mode === 'real-2d') {
      this.camera.alpha = -Math.PI / 2;
      this.camera.beta = 0.02;
      this.camera.radius = 31;
    } else if (mode === 'first-person') {
      this.camera.alpha = -Math.PI / 2.1;
      this.camera.beta = 1.32;
      this.camera.radius = 11;
    } else if (mode === '3D Tabletop' || mode === 'isometric') {
      this.camera.alpha = -Math.PI / 2.3;
      this.camera.beta = 0.78;
      this.camera.radius = 25;
    } else {
      this.camera.alpha = -Math.PI / 2.15;
      this.camera.beta = 0.65;
      this.camera.radius = 26;
    }
  }

  setQualityPreset(preset: string): void {
    if (!this.engine) return;
    if (preset === 'Cinematic 3D') {
      this.engine.setHardwareScalingLevel(0.85);
    } else if (preset === 'Performance 3D' || preset === 'Classic 2D') {
      this.engine.setHardwareScalingLevel(1.5);
    } else {
      this.engine.setHardwareScalingLevel(1.0);
    }
  }

  setPlayerSafeFilter(hideSecrets: boolean, state: MapSceneGraphState): void {
    this.hideGmSecrets = hideSecrets;
    this.syncSceneGraph(state);
  }

  focusGizmoAt(x: number | null, y = 0.1, z = 0): void {
    if (x === null) {
      this.selectedPosition = null;
    } else {
      this.selectedPosition = new Vector3(x, y, z);
    }
    this.rebuildSelectionGizmo();
  }

  syncSceneGraph(state: MapSceneGraphState): void {
    if (!this.scene) return;
    this.lastState = state;

    TerrainMeshBuilder.buildTerrainAndGrid(this.scene, state.biome, state.terrainRelief);
    WaterSplineBuilder.rebuildWaterSplines(this.scene, state.waterSplines);
    SceneLightingController.syncLights(this.scene, state.lights);
    const scatterCount =
      state.scatterDensity > 0
        ? SeededScatterEngine.rebuildScatterInstances(
            this.scene,
            state.scatterSeed,
            state.scatterDensity,
          )
        : this.clearScatterMeshes();
    const wallCount = WallMeshBuilder.rebuildWallMeshes(
      this.scene,
      state.walls,
      this.hideGmSecrets,
      () => {
        if (this.lastState) this.syncSceneGraph(this.lastState);
      },
    );
    const pathCount = PathRibbonEngine.rebuildPathRibbonMeshes(this.scene, state.pathRibbons);
    this.rebuildStamps(this.scene, state.stamps);
    SceneLightingController.refreshShadowCasters(this.scene);
    this.rebuildSelectionGizmo();
    this.activeInstanceCount.set(
      scatterCount + state.stamps.length + state.lights.length + wallCount + pathCount,
    );
  }

  private clearScatterMeshes(): number {
    if (!this.scene) return 0;
    this.scene.meshes
      .filter((m) => m.name.startsWith('lw-scatter-'))
      .forEach((m) => m.dispose());
    return 0;
  }

  private rebuildStamps(scene: Scene, stamps: readonly MapStampNode[]): void {
    scene.transformNodes
      .filter((n) => n.name.startsWith('lw-stamp-node-'))
      .forEach((n) => n.dispose());
    scene.meshes
      .filter((m) => m.name.startsWith('lw-stamp-'))
      .forEach((m) => m.dispose());

    for (const st of stamps) {
      if (this.hideGmSecrets && st.label.toLowerCase().includes('secret')) {
        continue;
      }
      const groundY = TerrainMeshBuilder.sampleElevationAt(scene, st.x, st.z);

      // 1. 2D Cutout Floor Stamp / Decal (e.g. Ancient Standing Stone Circle, Sarcophagus, Rug, Crater)
      if (st.albedoUrl && !st.modelUrl) {
        const size = 2.6 * st.scale;
        const decal = MeshBuilder.CreateGround(
          `lw-stamp-${st.id}`,
          { width: size, height: size },
          scene,
        );
        decal.position.set(st.x, groundY + 0.04, st.z);
        decal.rotation.y = st.rotationY;
        decal.receiveShadows = true;
        decal.metadata = { lwNodeName: `lw-stamp-${st.id}` };

        const dMat = new StandardMaterial(`lw-stamp-decal-mat-${st.id}`, scene);
        const diffTex = new Texture(st.albedoUrl, scene);
        diffTex.hasAlpha = true;
        dMat.diffuseTexture = diffTex;
        dMat.useAlphaFromDiffuseTexture = true;
        dMat.specularColor = Color3.FromHexString('#18221c');
        if (st.normalUrl) {
          const bumpTex = new Texture(st.normalUrl, scene);
          bumpTex.level = 1.25;
          dMat.bumpTexture = bumpTex;
        }
        decal.material = dMat;
        continue;
      }

      // 2. Real 3D .glb Asset Model
      if (st.modelUrl) {
        const tpl = GlbModelCache.getOrLoadTemplate(scene, st.modelUrl, () => {
          if (this.lastState) {
            this.rebuildStamps(scene, this.lastState.stamps);
            SceneLightingController.refreshShadowCasters(scene);
          }
        });
        if (tpl) {
          const inst = GlbModelCache.instantiateClone(
            scene,
            tpl,
            `lw-stamp-node-${st.id}`,
            2.2 * st.scale,
            2.2 * st.scale,
            2.2 * st.scale,
            true,
            false,
          );
          inst.position.set(st.x, groundY, st.z);
          inst.rotation.y = st.rotationY;
          continue;
        }
      }

      // 3. Fallback tabletop token disc only if neither modelUrl nor albedoUrl is present
      const mesh: Mesh = MeshBuilder.CreateCylinder(
        `lw-stamp-${st.id}`,
        { height: 0.45, diameter: 1.45 * st.scale, tessellation: 24 },
        scene,
      );
      mesh.position.set(st.x, groundY + 0.25, st.z);
      mesh.rotation.y = st.rotationY;
      mesh.receiveShadows = true;
      mesh.metadata = { lwNodeName: `lw-stamp-${st.id}` };

      const mat = new StandardMaterial(`lw-stamp-mat-${st.id}`, scene);
      mat.diffuseColor = Color3.FromHexString(st.colorHex || '#49e892');
      mesh.material = mat;
    }
  }

  private rebuildSelectionGizmo(): void {
    if (!this.scene) return;
    this.scene.meshes
      .filter((m) => m.name.startsWith('lw-gizmo-'))
      .forEach((m) => m.dispose());

    if (!this.selectedPosition) return;

    const pos = this.selectedPosition;
    const pts: Vector3[] = [];
    const r = 1.45;
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      pts.push(new Vector3(pos.x + Math.cos(a) * r, pos.y + 0.06, pos.z + Math.sin(a) * r));
    }
    const selRing = MeshBuilder.CreateLines('lw-gizmo-ring', { points: pts }, this.scene);
    selRing.color = Color3.FromHexString('#49e892');
    selRing.isPickable = false;
  }

  resize(): void {
    this.engine?.resize();
  }

  dispose(): void {
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.camera = null;
  }
}
