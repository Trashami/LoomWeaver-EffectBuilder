import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  ShadowGenerator,
  SpotLight,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { LightSourceNode } from '../map-scene-contract';
import { TerrainMeshBuilder } from '../terrain/terrain-mesh.builder';

export interface CelestialLightConfig {
  readonly mode: 'sun' | 'moon';
  readonly azimuthDeg: number;
  readonly altitudeDeg: number;
  readonly shadowDarkness: number;
  readonly showSkyOrb?: boolean;
}

export class SceneLightingController {
  private static shadowGen: ShadowGenerator | null = null;
  private static currentCelestial: CelestialLightConfig = {
    mode: 'sun',
    azimuthDeg: 135,
    altitudeDeg: 42,
    shadowDarkness: 72,
    showSkyOrb: false,
  };

  static syncLights(
    scene: Scene,
    lightNodes: readonly LightSourceNode[],
    celestial?: CelestialLightConfig,
  ): void {
    if (celestial) {
      this.currentCelestial = celestial;
    }

    scene.lights
      .filter((l) => l.name.startsWith('lw-point-light-'))
      .forEach((l) => l.dispose());
    scene.meshes
      .filter((m) => m.name.startsWith('lw-light-orb-') || m.name.startsWith('lw-light-ring-'))
      .forEach((m) => m.dispose());

    this.syncCelestialDirectionalLight(scene, this.currentCelestial);

    for (const node of lightNodes) {
      const kind = node.kind ?? 'torch';
      const groundY = TerrainMeshBuilder.sampleElevationAt(scene, node.x, node.z);
      const lightY = groundY + (node.y ?? 2.4);
      const col = Color3.FromHexString(node.colorHex || '#ffae52');
      const widthM = Math.max(0.4, node.widthMeters ?? 1.8);
      const lightMeta = {
        lwNodeName: `lw-light-${node.id}`,
        lwKind: 'light' as const,
        lwEntityId: node.id,
      };

      if (kind === 'spotlight') {
        const spot = new SpotLight(
          `lw-point-light-${node.id}`,
          new Vector3(node.x, lightY + 1.5, node.z),
          new Vector3(0, -1, 0),
          Math.min(Math.PI * 0.65, 0.35 + widthM * 0.14),
          2.2,
          scene,
        );
        spot.diffuse = col;
        spot.range = node.range * 1.4;
        spot.intensity = node.intensity * 1.35;
      } else {
        const pt = new PointLight(
          `lw-point-light-${node.id}`,
          new Vector3(node.x, lightY, node.z),
          scene,
        );
        pt.diffuse = col;
        pt.range = node.range * (kind === 'area' ? 1.35 : 1.0);
        pt.intensity = node.intensity * (kind === 'candle' ? 0.72 : kind === 'area' ? 1.25 : 1.0);
      }

      // Ground placement width ring / illumination pool
      const pts: Vector3[] = [];
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const rx = node.x + Math.cos(a) * widthM;
        const rz = node.z + Math.sin(a) * widthM;
        const ry = TerrainMeshBuilder.sampleElevationAt(scene, rx, rz) + 0.06;
        pts.push(new Vector3(rx, ry, rz));
      }
      const ring = MeshBuilder.CreateLines(`lw-light-ring-${node.id}`, { points: pts }, scene);
      ring.color = col;
      ring.isPickable = false;

      if (node.showFixture === false) {
        // Subtle clickable floor disc so invisible lights can still be selected
        const pickDisc = MeshBuilder.CreateDisc(
          `lw-light-orb-${node.id}`,
          { radius: Math.max(0.45, widthM * 0.4), tessellation: 18 },
          scene,
        );
        pickDisc.rotation.x = Math.PI / 2;
        pickDisc.position.set(node.x, groundY + 0.05, node.z);
        const discMat = new StandardMaterial(`lw-light-mat-${node.id}`, scene);
        discMat.emissiveColor = col;
        discMat.alpha = 0.25;
        pickDisc.material = discMat;
        pickDisc.metadata = lightMeta;
        continue;
      }

      const emitMat = new StandardMaterial(`lw-light-mat-${node.id}`, scene);
      emitMat.emissiveColor = col;
      emitMat.diffuseColor = col;

      if (kind === 'torch') {
        const post = MeshBuilder.CreateCylinder(
          `lw-light-orb-${node.id}`,
          { height: 1.15, diameterTop: 0.24, diameterBottom: 0.1, tessellation: 8 },
          scene,
        );
        post.position.set(node.x, groundY + 0.6, node.z);
        post.material = emitMat;
        post.metadata = lightMeta;
      } else if (kind === 'candle') {
        const candle = MeshBuilder.CreateCylinder(
          `lw-light-orb-${node.id}`,
          { height: 0.42, diameter: 0.16, tessellation: 10 },
          scene,
        );
        candle.position.set(node.x, groundY + 0.22, node.z);
        candle.material = emitMat;
        candle.metadata = lightMeta;
      } else if (kind === 'lantern') {
        const lantern = MeshBuilder.CreateBox(
          `lw-light-orb-${node.id}`,
          { width: 0.36, height: 0.52, depth: 0.36 },
          scene,
        );
        lantern.position.set(node.x, groundY + 0.3, node.z);
        lantern.material = emitMat;
        lantern.metadata = lightMeta;
      } else if (kind === 'area' || kind === 'glow') {
        const pad = MeshBuilder.CreateDisc(
          `lw-light-orb-${node.id}`,
          { radius: widthM, tessellation: 24 },
          scene,
        );
        pad.rotation.x = Math.PI / 2;
        pad.position.set(node.x, groundY + 0.05, node.z);
        emitMat.alpha = kind === 'glow' ? 0.45 : 0.28;
        pad.material = emitMat;
        pad.metadata = lightMeta;
      } else {
        const cone = MeshBuilder.CreateCylinder(
          `lw-light-orb-${node.id}`,
          { height: 0.55, diameterTop: 0.12, diameterBottom: 0.44, tessellation: 12 },
          scene,
        );
        cone.position.set(node.x, groundY + 0.35, node.z);
        cone.material = emitMat;
        cone.metadata = lightMeta;
      }
    }
  }

  static syncCelestialDirectionalLight(scene: Scene, config: CelestialLightConfig): void {
    this.currentCelestial = config;

    let hemi = scene.getLightByName('lw-hemi-light') as HemisphericLight | null;
    if (!hemi) {
      hemi = new HemisphericLight('lw-hemi-light', new Vector3(0, 1, 0), scene);
    }
    hemi.intensity = config.mode === 'sun' ? 0.52 : 0.28;
    hemi.diffuse = Color3.FromHexString(config.mode === 'sun' ? '#f6efe2' : '#89b4f8');
    hemi.groundColor = Color3.FromHexString(config.mode === 'sun' ? '#13241c' : '#060d14');

    const azRad = (config.azimuthDeg * Math.PI) / 180;
    const altRad = (Math.max(8, Math.min(88, config.altitudeDeg)) * Math.PI) / 180;
    const orbitRadius = 26;
    const lx = Math.cos(altRad) * Math.cos(azRad) * orbitRadius;
    const ly = Math.sin(altRad) * orbitRadius;
    const lz = Math.cos(altRad) * Math.sin(azRad) * orbitRadius;

    const lightPos = new Vector3(lx, ly, lz);
    const lightDir = lightPos.scale(-1).normalize();

    let dirLight = scene.getLightByName('lw-celestial-dir') as DirectionalLight | null;
    if (!dirLight) {
      dirLight = new DirectionalLight('lw-celestial-dir', lightDir, scene);
      this.shadowGen = new ShadowGenerator(1024, dirLight);
      this.shadowGen.useBlurExponentialShadowMap = true;
      this.shadowGen.blurKernel = 12;
    } else {
      dirLight.direction.copyFrom(lightDir);
    }

    dirLight.position.copyFrom(lightPos);
    dirLight.intensity = config.mode === 'sun' ? 1.45 : 0.88;
    dirLight.diffuse = Color3.FromHexString(config.mode === 'sun' ? '#ffefd2' : '#9cc5ff');
    dirLight.specular = Color3.FromHexString(config.mode === 'sun' ? '#ffe0a3' : '#6c9be0');

    if (this.shadowGen) {
      this.shadowGen.darkness = Math.max(0, Math.min(0.95, (100 - config.shadowDarkness) / 100));
    }

    let skyOrb = scene.getMeshByName('lw-celestial-sky-orb') as Mesh | null;
    if (!skyOrb) {
      skyOrb = MeshBuilder.CreateSphere(
        'lw-celestial-sky-orb',
        { diameter: 1.35, segments: 12 },
        scene,
      );
      skyOrb.isPickable = false;
      const skyMat = new StandardMaterial('lw-celestial-sky-mat', scene);
      skyOrb.material = skyMat;
    }

    const skyMat = skyOrb.material as StandardMaterial | null;
    if (skyMat) {
      skyMat.emissiveColor = Color3.FromHexString(
        config.mode === 'sun' ? '#ffd269' : '#9ec8ff',
      );
      skyMat.diffuseColor = skyMat.emissiveColor;
    }
    skyOrb.position.set(lx * 0.55, Math.max(4.2, ly * 0.45), lz * 0.55);
    skyOrb.setEnabled(Boolean(config.showSkyOrb));
  }

  static refreshShadowCasters(scene: Scene): void {
    if (!this.shadowGen) return;
    const shadowMap = this.shadowGen.getShadowMap();
    if (!shadowMap) return;
    shadowMap.renderList = [];
    for (const mesh of scene.meshes) {
      if (
        mesh.name.startsWith('lw-wall-') ||
        mesh.name.startsWith('lw-door-') ||
        mesh.name.startsWith('lw-stamp-') ||
        Boolean(mesh.metadata?.lwNodeName)
      ) {
        shadowMap.renderList.push(mesh);
      }
    }
  }
}
