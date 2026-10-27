import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  VertexData,
} from '@babylonjs/core';

export type LwFloorGridMode = '5 ft' | '10 ft' | 'Hex' | 'Off';

export class TerrainMeshBuilder {
  private static readonly GROUND_W = 36;
  private static readonly GROUND_H = 28;
  private static readonly SUBDIV = 48;

  private static customElevations: Float32Array | null = null;
  private static activeAlbedoUrl =
    '/assets/sewer-dungeon-wall-library-v1/512/worn-castle-flagstone.png';
  private static activeNormalUrl =
    '/assets/sewer-dungeon-wall-library-v1/512/worn-castle-flagstone_normal.png';
  private static floorTilingScale = 10;
  private static activeGridMode: LwFloorGridMode = '5 ft';

  static resetElevations(): void {
    this.customElevations = null;
  }

  static setGridMode(scene: Scene, mode: string): void {
    const normalized: LwFloorGridMode =
      mode === '10 ft' || mode === 'Hex' || mode === 'Off' ? mode : '5 ft';
    this.activeGridMode = normalized;
    this.rebuildGridOverlay(scene);
  }

  static buildTerrainAndGrid(
    scene: Scene,
    biome: string,
    reliefScale: number,
  ): Mesh {
    let ground = scene.getMeshByName('lw-terrain-ground') as Mesh | null;
    if (!ground) {
      ground = MeshBuilder.CreateGround(
        'lw-terrain-ground',
        {
          width: this.GROUND_W,
          height: this.GROUND_H,
          subdivisions: this.SUBDIV,
          updatable: true,
        },
        scene,
      );
      ground.isPickable = true;
      ground.receiveShadows = true;

      const positions = ground.getVerticesData('position');
      if (positions) {
        const amp = reliefScale <= 0 ? 0 : (Math.min(100, reliefScale) / 100) * 0.55;
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2];
          const distFromCenter = Math.sqrt(x * x + z * z);
          const edgeFactor = Math.min(1, Math.max(0, (distFromCenter - 7) / 12));
          positions[i + 1] =
            amp === 0 ? 0 : Math.sin(x * 0.35) * Math.cos(z * 0.35) * amp * edgeFactor;
        }
        if (this.customElevations && this.customElevations.length === positions.length / 3) {
          for (let v = 0; v < this.customElevations.length; v++) {
            positions[v * 3 + 1] += this.customElevations[v];
          }
        } else {
          this.customElevations = new Float32Array(positions.length / 3);
        }
        ground.updateVerticesData('position', positions);
        this.recomputeNormals(ground, positions);
        ground.refreshBoundingInfo();
      }

      this.applyMaterialAndBump(scene, ground, biome);
      this.rebuildGridOverlay(scene);
    }

    return ground;
  }

  /**
   * Bilinear interpolation of ground height at any (worldX, worldZ) so the
   * terrain brush circle and floor grid match the sculpted surface 1:1.
   */
  static sampleElevationAt(scene: Scene, worldX: number, worldZ: number): number {
    const ground = scene.getMeshByName('lw-terrain-ground') as Mesh | null;
    if (!ground) return 0;
    const positions = ground.getVerticesData('position');
    if (!positions) return 0;

    const cols = this.SUBDIV + 1;
    const u = Math.max(0, Math.min(1, (worldX + this.GROUND_W / 2) / this.GROUND_W));
    const v = Math.max(0, Math.min(1, (this.GROUND_H / 2 - worldZ) / this.GROUND_H));

    const gx = u * this.SUBDIV;
    const gz = v * this.SUBDIV;
    const x0 = Math.min(this.SUBDIV - 1, Math.floor(gx));
    const z0 = Math.min(this.SUBDIV - 1, Math.floor(gz));
    const tx = gx - x0;
    const tz = gz - z0;

    const y00 = positions[(z0 * cols + x0) * 3 + 1] ?? 0;
    const y10 = positions[(z0 * cols + (x0 + 1)) * 3 + 1] ?? 0;
    const y01 = positions[((z0 + 1) * cols + x0) * 3 + 1] ?? 0;
    const y11 = positions[((z0 + 1) * cols + (x0 + 1)) * 3 + 1] ?? 0;

    const yTop = y00 * (1 - tx) + y10 * tx;
    const yBot = y01 * (1 - tx) + y11 * tx;
    return yTop * (1 - tz) + yBot * tz;
  }

  /**
   * Rebuilds the 3D floor grid ('5 ft', '10 ft', 'Hex', or 'Off'), draping lines
   * over sculpted terrain and adjusting cell coordinates for 3D slope distance.
   */
  static rebuildGridOverlay(scene: Scene): void {
    const existingGrid = scene.getMeshByName('lw-terrain-grid');
    if (existingGrid) {
      existingGrid.dispose();
    }

    if (this.activeGridMode === 'Off') {
      return;
    }

    const lines: Vector3[][] = [];
    const halfW = this.GROUND_W / 2;
    const halfH = this.GROUND_H / 2;
    const liftY = 0.045;

    // Slope-aware coordinate shift: pulls grid lines slightly inward on steep slopes
    // so the 3D surface distance along the hill respects the true square/hex size.
    const slopeAdjustedPoint = (x: number, z: number): Vector3 => {
      const y = this.sampleElevationAt(scene, x, z);
      const eps = 0.35;
      const dydx =
        (this.sampleElevationAt(scene, x + eps, z) -
          this.sampleElevationAt(scene, x - eps, z)) /
        (2 * eps);
      const dydz =
        (this.sampleElevationAt(scene, x, z + eps) -
          this.sampleElevationAt(scene, x, z - eps)) /
        (2 * eps);
      const adjX = x - dydx * Math.abs(y) * 0.18;
      const adjZ = z - dydz * Math.abs(y) * 0.18;
      const adjY = this.sampleElevationAt(scene, adjX, adjZ) + liftY;
      return new Vector3(adjX, adjY, adjZ);
    };

    if (this.activeGridMode === 'Hex') {
      const hexR = 1.05;
      const dx = hexR * 1.5;
      const dz = hexR * Math.sqrt(3);
      let col = 0;
      for (let cx = -halfW + hexR; cx <= halfW - hexR; cx += dx, col++) {
        const zOffset = col % 2 === 0 ? 0 : dz / 2;
        for (let cz = -halfH + hexR + zOffset; cz <= halfH - hexR; cz += dz) {
          const ring: Vector3[] = [];
          for (let k = 0; k <= 6; k++) {
            const angle = (k * Math.PI) / 3;
            const vx = cx + Math.cos(angle) * hexR;
            const vz = cz + Math.sin(angle) * hexR;
            ring.push(slopeAdjustedPoint(vx, vz));
          }
          lines.push(ring);
        }
      }
    } else {
      const cellStep = this.activeGridMode === '10 ft' ? 3.0 : 1.5;
      const sampleStep = 0.5;

      for (let x = -halfW; x <= halfW + 0.01; x += cellStep) {
        const polyline: Vector3[] = [];
        for (let z = -halfH; z <= halfH + 0.01; z += sampleStep) {
          polyline.push(slopeAdjustedPoint(x, z));
        }
        lines.push(polyline);
      }

      for (let z = -halfH; z <= halfH + 0.01; z += cellStep) {
        const polyline: Vector3[] = [];
        for (let x = -halfW; x <= halfW + 0.01; x += sampleStep) {
          polyline.push(slopeAdjustedPoint(x, z));
        }
        lines.push(polyline);
      }
    }

    const grid = MeshBuilder.CreateLineSystem('lw-terrain-grid', { lines }, scene);
    grid.color = Color3.FromHexString('#34634d');
    grid.isPickable = false;
  }

  static applyFloorBumpTexture(
    scene: Scene,
    albedoUrl: string,
    normalUrl: string,
    tilingScale = 10,
  ): void {
    this.activeAlbedoUrl = albedoUrl;
    this.activeNormalUrl = normalUrl;
    this.floorTilingScale = tilingScale;
    const ground = scene.getMeshByName('lw-terrain-ground') as Mesh | null;
    if (ground) {
      this.applyMaterialAndBump(scene, ground, '');
    }
  }

  private static applyMaterialAndBump(scene: Scene, ground: Mesh, biome: string): void {
    const existingMat = scene.getMaterialByName('lw-terrain-mat') as StandardMaterial | null;
    if (existingMat) {
      existingMat.dispose();
    }
    const mat = new StandardMaterial('lw-terrain-mat', scene);
    mat.diffuseColor = Color3.FromHexString('#9aaea1');
    mat.specularColor = Color3.FromHexString('#1e2923');
    mat.roughness = 0.85;

    try {
      const uScale = this.floorTilingScale;
      const vScale = Math.round(this.floorTilingScale * 0.8);
      if (this.activeAlbedoUrl) {
        const diffTex = new Texture(this.activeAlbedoUrl, scene);
        diffTex.uScale = uScale;
        diffTex.vScale = vScale;
        mat.diffuseTexture = diffTex;
      }
      if (this.activeNormalUrl) {
        const bumpTex = new Texture(this.activeNormalUrl, scene);
        bumpTex.uScale = uScale;
        bumpTex.vScale = vScale;
        bumpTex.level = 1.35;
        mat.bumpTexture = bumpTex;
      }
    } catch {
      if (biome.toLowerCase().includes('forest')) {
        mat.diffuseColor = Color3.FromHexString('#183326');
      }
    }

    ground.material = mat;
    ground.receiveShadows = true;
  }

  static sculptElevationAt(
    scene: Scene,
    worldX: number,
    worldZ: number,
    radius: number,
    deltaY: number,
    mode: 'raise' | 'lower' | 'flatten',
  ): void {
    const ground = scene.getMeshByName('lw-terrain-ground') as Mesh | null;
    if (!ground) return;
    const positions = ground.getVerticesData('position');
    if (!positions) return;

    if (!this.customElevations || this.customElevations.length !== positions.length / 3) {
      this.customElevations = new Float32Array(positions.length / 3);
    }

    const r = Math.max(1.2, radius);
    const signedDelta = mode === 'lower' ? -Math.abs(deltaY) : Math.abs(deltaY);

    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vz = positions[i + 2];
      const dist = Math.hypot(vx - worldX, vz - worldZ);
      if (dist <= r) {
        const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / r));
        const vIdx = i / 3;
        if (mode === 'flatten') {
          positions[i + 1] = positions[i + 1] * (1 - falloff * 0.65);
          this.customElevations[vIdx] = positions[i + 1];
        } else {
          const step = signedDelta * falloff * 0.45;
          positions[i + 1] = Math.max(-4.5, Math.min(8.5, positions[i + 1] + step));
          this.customElevations[vIdx] += step;
        }
      }
    }

    ground.updateVerticesData('position', positions);
    this.recomputeNormals(ground, positions);
    ground.refreshBoundingInfo();
    this.rebuildGridOverlay(scene);
  }

  private static recomputeNormals(ground: Mesh, positions: number[] | Float32Array): void {
    const indices = ground.getIndices();
    if (!indices) return;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData('normal', normals);
  }
}
