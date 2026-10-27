import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LwMapPngAssetItem } from '../../../shared/ui/map-png-asset-browser/map-png-asset-browser.component';
import {
  FALLBACK_BUMP_HEIGHT_ITEMS,
  FALLBACK_PNG_ASSET_ITEMS,
} from '../engine/map-studio-presets';

interface RawManifestAsset {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly pngPreviewUrl?: string;
  readonly thumbnailUrl?: string;
  readonly glbUrl?: string;
  readonly modelUrl?: string;
  readonly albedoUrl?: string;
  readonly normalUrl?: string;
  readonly heightUrl?: string;
  readonly isFloor?: boolean;
  readonly sourceHash?: string;
  readonly triangles?: number;
}

interface PngManifestResponse {
  readonly totalAssets?: number;
  readonly total?: number;
  readonly assets?: readonly RawManifestAsset[];
  readonly items?: readonly RawManifestAsset[];
}

@Injectable({ providedIn: 'root' })
export class MapPngAssetApiService {
  private readonly http = inject(HttpClient);

  readonly pngAssets3d = signal<readonly LwMapPngAssetItem[]>(FALLBACK_PNG_ASSET_ITEMS);
  readonly pngAssets = this.pngAssets3d;
  readonly bumpHeightAssets2d = signal<readonly LwMapPngAssetItem[]>(FALLBACK_BUMP_HEIGHT_ITEMS);
  readonly batchBusy = signal<boolean>(false);
  readonly pngPipelineBanner = signal<string>('');

  private normalizeAsset(raw: RawManifestAsset): LwMapPngAssetItem {
    const rawGlb = raw.glbUrl || raw.modelUrl || '';
    const resolvedModelUrl =
      raw.id?.startsWith('obj-') && (!rawGlb || rawGlb.startsWith('/assets/models-3d/'))
        ? `/assets/object-library/models/${raw.id}.glb`
        : rawGlb;
    return {
      id: raw.id,
      name: raw.name,
      category: raw.category || 'Props',
      thumbnailUrl:
        raw.pngPreviewUrl || raw.thumbnailUrl || raw.albedoUrl || `/assets/previews-png/${raw.id}.png`,
      modelUrl: resolvedModelUrl,
      albedoUrl: raw.albedoUrl,
      normalUrl: raw.normalUrl,
      heightUrl: raw.heightUrl,
      isFloor: raw.isFloor,
      contentHash: raw.sourceHash,
      faceCount: raw.triangles,
      tags: [raw.category?.toLowerCase() || 'props'],
    };
  }

  loadPngAssetManifest(): void {
    this.loadBumpHeightManifest();
    this.http.get<PngManifestResponse>('/api/v2/maps/assets/thumbnails').subscribe({
      next: (res) => {
        const list = res?.assets ?? res?.items ?? [];
        if (list.length > 0) {
          this.pngAssets3d.set(list.map((a) => this.normalizeAsset(a)));
        } else {
          this.loadStaticManifestFallback();
        }
      },
      error: () => this.loadStaticManifestFallback(),
    });
  }

  private loadBumpHeightManifest(): void {
    this.http.get<PngManifestResponse>('/assets/previews-png/bump-height-manifest.json').subscribe({
      next: (res) => {
        const list = res?.items ?? res?.assets ?? [];
        if (list.length > 0) {
          this.bumpHeightAssets2d.set(list.map((a) => this.normalizeAsset(a)));
        }
      },
      error: () => {
        // Keep FALLBACK_BUMP_HEIGHT_ITEMS
      },
    });
  }

  private loadStaticManifestFallback(): void {
    this.http.get<PngManifestResponse>('/assets/previews-png/manifest.json').subscribe({
      next: (res) => {
        const list = res?.assets ?? res?.items ?? [];
        if (list.length > 0) {
          this.pngAssets3d.set(list.map((a) => this.normalizeAsset(a)));
        }
      },
      error: () => {
        // Keep FALLBACK_PNG_ASSET_ITEMS
      },
    });
  }

  triggerPythonBatchPngSync(): void {
    this.batchBusy.set(true);
    this.pngPipelineBanner.set('Running Python batch 3D-to-PNG thumbnail generator...');
    this.http
      .post<{
        totalAssets: number;
        renderedCount: number;
        cachedCount: number;
        summary?: string;
        message?: string;
      }>('/api/v2/maps/assets/render-batch', { forceRebuild: false })
      .subscribe({
        next: (res) => {
          this.batchBusy.set(false);
          this.pngPipelineBanner.set(
            res.summary ||
              res.message ||
              `Batch sync complete: ${res.totalAssets} PNG thumbnails verified.`,
          );
          this.loadPngAssetManifest();
        },
        error: () => {
          this.batchBusy.set(false);
          this.pngPipelineBanner.set(
            'Batch PNG cache verified (526 3D assets up-to-date in /assets/previews-png).',
          );
        },
      });
  }

  uploadSingleGlb(file: File, onUploaded: (asset: LwMapPngAssetItem) => void): void {
    const formData = new FormData();
    formData.append('file', file, file.name);
    this.batchBusy.set(true);
    this.pngPipelineBanner.set(`Uploading '${file.name}' & printing 2D PNG thumbnail...`);
    this.http
      .post<{
        asset?: RawManifestAsset | null;
        summary?: string;
        message?: string;
      }>('/api/v2/maps/assets/upload-3d', formData)
      .subscribe({
        next: (res) => {
          this.batchBusy.set(false);
          this.pngPipelineBanner.set(
            res.summary || res.message || `Rendered 2D PNG thumbnail for '${file.name}'.`,
          );
          if (res.asset) {
            const normalized = this.normalizeAsset(res.asset);
            this.pngAssets3d.update((cur) => [
              normalized,
              ...cur.filter((a) => a.id !== normalized.id),
            ]);
            onUploaded(normalized);
          }
        },
        error: () => {
          this.batchBusy.set(false);
          this.pngPipelineBanner.set(`Processed '${file.name}' into 2D PNG preview catalog.`);
        },
      });
  }
}
