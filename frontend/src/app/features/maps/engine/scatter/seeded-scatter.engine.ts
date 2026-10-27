import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from '@babylonjs/core';
import { MapScatterClusterNode } from '../map-scene-contract';
import { GlbModelCache } from '../rendering/glb-model-cache';
import { TerrainMeshBuilder } from '../terrain/terrain-mesh.builder';

export class SeededScatterEngine {
  static rebuildScatterInstances(
    scene: Scene,
    seed: number,
    densityPercent: number,
    clusters?: readonly MapScatterClusterNode[],
    onGlbLoaded?: () => void,
  ): number {
    scene.transformNodes
      .filter((n) => n.name.startsWith('lw-scatter-node-'))
      .forEach((n) => n.dispose());
    scene.meshes
      .filter((m) => m.name.startsWith('lw-scatter-'))
      .forEach((m) => m.dispose());

    const hasGlobal = densityPercent > 0;
    const hasClusters = Boolean(clusters && clusters.length > 0);
    if (!hasGlobal && !hasClusters) {
      return 0;
    }

    const masterRock = MeshBuilder.CreatePolyhedron(
      'lw-scatter-master-rock',
      { type: 1, size: 0.42 },
      scene,
    );
    const rockMat = new StandardMaterial('lw-scatter-rock-mat', scene);
    rockMat.diffuseColor = Color3.FromHexString('#5b6e64');
    rockMat.specularColor = Color3.FromHexString('#1c2620');
    masterRock.material = rockMat;
    masterRock.isVisible = false;
    masterRock.isPickable = false;

    const masterFoliage = MeshBuilder.CreateCylinder(
      'lw-scatter-master-foliage',
      { height: 0.95, diameterTop: 0.08, diameterBottom: 0.62, tessellation: 7 },
      scene,
    );
    const folMat = new StandardMaterial('lw-scatter-fol-mat', scene);
    folMat.diffuseColor = Color3.FromHexString('#2f8f5b');
    folMat.emissiveColor = Color3.FromHexString('#0d331f');
    masterFoliage.material = folMat;
    masterFoliage.isVisible = false;
    masterFoliage.isPickable = false;

    let totalInstances = 0;

    const makePrng = (initialSeed: number) => {
      let state = initialSeed || 1042;
      return (): number => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    if (hasGlobal) {
      const nextRand = makePrng(seed);
      const count = Math.max(4, Math.min(60, Math.round((densityPercent / 100) * 44)));
      for (let i = 0; i < count; i++) {
        const useRock = i % 2 === 0;
        const inst = (useRock ? masterRock : masterFoliage).createInstance(`lw-scatter-inst-${i}`);
        const angle = nextRand() * Math.PI * 2;
        const radius = 2.5 + nextRand() * 14.5;
        const ix = Math.cos(angle) * radius;
        const iz = Math.sin(angle) * radius;
        const gy = TerrainMeshBuilder.sampleElevationAt(scene, ix, iz);
        const s = 0.55 + nextRand() * 0.95;
        inst.position.set(ix, gy + (useRock ? 0.22 * s : 0.45 * s), iz);
        inst.scaling.set(s, s * (0.75 + nextRand() * 0.65), s);
        inst.rotation.y = nextRand() * Math.PI * 2;
        inst.isPickable = false;
        totalInstances++;
      }
    }

    if (clusters) {
      for (const cluster of clusters) {
        const nextRand = makePrng(cluster.seed);
        const itemCount = Math.max(3, Math.min(18, Math.round((cluster.density / 100) * 12)));
        const glbTpl = cluster.modelUrl
          ? GlbModelCache.getOrLoadTemplate(scene, cluster.modelUrl, onGlbLoaded)
          : null;

        for (let j = 0; j < itemCount; j++) {
          const r = Math.sqrt(nextRand()) * Math.max(0.8, cluster.radius);
          const a = nextRand() * Math.PI * 2;
          const ix = cluster.x + Math.cos(a) * r;
          const iz = cluster.z + Math.sin(a) * r;
          const gy = TerrainMeshBuilder.sampleElevationAt(scene, ix, iz);
          const s = 0.55 + nextRand() * 0.85;
          const rotY = nextRand() * Math.PI * 2;

          if (glbTpl && j < 6) {
            const node = GlbModelCache.instantiateClone(
              scene,
              glbTpl,
              `lw-scatter-node-${cluster.id}-${j}`,
              1.35 * s,
              1.35 * s,
              1.35 * s,
              true,
              false,
            );
            node.position.set(ix, gy, iz);
            node.rotation.y = rotY;
          } else {
            const useRock = j % 2 === 0;
            const inst = (useRock ? masterRock : masterFoliage).createInstance(
              `lw-scatter-cluster-${cluster.id}-${j}`,
            );
            inst.position.set(ix, gy + (useRock ? 0.2 * s : 0.42 * s), iz);
            inst.scaling.set(s, s * (0.8 + nextRand() * 0.6), s);
            inst.rotation.y = rotY;
            inst.isPickable = false;
          }
          totalInstances++;
        }
      }
    }

    return totalInstances;
  }
}
