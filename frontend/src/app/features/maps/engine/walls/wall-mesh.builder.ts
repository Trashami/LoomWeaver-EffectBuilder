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
  static buildShapePoints(
    mode: WallDrawMode,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    freehandPoints?: readonly (readonly [number, number])[],
  ): (readonly [number, number])[] {
    if (mode === 'freehand' && freehandPoints && freehandPoints.length >= 2) {
      return [...freehandPoints];
    }
    if (mode === 'line') {
      return [
        [startX, startZ],
        [endX, endZ],
      ];
    }

    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minZ = Math.min(startZ, endZ);
    const maxZ = Math.max(startZ, endZ);
    const w = Math.max(0.25, maxX - minX);
    const d = Math.max(0.25, maxZ - minZ);
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
      return [
        [cx, maxZ],
        [maxX, minZ],
        [minX, minZ],
      ];
    }
    if (mode === 'l_shape') {
      const midX = minX + w * 0.52;
      const midZ = minZ + d * 0.52;
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
      const x1 = minX + w * 0.32;
      const x2 = minX + w * 0.68;
      const zBar = minZ + d * 0.62;
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
      const x1 = minX + w * 0.33;
      const x2 = minX + w * 0.67;
      const z1 = minZ + d * 0.33;
      const z2 = minZ + d * 0.67;
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
    const mat = new StandardMaterial(matName, scene);
    const colorHex = CutawayWallEngine.materialHex(wall.material);
    const texUrl = wall.albedoUrl || wall.thumbnailUrl;
    if (texUrl) {
      const diffTex = new Texture(texUrl, scene);
      diffTex.uScale = 2.0;
      diffTex.vScale = 1.5;
      mat.diffuseTexture = diffTex;
      mat.diffuseColor = Color3.White();
      if (wall.normalUrl) {
        const bumpTex = new Texture(wall.normalUrl, scene);
        bumpTex.uScale = 2.0;
        bumpTex.vScale = 1.5;
        bumpTex.level = 1.15;
        mat.bumpTexture = bumpTex;
      }
    } else {
      mat.diffuseColor = Color3.FromHexString(colorHex);
      mat.emissiveColor = Color3.FromHexString(colorHex).scale(0.12);
    }
    mat.specularColor = Color3.FromHexString('#1d2822');
    return mat;
  }

  static rebuildWallMeshes(
    scene: Scene,
    walls: readonly MapWallSegmentNode[] | undefined,
    hideSecrets = false,
    onGlbLoaded?: () => void,
  ): number {
    scene.transformNodes
      .filter((n) => n.name.startsWith('lw-wall-node-') || n.name.startsWith('lw-door-node-'))
      .forEach((n) => n.dispose());
    scene.meshes
      .filter(
        (m) =>
          m.name.startsWith('lw-wall-') ||
          m.name.startsWith('lw-portal-') ||
          m.name.startsWith('lw-door-'),
      )
      .forEach((m) => m.dispose());

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
      const glbTemplate = wall.modelUrl
        ? GlbModelCache.getOrLoadTemplate(scene, wall.modelUrl, onGlbLoaded)
        : null;
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

        // Collect door openings that fall on this segment so we cut the wall around them
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

        // Build solid wall spans excluding door cutouts
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
          const blockCount = Math.max(1, Math.ceil(spanLen / 1.6));
          const blockLen = spanLen / blockCount;

          for (let bIdx = 0; bIdx < blockCount; bIdx++) {
            const t0 = s0 + ((s1 - s0) * bIdx) / blockCount;
            const t1 = s0 + ((s1 - s0) * (bIdx + 1)) / blockCount;
            const tMid = (t0 + t1) * 0.5;
            const bx = a[0] + dx * tMid;
            const bz = a[1] + dz * tMid;

            // Sample terrain along block so wall automatically fills gaps on raised/lowered slopes
            const yStart = TerrainMeshBuilder.sampleElevationAt(
              scene,
              a[0] + dx * t0,
              a[1] + dz * t0,
            );
            const yMid = TerrainMeshBuilder.sampleElevationAt(scene, bx, bz);
            const yEnd = TerrainMeshBuilder.sampleElevationAt(
              scene,
              a[0] + dx * t1,
              a[1] + dz * t1,
            );
            const minGroundY = Math.min(yStart, yMid, yEnd) - 0.55;
            const maxGroundY = Math.max(yStart, yMid, yEnd);
            const effectiveHeight = maxGroundY + height - minGroundY;

            const wallMeta = {
              lwNodeName: `lw-wall-${wall.id}`,
              lwKind: 'wall' as const,
              lwEntityId: wall.id,
            };

            if (glbTemplate) {
              const inst = GlbModelCache.instantiateClone(
                scene,
                glbTemplate,
                `lw-wall-node-${wall.id}-${i}-${sIdx}-${bIdx}`,
                blockLen + 0.14,
                effectiveHeight,
                wall.thicknessMeters,
                false,
                false,
                wallMeta,
              );
              inst.position.set(bx, minGroundY, bz);
              inst.rotation.y = angleY;
              meshCount++;
            } else {
              const segMesh = MeshBuilder.CreateBox(
                `lw-wall-${wall.id}-seg-${i}-${sIdx}-${bIdx}`,
                {
                  width: blockLen + 0.14,
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
          }
        }

        // Render lintel above each door cutout and place the independently selectable 3D Door GLB
        for (const cut of localCutouts) {
          const op = cut.opening;
          if (hideSecrets && op.isSecret && !op.isRevealedToPlayers) continue;

          const tCenter = (cut.startLocal + cut.endLocal) * 0.5;
          const doorX = a[0] + dx * tCenter;
          const doorZ = a[1] + dz * tCenter;
          const groundY = TerrainMeshBuilder.sampleElevationAt(scene, doorX, doorZ);
          const doorH = op.heightMeters ?? Math.min(height * 0.85, 2.6);

          // Top lintel wall header if wall is taller than door
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
            const doorMat = new StandardMaterial(`lw-door-mat-${op.id}`, scene);
            doorMat.diffuseColor = Color3.FromHexString('#7d5634');
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
            doorMesh.material = doorMat;
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
    modelUrl?: string,
    freehandPoints?: readonly (readonly [number, number])[],
  ): void {
    scene.transformNodes
      .filter((n) => n.name.startsWith('lw-ghost-wall-'))
      .forEach((n) => n.dispose());
    scene.meshes
      .filter((m) => m.name.startsWith('lw-ghost-wall-'))
      .forEach((m) => m.dispose());

    const pts = this.buildShapePoints(drawMode, startX, startZ, endX, endZ, freehandPoints);
    if (pts.length < 2) return;

    const closed = drawMode !== 'line' && drawMode !== 'freehand';
    const glbTemplate = modelUrl ? GlbModelCache.getOrLoadTemplate(scene, modelUrl) : null;
    const mat = new StandardMaterial('lw-ghost-wall-mat', scene);
    mat.diffuseColor = Color3.FromHexString('#49e892');
    mat.emissiveColor = Color3.FromHexString('#2ee66b').scale(0.55);
    mat.alpha = 0.48;

    const segCount = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const totalLen = Math.hypot(dx, dz);
      if (totalLen < 0.05) continue;

      const blockCount = Math.max(1, Math.ceil(totalLen / 1.8));
      const blockLen = totalLen / blockCount;
      const angleY = -Math.atan2(dz, dx);

      for (let bIdx = 0; bIdx < blockCount; bIdx++) {
        const t0 = bIdx / blockCount;
        const t1 = (bIdx + 1) / blockCount;
        const tMid = (t0 + t1) * 0.5;
        const bx = a[0] + dx * tMid;
        const bz = a[1] + dz * tMid;
        const y0 = TerrainMeshBuilder.sampleElevationAt(scene, a[0] + dx * t0, a[1] + dz * t0);
        const yMid = TerrainMeshBuilder.sampleElevationAt(scene, bx, bz);
        const y1 = TerrainMeshBuilder.sampleElevationAt(scene, a[0] + dx * t1, a[1] + dz * t1);
        const minGroundY = Math.min(y0, yMid, y1) - 0.45;
        const maxGroundY = Math.max(y0, yMid, y1);
        const effectiveH = maxGroundY + heightMeters - minGroundY;

        if (glbTemplate) {
          const inst = GlbModelCache.instantiateClone(
            scene,
            glbTemplate,
            `lw-ghost-wall-${i}-${bIdx}`,
            blockLen + 0.12,
            effectiveH,
            thicknessMeters,
            false,
            true,
          );
          inst.position.set(bx, minGroundY, bz);
          inst.rotation.y = angleY;
        } else {
          const mesh = MeshBuilder.CreateBox(
            `lw-ghost-wall-seg-${i}-${bIdx}`,
            { width: blockLen + 0.12, height: effectiveH, depth: thicknessMeters },
            scene,
          );
          mesh.position.set(bx, minGroundY + effectiveH / 2, bz);
          mesh.rotation.y = angleY;
          mesh.material = mat;
          mesh.isPickable = false;
        }
      }
    }
  }
}
