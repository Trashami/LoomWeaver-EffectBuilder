import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
} from '@babylonjs/core';
import { MapWallSegmentNode, WallDrawMode, WallOpeningNode } from '../map-scene-contract';
import { GlbModelCache } from '../rendering/glb-model-cache';
import { TerrainMeshBuilder } from '../terrain/terrain-mesh.builder';
import { CutawayWallEngine } from './cutaway-wall.engine';

export interface WallDoorAttachmentHit {
  readonly wallId: string;
  readonly t: number;
  readonly x: number;
  readonly z: number;
  readonly angleY: number;
  readonly wallHeight: number;
  readonly wallThickness: number;
}

export class WallMeshBuilder {
  private static texCache = new Map<string, Texture>();
  private static activeScene: Scene | null = null;
  private static ghostMat: StandardMaterial | null = null;

  private static ensureSceneCache(scene: Scene): void {
    if (this.activeScene !== scene) {
      this.texCache.clear();
      this.ghostMat = null;
      this.activeScene = scene;
    }
  }

  private static getCachedTexture(scene: Scene, url: string): Texture {
    this.ensureSceneCache(scene);
    const existing = this.texCache.get(url);
    if (existing) {
      return existing;
    }
    const tex = new Texture(url, scene);
    this.texCache.set(url, tex);
    return tex;
  }

  private static getSharedGhostWallMat(scene: Scene): StandardMaterial {
    this.ensureSceneCache(scene);
    if (!this.ghostMat || this.ghostMat.getScene() !== scene) {
      const mat = new StandardMaterial('lw-ghost-wall-shared-mat', scene);
      mat.diffuseColor = Color3.FromHexString('#49e892');
      mat.emissiveColor = Color3.FromHexString('#2ee66b').scale(0.5);
      mat.alpha = 0.5;
      this.ghostMat = mat;
    }
    return this.ghostMat;
  }

  static buildShapePoints(
    mode: WallDrawMode,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    freehandPoints?: readonly (readonly [number, number])[],
    snapToGrid = true,
  ): (readonly [number, number])[] {
    const snapPt = (x: number, z: number): [number, number] => {
      if (!snapToGrid) {
        return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
      }
      const s = TerrainMeshBuilder.snapWorldCoordinates(x, z, true, 'wall');
      return [s.x, s.z];
    };

    if (mode === 'freehand' && freehandPoints && freehandPoints.length >= 2) {
      return freehandPoints.map(([px, pz]) => snapPt(px, pz));
    }

    const [sx, sz] = snapPt(startX, startZ);
    const [ex, ez] = snapPt(endX, endZ);

    if (mode === 'line') {
      return [
        [sx, sz],
        [ex, ez],
      ];
    }

    const minX = Math.min(sx, ex);
    const maxX = Math.max(sx, ex);
    const minZ = Math.min(sz, ez);
    const maxZ = Math.max(sz, ez);
    const w = Math.max(1.5, maxX - minX);
    const d = Math.max(1.5, maxZ - minZ);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const rx = w / 2;
    const rz = d / 2;

    if (mode === 'room') {
      return [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ];
    }
    if (mode === 'triangle') {
      return [snapPt(cx, maxZ), [maxX, minZ], [minX, minZ]];
    }
    if (mode === 'l_shape') {
      const [midX, midZ] = snapPt(minX + w * 0.5, minZ + d * 0.5);
      return [
        [minX, minZ],
        [maxX, minZ],
        [maxX, midZ],
        [midX, midZ],
        [midX, maxZ],
        [minX, maxZ],
      ];
    }
    if (mode === 't_shape') {
      const [x1, zBar] = snapPt(minX + w * 0.33, minZ + d * 0.6);
      const [x2] = snapPt(minX + w * 0.67, minZ);
      return [
        [x1, minZ],
        [x2, minZ],
        [x2, zBar],
        [maxX, zBar],
        [maxX, maxZ],
        [minX, maxZ],
        [minX, zBar],
        [x1, zBar],
      ];
    }
    if (mode === 'cross') {
      const [x1, z1] = snapPt(minX + w * 0.33, minZ + d * 0.33);
      const [x2, z2] = snapPt(minX + w * 0.67, minZ + d * 0.67);
      return [
        [x1, minZ],
        [x2, minZ],
        [x2, z1],
        [maxX, z1],
        [maxX, z2],
        [x2, z2],
        [x2, maxZ],
        [x1, maxZ],
        [x1, z2],
        [minX, z2],
        [minX, z1],
        [x1, z1],
      ];
    }

    const sides = mode === 'circle' ? 24 : mode === 'hexagon' ? 6 : 8;
    const pts: [number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pts.push([
        Math.round((cx + Math.cos(a) * rx) * 100) / 100,
        Math.round((cz + Math.sin(a) * rz) * 100) / 100,
      ]);
    }
    return pts;
  }

  static findClosestWallAttachment(
    walls: readonly MapWallSegmentNode[] | undefined,
    worldX: number,
    worldZ: number,
    maxSnapDist = 4.0,
  ): WallDoorAttachmentHit | null {
    if (!walls || walls.length === 0) return null;
    let bestHit: WallDoorAttachmentHit | null = null;
    let bestDist = maxSnapDist;

    for (const wall of walls) {
      const pts = wall.points;
      if (pts.length < 2) continue;
      const closed = wall.drawMode !== 'line' && wall.drawMode !== 'freehand';
      const segCount = closed ? pts.length : pts.length - 1;

      const segLengths: number[] = [];
      let totalPerimeter = 0;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        segLengths.push(len);
        totalPerimeter += len;
      }
      if (totalPerimeter < 0.2) continue;

      let accumBefore = 0;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const lenSq = dx * dx + dz * dz;
        const segLen = segLengths[i];
        if (segLen < 0.2) {
          accumBefore += segLen;
          continue;
        }
        let localT = ((worldX - a[0]) * dx + (worldZ - a[1]) * dz) / lenSq;
        localT = Math.max(0.12, Math.min(0.88, localT));
        const projX = a[0] + dx * localT;
        const projZ = a[1] + dz * localT;
        const dist = Math.hypot(worldX - projX, worldZ - projZ);
        if (dist < bestDist) {
          bestDist = dist;
          const globalT = (accumBefore + localT * segLen) / totalPerimeter;
          bestHit = {
            wallId: wall.id,
            t: Math.round(globalT * 1000) / 1000,
            x: Math.round(projX * 100) / 100,
            z: Math.round(projZ * 100) / 100,
            angleY: -Math.atan2(dz, dx),
            wallHeight: wall.heightMeters,
            wallThickness: wall.thicknessMeters,
          };
        }
        accumBefore += segLen;
      }
    }
    return bestHit;
  }

  private static createTexturedWallMaterial(
    scene: Scene,
    matName: string,
    wall: MapWallSegmentNode,
  ): StandardMaterial {
    const existing = scene.getMaterialByName(matName) as StandardMaterial | null;
    if (existing) {
      existing.dispose(false, false);
    }
    const mat = new StandardMaterial(matName, scene);
    const baseColorHex = wall.colorHex || CutawayWallEngine.materialHex(wall.material);
    const texUrl =
      wall.albedoUrl ||
      wall.thumbnailUrl ||
      '/assets/sewer-dungeon-wall-library-v1/512/worn-castle-flagstone.png';

    if (texUrl) {
      const diffTex = this.getCachedTexture(scene, texUrl);
      diffTex.uScale = 3.0;
      diffTex.vScale = 1.6;
      mat.diffuseTexture = diffTex;
      mat.diffuseColor = wall.colorHex
        ? Color3.FromHexString(wall.colorHex)
        : Color3.White();
      const normUrl =
        wall.normalUrl ||
        '/assets/sewer-dungeon-wall-library-v1/512/worn-castle-flagstone_normal.png';
      if (normUrl) {
        const bumpTex = this.getCachedTexture(scene, normUrl);
        bumpTex.uScale = 3.0;
        bumpTex.vScale = 1.6;
        bumpTex.level = 1.2;
        mat.bumpTexture = bumpTex;
      }
    } else {
      mat.diffuseColor = Color3.FromHexString(baseColorHex);
      mat.emissiveColor = Color3.FromHexString(baseColorHex).scale(0.12);
    }
    mat.specularColor = Color3.FromHexString('#1d2822');
    return mat;
  }

  /**
   * High-performance procedural 3D wall geometry builder:
   * Draws clean extruded box geometry per straight wall span first, then applies
   * the selected 2D wall bump/albedo texture & tint (zero heavy 3D GLB cloning along walls).
   */
  static rebuildWallMeshes(
    scene: Scene,
    walls: readonly MapWallSegmentNode[] | undefined,
    hideSecrets = false,
    onGlbLoaded?: () => void,
  ): number {
    this.ensureSceneCache(scene);
    scene.transformNodes
      .filter((n) => n.name.startsWith('lw-wall-node-') || n.name.startsWith('lw-door-node-'))
      .forEach((n) => n.dispose(false, false));
    scene.meshes
      .filter(
        (m) =>
          m.name.startsWith('lw-wall-') ||
          m.name.startsWith('lw-portal-') ||
          m.name.startsWith('lw-door-'),
      )
      .forEach((m) => m.dispose(false, false));

    if (!walls || walls.length === 0) return 0;
    let meshCount = 0;

    for (const wall of walls) {
      const pts = wall.points;
      if (pts.length < 2) continue;

      const closed = wall.drawMode !== 'line' && wall.drawMode !== 'freehand';
      const height = CutawayWallEngine.computeCutawayHeight(
        wall.heightMeters,
        wall.perspective,
        false,
      );
      const mat = this.createTexturedWallMaterial(scene, `lw-wall-mat-${wall.id}`, wall);

      const segCount = closed ? pts.length : pts.length - 1;
      const segLengths: number[] = [];
      let totalPerimeter = 0;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        segLengths.push(len);
        totalPerimeter += len;
      }

      let accumBefore = 0;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const totalLen = segLengths[i];
        if (totalLen < 0.08) continue;

        const segGlobalStartT = totalPerimeter > 0 ? accumBefore / totalPerimeter : 0;
        const segGlobalEndT = totalPerimeter > 0 ? (accumBefore + totalLen) / totalPerimeter : 1;
        accumBefore += totalLen;

        // Collect door openings on this segment
        const localCutouts: { startLocal: number; endLocal: number; opening: WallOpeningNode }[] = [];
        for (const op of wall.openings) {
          if (op.t >= segGlobalStartT - 0.001 && op.t <= segGlobalEndT + 0.001) {
            const localCenter =
              segGlobalEndT > segGlobalStartT
                ? (op.t - segGlobalStartT) / (segGlobalEndT - segGlobalStartT)
                : 0.5;
            const halfSpan = Math.min(0.45, (op.widthMeters * 0.5) / totalLen);
            localCutouts.push({
              startLocal: Math.max(0, localCenter - halfSpan),
              endLocal: Math.min(1, localCenter + halfSpan),
              opening: op,
            });
          }
        }
        localCutouts.sort((x, y) => x.startLocal - y.startLocal);

        const solidSpans: [number, number][] = [];
        let cursor = 0;
        for (const cut of localCutouts) {
          if (cut.startLocal - cursor > 0.03) {
            solidSpans.push([cursor, cut.startLocal]);
          }
          cursor = Math.max(cursor, cut.endLocal);
        }
        if (1 - cursor > 0.03) {
          solidSpans.push([cursor, 1]);
        }

        const angleY = -Math.atan2(dz, dx);

        for (let sIdx = 0; sIdx < solidSpans.length; sIdx++) {
          const [s0, s1] = solidSpans[sIdx];
          const spanLen = (s1 - s0) * totalLen;
          const tMid = (s0 + s1) * 0.5;
          const bx = a[0] + dx * tMid;
          const bz = a[1] + dz * tMid;

          const yStart = TerrainMeshBuilder.sampleElevationAt(
            scene,
            a[0] + dx * s0,
            a[1] + dz * s0,
          );
          const yMid = TerrainMeshBuilder.sampleElevationAt(scene, bx, bz);
          const yEnd = TerrainMeshBuilder.sampleElevationAt(
            scene,
            a[0] + dx * s1,
            a[1] + dz * s1,
          );
          const minGroundY = Math.min(yStart, yMid, yEnd) - 0.55;
          const maxGroundY = Math.max(yStart, yMid, yEnd);
          const effectiveHeight = maxGroundY + height - minGroundY;

          const wallMeta = {
            lwNodeName: `lw-wall-${wall.id}`,
            lwKind: 'wall' as const,
            lwEntityId: wall.id,
          };

          const segMesh = MeshBuilder.CreateBox(
            `lw-wall-${wall.id}-seg-${i}-${sIdx}`,
            {
              width: spanLen + wall.thicknessMeters * 0.4,
              height: effectiveHeight,
              depth: wall.thicknessMeters,
            },
            scene,
          );
          segMesh.position.set(bx, minGroundY + effectiveHeight / 2, bz);
          segMesh.rotation.y = angleY;
          segMesh.material = mat;
          segMesh.receiveShadows = true;
          segMesh.metadata = wallMeta;
          meshCount++;
        }

        // Render lintel above each door cutout and place the independently selectable 3D Door asset
        for (const cut of localCutouts) {
          const op = cut.opening;
          if (hideSecrets && op.isSecret && !op.isRevealedToPlayers) continue;

          const tCenter = (cut.startLocal + cut.endLocal) * 0.5;
          const doorX = a[0] + dx * tCenter;
          const doorZ = a[1] + dz * tCenter;
          const groundY = TerrainMeshBuilder.sampleElevationAt(scene, doorX, doorZ);
          const doorH = op.heightMeters ?? Math.min(height * 0.85, 2.6);

          if (height - doorH > 0.25) {
            const lintelH = height - doorH;
            const lintel = MeshBuilder.CreateBox(
              `lw-wall-${wall.id}-lintel-${op.id}`,
              {
                width: op.widthMeters + 0.12,
                height: lintelH,
                depth: wall.thicknessMeters,
              },
              scene,
            );
            lintel.position.set(doorX, groundY + doorH + lintelH / 2, doorZ);
            lintel.rotation.y = angleY;
            lintel.material = mat;
            lintel.metadata = {
              lwNodeName: `lw-wall-${wall.id}`,
              lwKind: 'wall',
              lwEntityId: wall.id,
            };
          }

          const doorModelUrl = op.modelUrl || '/assets/object-library/models/obj-89c62a2b01238531.glb';
          const doorTpl = GlbModelCache.getOrLoadTemplate(scene, doorModelUrl, onGlbLoaded);
          const doorMeta = {
            lwNodeName: `lw-door-${op.id}`,
            lwKind: 'door' as const,
            lwEntityId: op.id,
            lwWallId: wall.id,
          };

          if (doorTpl) {
            const doorInst = GlbModelCache.instantiateClone(
              scene,
              doorTpl,
              `lw-door-node-${op.id}`,
              op.widthMeters,
              doorH,
              wall.thicknessMeters * 1.35,
              false,
              false,
              doorMeta,
            );
            doorInst.position.set(doorX, groundY, doorZ);
            doorInst.rotation.y = angleY + (op.isOpen ? Math.PI * 0.42 : 0);
            meshCount++;
          } else {
            const doorMesh = MeshBuilder.CreateBox(
              `lw-door-${op.id}`,
              {
                width: op.widthMeters,
                height: doorH,
                depth: wall.thicknessMeters * 1.25,
              },
              scene,
            );
            doorMesh.position.set(doorX, groundY + doorH / 2, doorZ);
            doorMesh.rotation.y = angleY + (op.isOpen ? Math.PI * 0.42 : 0);
            doorMesh.material = mat;
            doorMesh.metadata = doorMeta;
            meshCount++;
          }
        }
      }
    }

    return meshCount;
  }

  static renderGhostWallPreview(
    scene: Scene,
    drawMode: WallDrawMode,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    heightMeters: number,
    thicknessMeters: number,
    freehandPoints?: readonly (readonly [number, number])[],
    snapToGrid = true,
  ): void {
    scene.meshes
      .filter((m) => m.name.startsWith('lw-ghost-wall-'))
      .forEach((m) => m.dispose(false, false));

    const pts = this.buildShapePoints(
      drawMode,
      startX,
      startZ,
      endX,
      endZ,
      freehandPoints,
      snapToGrid,
    );
    if (pts.length < 2) return;

    const closed = drawMode !== 'line' && drawMode !== 'freehand';
    const mat = this.getSharedGhostWallMat(scene);

    const segCount = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const totalLen = Math.hypot(dx, dz);
      if (totalLen < 0.05) continue;

      const angleY = -Math.atan2(dz, dx);
      const bx = (a[0] + b[0]) * 0.5;
      const bz = (a[1] + b[1]) * 0.5;
      const y0 = TerrainMeshBuilder.sampleElevationAt(scene, a[0], a[1]);
      const yMid = TerrainMeshBuilder.sampleElevationAt(scene, bx, bz);
      const y1 = TerrainMeshBuilder.sampleElevationAt(scene, b[0], b[1]);
      const minGroundY = Math.min(y0, yMid, y1) - 0.35;
      const maxGroundY = Math.max(y0, yMid, y1);
      const effectiveH = maxGroundY + heightMeters - minGroundY;

      const mesh = MeshBuilder.CreateBox(
        `lw-ghost-wall-seg-${i}`,
        { width: totalLen + thicknessMeters * 0.35, height: effectiveH, depth: thicknessMeters },
        scene,
      );
      mesh.position.set(bx, minGroundY + effectiveH / 2, bz);
      mesh.rotation.y = angleY;
      mesh.material = mat;
      mesh.isPickable = false;
    }
  }
}
