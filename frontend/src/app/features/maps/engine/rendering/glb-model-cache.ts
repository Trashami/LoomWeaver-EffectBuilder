import '@babylonjs/loaders/glTF';
import {
  AbstractMesh,
  Color3,
  MeshoptCompression,
  PBRMaterial,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';

export interface CachedGlbTemplate {
  readonly url: string;
  readonly templatePivot: TransformNode;
  readonly rawWidth: number;
  readonly rawHeight: number;
  readonly rawDepth: number;
}

export interface GlbCloneMetadata {
  readonly lwNodeName: string;
  readonly lwKind?: 'wall' | 'door' | 'object' | 'light';
  readonly lwEntityId?: string;
  readonly lwWallId?: string;
}

export class GlbModelCache {
  private static cache = new Map<string, CachedGlbTemplate>();
  private static pending = new Map<string, Promise<CachedGlbTemplate | null>>();
  private static failedUrls = new Set<string>();
  private static activeScene: Scene | null = null;
  private static decoderConfigured = false;

  static ensureScene(scene: Scene): void {
    if (!this.decoderConfigured) {
      try {
        MeshoptCompression.Configuration.decoder = {
          url: '/assets/object-library/meshopt_decoder.js',
        };
      } catch {
        // Use default meshopt configuration fallback
      }
      this.decoderConfigured = true;
    }
    if (this.activeScene !== scene) {
      this.cache.clear();
      this.pending.clear();
      this.activeScene = scene;
    }
  }

  static getOrLoadTemplate(
    scene: Scene,
    modelUrl: string,
    onLoaded?: () => void,
  ): CachedGlbTemplate | null {
    this.ensureScene(scene);
    if (!modelUrl || !modelUrl.toLowerCase().endsWith('.glb')) {
      return null;
    }
    if (this.failedUrls.has(modelUrl)) {
      return null;
    }
    const existing = this.cache.get(modelUrl);
    if (existing) {
      return existing;
    }
    if (!this.pending.has(modelUrl)) {
      const loadPromise = this.loadGlbTemplateAsync(scene, modelUrl).then((tpl) => {
        this.pending.delete(modelUrl);
        if (tpl) {
          if (onLoaded) {
            onLoaded();
          }
        } else {
          this.failedUrls.add(modelUrl);
        }
        return tpl;
      });
      this.pending.set(modelUrl, loadPromise);
    }
    return null;
  }

  private static async loadGlbTemplateAsync(
    scene: Scene,
    modelUrl: string,
  ): Promise<CachedGlbTemplate | null> {
    try {
      const lastSlash = modelUrl.lastIndexOf('/');
      const rootUrl = modelUrl.slice(0, lastSlash + 1);
      const fileName = modelUrl.slice(lastSlash + 1);
      const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
      if (scene.isDisposed) {
        return null;
      }

      const templatePivot = new TransformNode(`lw-glb-tpl-${fileName}`, scene);
      const rootMesh = result.meshes[0];
      if (rootMesh) {
        rootMesh.parent = templatePivot;
      }

      for (const m of result.meshes) {
        m.computeWorldMatrix(true);
        if (m.material instanceof PBRMaterial) {
          m.material.maxSimultaneousLights = 8;
          m.material.directIntensity = 1.5;
          m.material.environmentIntensity = 0.72;
        } else if (m.material instanceof StandardMaterial) {
          m.material.maxSimultaneousLights = 8;
        }
      }

      const bounds = templatePivot.getHierarchyBoundingVectors(true);
      const size = bounds.max.subtract(bounds.min);
      const rawWidth = Math.max(0.1, size.x);
      const rawHeight = Math.max(0.1, size.y);
      const rawDepth = Math.max(0.1, size.z);
      const center = bounds.min.add(bounds.max).scale(0.5);

      if (rootMesh) {
        rootMesh.position.set(-center.x, -bounds.min.y, -center.z);
      }

      templatePivot.setEnabled(false);

      const entry: CachedGlbTemplate = {
        url: modelUrl,
        templatePivot,
        rawWidth,
        rawHeight,
        rawDepth,
      };
      this.cache.set(modelUrl, entry);
      return entry;
    } catch {
      return null;
    }
  }

  static instantiateClone(
    scene: Scene,
    template: CachedGlbTemplate,
    instanceName: string,
    targetWidth: number,
    targetHeight: number,
    targetDepth: number,
    uniformScale: boolean,
    isGhost = false,
    meta?: GlbCloneMetadata,
  ): TransformNode {
    const wrapper = new TransformNode(instanceName, scene);
    const cloned = template.templatePivot.clone(`${instanceName}-pivot`, wrapper);
    if (cloned) {
      cloned.setEnabled(true);
      if (uniformScale) {
        const maxSpan = Math.max(template.rawWidth, template.rawHeight, template.rawDepth);
        const s = targetHeight / maxSpan;
        cloned.scaling.setAll(s);
      } else {
        const useZAsLength = template.rawDepth > template.rawWidth * 1.35;
        if (useZAsLength) {
          cloned.rotation.y = Math.PI / 2;
          cloned.scaling.set(
            targetDepth / template.rawWidth,
            targetHeight / template.rawHeight,
            targetWidth / template.rawDepth,
          );
        } else {
          cloned.scaling.set(
            targetWidth / template.rawWidth,
            targetHeight / template.rawHeight,
            targetDepth / template.rawDepth,
          );
        }
      }

      const resolvedMeta: GlbCloneMetadata = meta ?? { lwNodeName: instanceName };
      wrapper.metadata = resolvedMeta;

      const childMeshes: AbstractMesh[] = cloned.getChildMeshes(false);
      for (const m of childMeshes) {
        m.setEnabled(true);
        m.isPickable = !isGhost && m.getTotalVertices() > 0;
        m.receiveShadows = !isGhost;
        m.metadata = resolvedMeta;
        if (isGhost) {
          const ghostMat = new StandardMaterial(`${instanceName}-ghost-mat`, scene);
          ghostMat.diffuseColor = Color3.FromHexString('#49e892');
          ghostMat.emissiveColor = Color3.FromHexString('#2ee66b').scale(0.5);
          ghostMat.alpha = 0.48;
          m.material = ghostMat;
        }
      }
    }
    return wrapper;
  }
}
