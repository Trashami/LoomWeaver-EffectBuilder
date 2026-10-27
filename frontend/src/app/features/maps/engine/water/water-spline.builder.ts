import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { WaterSplineNode } from '../map-scene-contract';
import { TerrainMeshBuilder } from '../terrain/terrain-mesh.builder';

export class WaterSplineBuilder {
  static rebuildWaterSplines(scene: Scene, splines: readonly WaterSplineNode[]): void {
    scene.meshes
      .filter((m) => m.name.startsWith('lw-water-spline-'))
      .forEach((m) => m.dispose());

    for (const spline of splines) {
      if (spline.points.length === 0) continue;

      const mat = new StandardMaterial(`lw-water-mat-${spline.id}`, scene);
      mat.diffuseColor = Color3.FromHexString(spline.colorHex || '#1b6d82');
      mat.emissiveColor = Color3.FromHexString('#0d3b49');
      mat.specularColor = Color3.FromHexString('#8ce8ff');
      mat.alpha = 0.84;

      const halfW = Math.max(0.6, (spline.width || 2.8) * 0.5);

      if (spline.points.length === 1) {
        const p = spline.points[0];
        const gy = TerrainMeshBuilder.sampleElevationAt(scene, p[0], p[2]) + 0.08;
        const pool = MeshBuilder.CreateDisc(
          `lw-water-spline-pool-${spline.id}`,
          { radius: halfW, tessellation: 24 },
          scene,
        );
        pool.rotation.x = Math.PI / 2;
        pool.position.set(p[0], gy, p[2]);
        pool.material = mat;
        pool.isPickable = false;
        continue;
      }

      const leftPath: Vector3[] = [];
      const rightPath: Vector3[] = [];

      for (let i = 0; i < spline.points.length; i++) {
        const cur = spline.points[i];
        const prev = spline.points[Math.max(0, i - 1)];
        const next = spline.points[Math.min(spline.points.length - 1, i + 1)];
        let tx = next[0] - prev[0];
        let tz = next[2] - prev[2];
        const len = Math.hypot(tx, tz);
        if (len < 0.001) {
          tx = 1;
          tz = 0;
        } else {
          tx /= len;
          tz /= len;
        }
        const nx = -tz;
        const nz = tx;
        const lx = cur[0] + nx * halfW;
        const lz = cur[2] + nz * halfW;
        const rx = cur[0] - nx * halfW;
        const rz = cur[2] - nz * halfW;
        const ly = TerrainMeshBuilder.sampleElevationAt(scene, lx, lz) + 0.09;
        const ry = TerrainMeshBuilder.sampleElevationAt(scene, rx, rz) + 0.09;

        leftPath.push(new Vector3(lx, ly, lz));
        rightPath.push(new Vector3(rx, ry, rz));
      }

      const ribbon = MeshBuilder.CreateRibbon(
        `lw-water-spline-${spline.id}`,
        {
          pathArray: [leftPath, rightPath],
          sideOrientation: 2,
        },
        scene,
      );
      ribbon.material = mat;
      ribbon.isPickable = false;
    }
  }
}
