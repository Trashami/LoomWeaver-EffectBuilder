import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdventureGuideService } from '../../core/services/adventure-guide.service';
import { LoomWeaverStoreService } from '../../core/services/loomweaver-store.service';
import {
  LwCelestialBodyMode,
  LwCreateMapLaunchIntent,
  LwCustomLightKind,
  LwExistingMapSummary,
  LwIconComponent,
  LwMapAssetPickerModalComponent,
  LwMapCameraView,
  LwMapDimensionMode,
  LwMapMaterialPreset,
  LwMapPngAssetItem,
  LwMapPropertiesInspectorComponent,
  LwMapQualityPreset,
  LwMapStudioLandingComponent,
  LwMapStudioSubbarComponent,
  LwMapToolDockComponent,
  LwMapViewportBarComponent,
  LwSelectedSceneNode,
  LwTerrainSculptOp,
  LwToastNotificationComponent,
  MapEditorModeTab,
} from '../../shared/ui/public-api';
import { MapHistoryEngineService } from './application/map-history-engine.service';
import { MapPngAssetApiService } from './application/map-png-asset-api.service';
import { MapStudioStoreService } from './application/map-studio-store.service';
import { MapStudioSnapshot } from './application/map-studio.models';
import {
  MapSceneGraphState,
  MapWallSegmentNode,
  WallDrawMode,
  WallOpeningNode,
} from './engine/map-scene-contract';
import { INITIAL_CINTH_SCENE_GRAPH, createBlankSceneGraph } from './engine/map-scene-seed';
import {
  DEFAULT_CAMPAIGN_ENCOUNTERS,
  DEFAULT_CAMPAIGN_SESSIONS,
  DEFAULT_EXISTING_MAPS,
  DEFAULT_MAP_MATERIALS,
  INITIAL_SELECTED_WALL_NODE,
} from './engine/map-studio-presets';
import {
  BabylonMapStageService,
  PickedSceneEntityMeta,
} from './engine/rendering/babylon-map-stage.service';
import { Real2dMapRenderer } from './engine/rendering/real-2d-map-renderer';
import { WallMeshBuilder } from './engine/walls/wall-mesh.builder';

@Component({
  selector: 'lw-maps-page',
  standalone: true,
  imports: [
    FormsModule,
    LwIconComponent,
    LwMapStudioLandingComponent,
    LwMapStudioSubbarComponent,
    LwMapToolDockComponent,
    LwMapViewportBarComponent,
    LwMapPropertiesInspectorComponent,
    LwMapAssetPickerModalComponent,
    LwToastNotificationComponent,
  ],
  templateUrl: './maps.page.html',
  styleUrl: './maps.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapsPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('babylonCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('real2dCanvas') private canvas2dRef?: ElementRef<HTMLCanvasElement>;

  private readonly pngApi = inject(MapPngAssetApiService);
  readonly store = inject(LoomWeaverStoreService);
  readonly adventureGuide = inject(AdventureGuideService);
  readonly stage = inject(BabylonMapStageService);
  readonly studio = inject(MapStudioStoreService);
  readonly history = inject(MapHistoryEngineService);

  readonly showLandingHub = signal<boolean>(true);
  readonly assetModalOpen = signal<boolean>(false);
  readonly dimensionMode = signal<LwMapDimensionMode>('3d');
  readonly leftDockCollapsed = signal<boolean>(false);
  readonly rightDockCollapsed = signal<boolean>(true);

  readonly mapTitle = signal<string>('The Forgotten Crypt');
  readonly gridCols = signal<number>(50);
  readonly gridRows = signal<number>(50);
  readonly studioMode = signal<MapEditorModeTab>('build');
  readonly activeDockToolId = signal<string>('select');
  readonly cameraView = signal<LwMapCameraView>('isometric');
  readonly activeTheme = signal<string>('Abandoned Crypt');
  readonly activeQuality = signal<LwMapQualityPreset>('Balanced 3D');
  readonly gridSizeLabel = signal<string>('5 ft');
  readonly snapEnabled = signal<boolean>(true);
  readonly showPlayerSafeOnly = signal<boolean>(false);

  readonly existingMaps = signal<readonly LwExistingMapSummary[]>(DEFAULT_EXISTING_MAPS);
  readonly campaigns = computed(() =>
    this.store.campaigns().map((c) => ({ id: c.id, name: c.name })),
  );
  readonly sessions = signal(DEFAULT_CAMPAIGN_SESSIONS);
  readonly encounters = signal(DEFAULT_CAMPAIGN_ENCOUNTERS);
  readonly assignSessionId = signal<string>('session-15');
  readonly assignEncounterId = signal<string>('enc-cinth-masquerade');
  readonly assignLocationNodeId = signal<string>('node-loc-ruined-chapel');

  readonly pngPipelineBanner = this.pngApi.pngPipelineBanner;
  readonly selectedPngAssetId = signal<string>('obj-4f9776736fb571f1');
  readonly selectedPlacedId = signal<string | null>(null);
  readonly selectedPlacedKind = signal<'wall' | 'door' | 'object' | 'light' | null>(null);
  readonly selectedPlacedWallId = signal<string | null>(null);
  readonly materials = signal<readonly LwMapMaterialPreset[]>(DEFAULT_MAP_MATERIALS);
  readonly selectedNode = signal<LwSelectedSceneNode>(INITIAL_SELECTED_WALL_NODE);

  readonly floorTilingScale = signal<number>(10);
  readonly wallDrawMode = signal<WallDrawMode>('line');
  readonly wallStartAnchor = signal<{ x: number; z: number } | null>(null);
  readonly freehandWallPoints = signal<readonly (readonly [number, number])[]>([]);

  readonly terrainSculptOp = signal<LwTerrainSculptOp>('raise');
  readonly terrainBrushRadius = signal<number>(4.5);
  readonly terrainBrushDelta = signal<number>(1.4);
  readonly terrainGradualRate = signal<number>(55);

  readonly doorWallPositionPct = signal<number>(50);
  readonly doorWidthMeters = signal<number>(2.4);
  readonly doorHeightMeters = signal<number>(2.6);
  readonly doorIsOpen = signal<boolean>(false);

  readonly celestialMode = signal<LwCelestialBodyMode>('sun');
  readonly celestialAzimuthDeg = signal<number>(135);
  readonly celestialAltitudeDeg = signal<number>(42);
  readonly shadowDarkness = signal<number>(72);

  readonly customLightKind = signal<LwCustomLightKind>('torch');
  readonly customLightColor = signal<string>('#ffae52');
  readonly customLightRange = signal<number>(25);
  readonly lightPlacementWidth = signal<number>(2.0);
  readonly lightHeightMeters = signal<number>(2.4);
  readonly torchIntensity = signal<number>(125);
  readonly lightShowFixture = signal<boolean>(true);

  readonly scatterDensity = signal<number>(65);
  readonly waterWidthMeters = signal<number>(3.0);
  readonly waterFlowSpeed = signal<number>(1.4);
  private activeWaterSplineId: string | null = null;
  private lastScatterPaintPos: { x: number; z: number } | null = null;

  readonly selectedSceneKey = signal<string>('scene-forgotten-crypt');
  readonly sceneGraph = signal<MapSceneGraphState>(createBlankSceneGraph('The Forgotten Crypt'));

  private isWallAsset(a: LwMapPngAssetItem): boolean {
    const n = a.name.toLowerCase();
    const c = a.category.toLowerCase();
    return (
      !a.isFloor &&
      (n.includes('wall') ||
        n.includes('brick') ||
        n.includes('fence') ||
        n.includes('palisade') ||
        n.includes('barrier') ||
        n.includes('rampart') ||
        n.includes('battlement') ||
        n.includes('buttress') ||
        n.includes('modular') ||
        n.includes('dungeon tile') ||
        c.includes('wall'))
    );
  }

  private isDoorAsset(a: LwMapPngAssetItem): boolean {
    const n = a.name.toLowerCase();
    return (
      !a.isFloor &&
      Boolean(a.modelUrl) &&
      (n.includes('door') ||
        n.includes('gate') ||
        n.includes('archway') ||
        n.includes('entry') ||
        n.includes('passage') ||
        n.includes('portal') ||
        n.includes('portcullis')) &&
      !n.includes('archer')
    );
  }

  readonly displayedAssets = computed<readonly LwMapPngAssetItem[]>(() => {
    const rawTool = this.activeDockToolId();
    const placedKind = this.selectedPlacedKind();
    const effectiveTool =
      rawTool === 'select' && placedKind
        ? placedKind === 'wall'
          ? 'wall'
          : placedKind === 'door'
            ? 'door'
            : 'objects'
        : rawTool;

    const all3d = this.pngApi.pngAssets3d().filter((a) => !a.isFloor);
    const all2d = this.pngApi.bumpHeightAssets2d();

    if (effectiveTool === 'floor-bump') {
      return all2d.filter((a) => a.isFloor);
    }
    if (effectiveTool === 'wall' || effectiveTool === 'room') {
      const walls3d = all3d.filter((a) => this.isWallAsset(a));
      const walls2d = all2d.filter((a) => this.isWallAsset(a));
      return [...walls3d, ...walls2d];
    }
    if (effectiveTool === 'door') {
      return all3d.filter((a) => this.isDoorAsset(a));
    }
    if (effectiveTool === 'scatter') {
      return all3d.filter(
        (a) =>
          a.category === 'Nature' ||
          a.category === 'Rocks & Cliffs' ||
          a.category === 'Props',
      );
    }
    if (this.dimensionMode() === '2d') {
      return all2d.filter((a) => !a.isFloor);
    }
    return [...all3d, ...all2d.filter((a) => !a.isFloor)];
  });

  readonly displayedCategories = computed<readonly string[]>(() => {
    const list = this.displayedAssets();
    const cats = new Set<string>(['All']);
    for (const a of list) {
      if (a.category) cats.add(a.category);
    }
    return Array.from(cats);
  });

  readonly show3dCanvas = computed(
    () => this.dimensionMode() === '3d' && this.cameraView() !== 'real-2d',
  );
  readonly show2dCanvas = computed(
    () =>
      this.dimensionMode() === '2d' ||
      this.cameraView() === 'real-2d' ||
      this.cameraView() === 'split-2d-3d',
  );

  @HostListener('window:keydown.escape')
  onEscapePressed(): void {
    if (this.assetModalOpen()) {
      this.assetModalOpen.set(false);
      return;
    }
    this.cancelActivePlacement();
  }

  ngAfterViewInit(): void {
    this.pngApi.loadPngAssetManifest();
  }

  ngOnDestroy(): void {
    this.stage.dispose();
  }

  cancelActivePlacement(): void {
    if (this.wallStartAnchor() || this.freehandWallPoints().length > 0) {
      this.wallStartAnchor.set(null);
      this.freehandWallPoints.set([]);
      this.syncGhostCursorToStage();
      this.pngPipelineBanner.set('Canceled wall placement.');
      return;
    }
    this.selectedPlacedId.set(null);
    this.selectedPlacedKind.set(null);
    this.selectedPlacedWallId.set(null);
    this.stage.focusGizmoAt(null);
    this.activeDockToolId.set('select');
    this.syncSurfaceLock();
    this.syncGhostCursorToStage();
  }

  private mountStudioViewports(): void {
    setTimeout(() => {
      const canvas = this.canvasRef?.nativeElement;
      if (canvas) {
        this.stage.mountCanvas(
          canvas,
          this.sceneGraph(),
          (x, z, pickedMeta) => this.applyCanvasStrokeAt(x, z, pickedMeta),
          (hx, hz) => this.onCanvasHoverAt(hx, hz),
          (dx, dz, holdTicks) => this.onSurfaceDragAt(dx, dz, holdTicks),
          (rx, rz) => this.onSurfaceReleaseAt(rx, rz),
        );
        this.syncSurfaceLock();
        this.syncGhostCursorToStage();
        this.pushCelestialLightToStage();
      }
      this.render2dViewport();
    }, 35);
  }

  private syncSurfaceLock(): void {
    const tool = this.activeDockToolId();
    const isFreehandWall =
      (tool === 'wall' || tool === 'room') && this.wallDrawMode() === 'freehand';
    const shouldLockSurface =
      tool === 'terrain' || tool === 'water' || tool === 'scatter' || isFreehandWall;
    this.stage.setSurfaceDrawingLock(shouldLockSurface);
  }

  onCreateMapFromLanding(intent: LwCreateMapLaunchIntent): void {
    this.mapTitle.set(intent.name);
    this.studio.mapTitle.set(intent.name);
    this.gridCols.set(intent.gridCols);
    this.gridRows.set(intent.gridRows);
    this.store.setCampaign(intent.campaignId);
    this.assignSessionId.set(intent.sessionId);
    this.assignEncounterId.set(intent.encounterId);
    this.dimensionMode.set(intent.dimensionMode);
    this.cameraView.set(intent.dimensionMode === '2d' ? 'real-2d' : 'isometric');

    const starterFloor = this.pngApi
      .bumpHeightAssets2d()
      .find((f) => f.id === intent.starterFloorBumpId && f.isFloor);

    this.stage.resetTerrainElevations();
    const blank = createBlankSceneGraph(intent.name);
    this.sceneGraph.set({
      ...blank,
      floorAlbedoUrl: starterFloor?.albedoUrl,
      floorNormalUrl: starterFloor?.normalUrl,
      floorTilingScale: this.floorTilingScale(),
    });
    this.selectedPlacedId.set(null);
    this.selectedPlacedKind.set(null);
    this.wallStartAnchor.set(null);
    this.freehandWallPoints.set([]);
    this.activeDockToolId.set('select');
    this.leftDockCollapsed.set(false);
    this.rightDockCollapsed.set(true);
    this.showLandingHub.set(false);
    this.mountStudioViewports();
  }

  onOpenExistingMapFromLanding(summary: LwExistingMapSummary): void {
    this.selectedSceneKey.set(summary.sceneKey);
    this.mapTitle.set(summary.name);
    this.studio.mapTitle.set(summary.name);
    this.store.setCampaign(summary.campaignId);
    this.dimensionMode.set(summary.dimensionMode);
    this.cameraView.set(summary.dimensionMode === '2d' ? 'real-2d' : 'isometric');
    this.sceneGraph.set(
      summary.sceneKey === 'scene-cinth-ballroom'
        ? INITIAL_CINTH_SCENE_GRAPH
        : createBlankSceneGraph(summary.name, summary.sceneKey),
    );
    this.selectedPlacedId.set(null);
    this.selectedPlacedKind.set(null);
    this.wallStartAnchor.set(null);
    this.freehandWallPoints.set([]);
    this.activeDockToolId.set('select');
    this.leftDockCollapsed.set(false);
    this.rightDockCollapsed.set(true);
    this.showLandingHub.set(false);
    this.mountStudioViewports();
  }

  onDimensionModeSwitch(mode: LwMapDimensionMode): void {
    this.dimensionMode.set(mode);
    this.onCameraViewChange(mode === '2d' ? 'real-2d' : 'isometric');
    if (mode === '3d') this.mountStudioViewports();
  }

  onDockToolSelected(dockToolId: string): void {
    this.activeDockToolId.set(dockToolId);
    this.rightDockCollapsed.set(false);
    this.wallStartAnchor.set(null);
    this.freehandWallPoints.set([]);
    this.activeWaterSplineId = null;

    if (dockToolId !== 'select') {
      this.selectedPlacedId.set(null);
      this.selectedPlacedKind.set(null);
      this.selectedPlacedWallId.set(null);
      this.stage.focusGizmoAt(null);
    }
    if (dockToolId === 'room' && this.wallDrawMode() === 'line') {
      this.wallDrawMode.set('room');
    } else if (dockToolId === 'wall') {
      this.wallDrawMode.set('line');
    }

    if (dockToolId === 'floor-bump') {
      const firstFloor = this.pngApi.bumpHeightAssets2d().find((a) => a.isFloor);
      if (firstFloor) this.equipAssetOnNode(firstFloor);
    } else if (dockToolId === 'wall' || dockToolId === 'room') {
      const firstWall =
        this.pngApi.pngAssets3d().find((a) => this.isWallAsset(a)) ??
        this.pngApi.pngAssets3d()[0];
      if (firstWall) this.equipAssetOnNode(firstWall);
    } else if (dockToolId === 'door') {
      const firstDoor =
        this.pngApi.pngAssets3d().find((a) => this.isDoorAsset(a)) ??
        this.pngApi.pngAssets3d()[0];
      if (firstDoor) this.equipAssetOnNode(firstDoor);
    } else if (dockToolId === 'objects') {
      const curId = this.selectedNode().id;
      const curAsset = this.pngApi.pngAssets3d().find((a) => a.id === curId);
      if (!curAsset || this.isWallAsset(curAsset) || this.isDoorAsset(curAsset)) {
        const firstProp =
          this.pngApi
            .pngAssets3d()
            .find((a) => !a.isFloor && !this.isWallAsset(a) && !this.isDoorAsset(a)) ??
          this.pngApi.pngAssets3d()[0];
        if (firstProp) this.equipAssetOnNode(firstProp);
      }
    }

    this.syncSurfaceLock();
    this.pushCelestialLightToStage();
    this.syncGhostCursorToStage();
  }

  private equipAssetOnNode(asset: LwMapPngAssetItem): void {
    this.selectedPngAssetId.set(asset.id);
    const isWall = this.isWallAsset(asset);
    const isDoor = this.isDoorAsset(asset);
    this.selectedNode.update((cur) => ({
      ...cur,
      id: asset.id,
      name: asset.name,
      kind: isDoor ? 'door' : isWall ? 'wall' : 'prop',
      subtitle: asset.modelUrl
        ? `3D .GLB · ${asset.category}`
        : asset.isFloor
          ? 'Seamless 2D Bump/Height Flooring'
          : `2D Floor Stamp · ${asset.category}`,
      thumbnailUrl: asset.thumbnailUrl,
      modelUrl: asset.modelUrl || undefined,
      albedoUrl: asset.albedoUrl,
      normalUrl: asset.normalUrl,
      isFloor: asset.isFloor,
    }));
  }

  onSelectPngAsset(asset: LwMapPngAssetItem): void {
    this.equipAssetOnNode(asset);

    if (asset.isFloor && asset.albedoUrl && asset.normalUrl) {
      this.applyFloorTextureToScene(asset.name, asset.albedoUrl, asset.normalUrl);
      return;
    }

    // If a placed Wall, Door, or Object is currently selected, live-swap its 3D asset!
    const placedId = this.selectedPlacedId();
    const placedKind = this.selectedPlacedKind();
    if (placedId && placedKind === 'wall') {
      this.commitSceneUpdate((cur) => ({
        ...cur,
        revision: cur.revision + 1,
        walls: (cur.walls ?? []).map((w) =>
          w.id === placedId
            ? {
                ...w,
                name: asset.name,
                modelUrl: asset.modelUrl || undefined,
                albedoUrl: asset.albedoUrl,
                normalUrl: asset.normalUrl,
                thumbnailUrl: asset.thumbnailUrl,
              }
            : w,
        ),
      }));
      this.pngPipelineBanner.set(`Updated Wall Texture/Model -> ${asset.name}`);
      return;
    }
    if (placedId && placedKind === 'door') {
      this.commitSceneUpdate((cur) => ({
        ...cur,
        revision: cur.revision + 1,
        walls: (cur.walls ?? []).map((w) => ({
          ...w,
          openings: w.openings.map((op) =>
            op.id === placedId
              ? {
                  ...op,
                  name: asset.name,
                  modelUrl: asset.modelUrl || undefined,
                  thumbnailUrl: asset.thumbnailUrl,
                }
              : op,
          ),
        })),
      }));
      this.pngPipelineBanner.set(`Updated Door 3D Model -> ${asset.name}`);
      return;
    }
    if (placedId && placedKind === 'object') {
      const isDecal = Boolean(asset.albedoUrl && !asset.modelUrl && !asset.isFloor);
      this.commitSceneUpdate((cur) => ({
        ...cur,
        revision: cur.revision + 1,
        stamps: cur.stamps.map((s) =>
          s.id === placedId
            ? {
                ...s,
                label: asset.name,
                category: isDecal ? 'DecalStamp' : 'Prop',
                modelUrl: asset.modelUrl || undefined,
                albedoUrl: isDecal ? asset.albedoUrl : undefined,
                normalUrl: isDecal ? asset.normalUrl : undefined,
                thumbnailUrl: asset.thumbnailUrl,
              }
            : s,
        ),
      }));
      this.pngPipelineBanner.set(`Updated Object Model -> ${asset.name}`);
      return;
    }

    this.syncGhostCursorToStage();
  }

  private applyFloorTextureToScene(name: string, albedoUrl: string, normalUrl: string): void {
    this.stage.applyFloorBumpMap(albedoUrl, normalUrl, this.floorTilingScale());
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      floorAlbedoUrl: albedoUrl,
      floorNormalUrl: normalUrl,
      floorTilingScale: this.floorTilingScale(),
    }));
    this.pngPipelineBanner.set(`Applied Seamless Flooring: ${name}`);
    this.syncGhostCursorToStage();
  }

  onFloorTilingChange(scale: number): void {
    this.floorTilingScale.set(scale);
    const node = this.selectedNode();
    const albedo = node.albedoUrl || this.sceneGraph().floorAlbedoUrl;
    const normal = node.normalUrl || this.sceneGraph().floorNormalUrl;
    if (albedo && normal) {
      this.stage.applyFloorBumpMap(albedo, normal, scale);
      this.commitSceneUpdate((cur) => ({
        ...cur,
        floorTilingScale: scale,
      }));
    }
  }

  syncGhostCursorToStage(): void {
    const tool = this.activeDockToolId();
    const node = this.selectedNode();
    const isDecalStamp = Boolean(node.albedoUrl && !node.modelUrl && !node.isFloor);
    const kind =
      tool === 'wall' || tool === 'room'
        ? 'wall'
        : tool === 'door'
          ? 'door'
          : tool === 'terrain'
            ? 'terrain'
            : tool === 'water'
              ? 'water'
              : tool === 'scatter'
                ? 'scatter'
                : tool === 'lighting'
                  ? 'light'
                  : isDecalStamp
                    ? 'decal'
                    : 'prop';
    const scale =
      tool === 'terrain' || tool === 'scatter'
        ? this.terrainBrushRadius()
        : tool === 'water'
          ? this.waterWidthMeters() * 0.5
          : tool === 'lighting'
            ? this.lightPlacementWidth()
            : tool === 'door'
              ? this.doorWidthMeters()
              : node.scale;

    this.stage.setGhostConfig(
      {
        enabled: tool !== 'select' && tool !== 'floor-bump' && tool !== 'sun-moon',
        label: node.name,
        kind,
        modelUrl: node.modelUrl,
        albedoUrl: node.albedoUrl,
        normalUrl: node.normalUrl,
        thumbnailUrl: node.thumbnailUrl,
        scale,
        offsetY: node.elevationY,
        rotationRad: (node.rotationDeg * Math.PI) / 180,
        heightMeters: tool === 'door' ? this.doorHeightMeters() : node.heightSquares * 1.5,
        thicknessMeters: 0.45 * node.thickness,
        wallDrawMode: this.wallDrawMode(),
        freehandPoints: this.freehandWallPoints(),
      },
      this.wallStartAnchor(),
    );
  }

  onCanvasHoverAt(hx: number, hz: number): void {
    if (this.activeDockToolId() === 'sun-moon') {
      this.celestialAzimuthDeg.set(Math.round(((Math.atan2(hz, hx) * 180) / Math.PI + 360) % 360));
      this.celestialAltitudeDeg.set(
        Math.max(10, Math.min(86, Math.round(85 - Math.min(20, Math.hypot(hx, hz)) * 3.4))),
      );
      this.pushCelestialLightToStage();
    }
    if (this.show2dCanvas()) this.render2dViewport(hx, hz);
  }

  onSurfaceDragAt(x: number, z: number, holdTicks: number): void {
    const tool = this.activeDockToolId();
    if (tool === 'terrain') {
      const rateFactor = this.terrainGradualRate() / 100;
      const stepDelta = Math.max(0.06, this.terrainBrushDelta() * rateFactor * 0.22);
      const expandedRadius =
        this.terrainBrushRadius() * (1 + Math.min(1.6, holdTicks * 0.04 * rateFactor));
      this.stage.sculptTerrainAt(x, z, expandedRadius, stepDelta, this.terrainSculptOp());
      return;
    }

    if (tool === 'water') {
      if (!this.activeWaterSplineId) {
        this.activeWaterSplineId = `water-${Date.now()}`;
        this.commitSceneUpdate((cur) => ({
          ...cur,
          revision: cur.revision + 1,
          waterSplines: [
            ...cur.waterSplines,
            {
              id: this.activeWaterSplineId!,
              name: 'River Stream',
              width: this.waterWidthMeters(),
              flowSpeed: this.waterFlowSpeed(),
              colorHex: '#1b6d82',
              points: [[x, 0.09, z]],
            },
          ],
        }));
        return;
      }
      this.commitSceneUpdate((cur) => ({
        ...cur,
        waterSplines: cur.waterSplines.map((ws) => {
          if (ws.id !== this.activeWaterSplineId) return ws;
          const last = ws.points[ws.points.length - 1];
          if (last && Math.hypot(x - last[0], z - last[2]) < 0.45) return ws;
          return { ...ws, points: [...ws.points, [x, 0.09, z]] };
        }),
      }));
      return;
    }

    if (tool === 'scatter') {
      if (
        this.lastScatterPaintPos &&
        Math.hypot(x - this.lastScatterPaintPos.x, z - this.lastScatterPaintPos.z) < 1.35
      ) {
        return;
      }
      this.lastScatterPaintPos = { x, z };
      const node = this.selectedNode();
      this.commitSceneUpdate((cur) => ({
        ...cur,
        revision: cur.revision + 1,
        scatterClusters: [
          ...(cur.scatterClusters ?? []),
          {
            id: `scat-${Date.now()}-${(cur.scatterClusters ?? []).length}`,
            x,
            z,
            radius: this.terrainBrushRadius(),
            density: this.scatterDensity(),
            seed: Math.round(Math.abs(x * 137 + z * 293)) + cur.revision * 17,
            modelUrl: node.modelUrl,
            label: node.name,
          },
        ],
      }));
      return;
    }

    if ((tool === 'wall' || tool === 'room') && this.wallDrawMode() === 'freehand') {
      const pts = this.freehandWallPoints();
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(x - last[0], z - last[1]) >= 0.65) {
        this.freehandWallPoints.set([...pts, [x, z]]);
        this.syncGhostCursorToStage();
      }
    }
  }

  onSurfaceReleaseAt(x: number, z: number): void {
    this.activeWaterSplineId = null;
    this.lastScatterPaintPos = null;
    const tool = this.activeDockToolId();
    if ((tool === 'wall' || tool === 'room') && this.wallDrawMode() === 'freehand') {
      const pts = this.freehandWallPoints();
      if (pts.length >= 2) {
        const node = this.selectedNode();
        const newWall: MapWallSegmentNode = {
          id: `wall-${this.sceneGraph().revision + 1}`,
          name: node.name,
          drawMode: 'freehand',
          material: 'Crypt Ashlar Stone',
          modelUrl: node.modelUrl,
          albedoUrl: node.albedoUrl,
          normalUrl: node.normalUrl,
          thumbnailUrl: node.thumbnailUrl,
          heightMeters: node.heightSquares * 1.5,
          thicknessMeters: 0.45 * node.thickness,
          perspective: 'auto',
          projection: 'inward',
          hasCornerPosts: false,
          levelIndex: 0,
          points: pts,
          openings: [],
        };
        this.freehandWallPoints.set([]);
        this.recordHistoryBeforeEdit('Draw Freehand 3D Wall');
        this.commitSceneUpdate((cur) => ({
          ...cur,
          revision: cur.revision + 1,
          walls: [...(cur.walls ?? []), newWall],
        }));
        this.syncGhostCursorToStage();
      } else {
        this.freehandWallPoints.set([]);
      }
    }
  }

  private selectPlacedEntity(meta: PickedSceneEntityMeta, fallbackX: number, fallbackZ: number): boolean {
    const kind = meta.lwKind;
    const id = meta.lwEntityId;
    if (!kind || !id) return false;

    const state = this.sceneGraph();
    this.selectedPlacedId.set(id);
    this.selectedPlacedKind.set(kind);
    this.selectedPlacedWallId.set(meta.lwWallId ?? null);
    this.rightDockCollapsed.set(false);

    if (kind === 'wall') {
      const wall = (state.walls ?? []).find((w) => w.id === id);
      if (wall) {
        const p0 = wall.points[0] ?? [fallbackX, fallbackZ];
        this.selectedNode.update((cur) => ({
          ...cur,
          id: wall.id,
          name: wall.name,
          kind: 'wall',
          subtitle: `3D Wall · ${Math.round(wall.heightMeters / 0.3048)} ft`,
          thumbnailUrl: wall.thumbnailUrl || cur.thumbnailUrl,
          modelUrl: wall.modelUrl,
          albedoUrl: wall.albedoUrl,
          normalUrl: wall.normalUrl,
          heightSquares: Math.max(1, Math.round(wall.heightMeters / 1.5)),
          thickness: Math.round((wall.thicknessMeters / 0.45) * 100) / 100,
          gridX: p0[0],
          gridZ: p0[1],
        }));
        this.stage.focusGizmoAt(p0[0], 0.1, p0[1]);
        return true;
      }
    }

    if (kind === 'door') {
      const parentWall = (state.walls ?? []).find((w) =>
        w.openings.some((op) => op.id === id),
      );
      const op = parentWall?.openings.find((o) => o.id === id);
      if (parentWall && op) {
        this.selectedPlacedWallId.set(parentWall.id);
        this.doorWallPositionPct.set(Math.round(op.t * 100));
        this.doorWidthMeters.set(op.widthMeters);
        this.doorHeightMeters.set(op.heightMeters ?? 2.6);
        this.doorIsOpen.set(op.isOpen);
        this.selectedNode.update((cur) => ({
          ...cur,
          id: op.id,
          name: op.name || 'Gothic Arch Door',
          kind: 'door',
          subtitle: `Wall Cutout Door · ${op.widthMeters.toFixed(1)}m`,
          thumbnailUrl: op.thumbnailUrl || '/assets/previews-png/obj-89c62a2b01238531.png',
          modelUrl: op.modelUrl || '/assets/object-library/models/obj-89c62a2b01238531.glb',
        }));
        this.stage.focusGizmoAt(fallbackX, 0.1, fallbackZ);
        return true;
      }
    }

    if (kind === 'object') {
      const st = state.stamps.find((s) => s.id === id);
      if (st) {
        this.selectedNode.update((cur) => ({
          ...cur,
          id: st.id,
          name: st.label,
          kind: 'prop',
          subtitle: st.modelUrl ? 'Placed 3D .GLB Object' : 'Placed 2D Floor Stamp',
          thumbnailUrl: st.thumbnailUrl || st.albedoUrl || cur.thumbnailUrl,
          modelUrl: st.modelUrl,
          albedoUrl: st.albedoUrl,
          normalUrl: st.normalUrl,
          gridX: st.x,
          gridZ: st.z,
          elevationY: st.offsetY ?? 0,
          scale: st.scale,
          scaleX: st.scaleX ?? 1,
          scaleY: st.scaleY ?? 1,
          scaleZ: st.scaleZ ?? 1,
          rotationDeg: Math.round((st.rotationY * 180) / Math.PI),
          tiltDeg: st.tiltX ?? 0,
          gmSecretOnly: Boolean(st.gmSecretOnly),
        }));
        this.stage.focusGizmoAt(st.x, (st.offsetY ?? 0) + 0.1, st.z);
        return true;
      }
    }

    if (kind === 'light') {
      const lt = state.lights.find((l) => l.id === id);
      if (lt) {
        this.customLightKind.set(lt.kind ?? 'torch');
        this.customLightColor.set(lt.colorHex);
        this.customLightRange.set(lt.range);
        this.lightPlacementWidth.set(lt.widthMeters ?? 2.0);
        this.lightHeightMeters.set(lt.y);
        this.torchIntensity.set(Math.round(lt.intensity * 100));
        this.lightShowFixture.set(lt.showFixture !== false);
        this.stage.focusGizmoAt(lt.x, 0.1, lt.z);
        return true;
      }
    }

    return false;
  }

  applyCanvasStrokeAt(x: number, z: number, pickedMeta?: PickedSceneEntityMeta): void {
    const dockTool = this.activeDockToolId();

    if (dockTool === 'select') {
      if (pickedMeta && this.selectPlacedEntity(pickedMeta, x, z)) {
        return;
      }
      this.selectedPlacedId.set(null);
      this.selectedPlacedKind.set(null);
      this.selectedPlacedWallId.set(null);
      this.stage.focusGizmoAt(null);
      return;
    }

    if (dockTool === 'terrain' || dockTool === 'water' || dockTool === 'scatter') {
      // Handled continuously by onSurfaceDragAt
      return;
    }

    if (dockTool === 'floor-bump') {
      const node = this.selectedNode();
      if (node.albedoUrl && node.normalUrl) {
        this.applyFloorTextureToScene(node.name, node.albedoUrl, node.normalUrl);
      }
      return;
    }

    if (dockTool === 'sun-moon') {
      this.celestialAzimuthDeg.set(Math.round(((Math.atan2(z, x) * 180) / Math.PI + 360) % 360));
      this.celestialAltitudeDeg.set(
        Math.max(10, Math.min(86, Math.round(85 - Math.min(20, Math.hypot(x, z)) * 3.4))),
      );
      this.activeDockToolId.set('select');
      this.syncSurfaceLock();
      this.pushCelestialLightToStage();
      this.syncGhostCursorToStage();
      const bodyLabel = this.celestialMode() === 'sun' ? 'Sun' : 'Moon';
      this.pngPipelineBanner.set(
        `Placed ${bodyLabel} at Azimuth ${this.celestialAzimuthDeg()}° / Altitude ${this.celestialAltitudeDeg()}°.`,
      );
      return;
    }

    if (dockTool === 'lighting') {
      this.onSpawnCustomLightAt(x, z);
      return;
    }

    if (dockTool === 'door') {
      this.placeDoorCutoutOnClosestWall(x, z);
      return;
    }

    if (dockTool === 'wall' || dockTool === 'room') {
      if (this.wallDrawMode() === 'freehand') {
        return;
      }
      const anchor = this.wallStartAnchor();
      if (!anchor) {
        this.wallStartAnchor.set({ x, z });
        this.syncGhostCursorToStage();
        return;
      }
      if (Math.hypot(x - anchor.x, z - anchor.z) < 0.25) {
        return;
      }
      const pts = WallMeshBuilder.buildShapePoints(this.wallDrawMode(), anchor.x, anchor.z, x, z);
      const node = this.selectedNode();
      const newWall: MapWallSegmentNode = {
        id: `wall-${this.sceneGraph().revision + 1}`,
        name: node.name,
        drawMode: this.wallDrawMode(),
        material: 'Crypt Ashlar Stone',
        modelUrl: node.modelUrl,
        albedoUrl: node.albedoUrl,
        normalUrl: node.normalUrl,
        thumbnailUrl: node.thumbnailUrl,
        heightMeters: node.heightSquares * 1.5,
        thicknessMeters: 0.45 * node.thickness,
        perspective: 'auto',
        projection: 'inward',
        hasCornerPosts: false,
        levelIndex: 0,
        points: pts,
        openings: [],
      };
      this.wallStartAnchor.set(null);
      this.recordHistoryBeforeEdit(`Draw 3D Wall (${this.wallDrawMode()})`);
      this.commitSceneUpdate((cur) => ({
        ...cur,
        revision: cur.revision + 1,
        walls: [...(cur.walls ?? []), newWall],
      }));
      this.syncGhostCursorToStage();
      return;
    }

    if (dockTool === 'objects' || dockTool === 'annotate') {
      this.placeStampAt(x, z);
    }
  }

  private placeDoorCutoutOnClosestWall(x: number, z: number): void {
    const walls = this.sceneGraph().walls ?? [];
    const hit = WallMeshBuilder.findClosestWallAttachment(walls, x, z, 6.0);
    if (!hit) {
      this.pngPipelineBanner.set('Move cursor near an existing wall to attach and cut a Door.');
      return;
    }
    const node = this.selectedNode();
    const doorId = `door-${this.sceneGraph().revision + 1}`;
    const newOpening: WallOpeningNode = {
      id: doorId,
      type: 'door',
      name: node.name,
      modelUrl: node.modelUrl || '/assets/object-library/models/obj-89c62a2b01238531.glb',
      thumbnailUrl: node.thumbnailUrl || '/assets/previews-png/obj-89c62a2b01238531.png',
      t: hit.t,
      widthMeters: this.doorWidthMeters(),
      heightMeters: this.doorHeightMeters(),
      isOpen: this.doorIsOpen(),
      isSecret: false,
      isRevealedToPlayers: true,
    };

    this.recordHistoryBeforeEdit(`Cut Door (${node.name}) into Wall`);
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      walls: (cur.walls ?? []).map((w) =>
        w.id === hit.wallId ? { ...w, openings: [...w.openings, newOpening] } : w,
      ),
    }));
    this.selectedPlacedId.set(doorId);
    this.selectedPlacedKind.set('door');
    this.selectedPlacedWallId.set(hit.wallId);
    this.doorWallPositionPct.set(Math.round(hit.t * 100));
    this.stage.focusGizmoAt(hit.x, 0.1, hit.z);
    this.pngPipelineBanner.set(`Cut ${node.name} into wall. Adjust size or position in right panel.`);
  }

  private placeStampAt(x: number, z: number): void {
    const node = this.selectedNode();
    const isDecal = Boolean(node.albedoUrl && !node.modelUrl && !node.isFloor);
    const stampId = `st-${this.sceneGraph().revision + 1}`;
    this.recordHistoryBeforeEdit(`Place -> ${node.name}`);
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      stamps: [
        ...cur.stamps,
        {
          id: stampId,
          label: node.name,
          category: isDecal ? 'DecalStamp' : 'Prop',
          modelUrl: node.modelUrl,
          albedoUrl: isDecal ? node.albedoUrl : undefined,
          normalUrl: isDecal ? node.normalUrl : undefined,
          thumbnailUrl: node.thumbnailUrl,
          x,
          z,
          offsetY: node.elevationY,
          scale: node.scale,
          scaleX: node.scaleX ?? 1,
          scaleY: node.scaleY ?? 1,
          scaleZ: node.scaleZ ?? 1,
          rotationY: (node.rotationDeg * Math.PI) / 180,
          tiltX: node.tiltDeg ?? 0,
          colorHex: '#56b886',
          gmSecretOnly: node.gmSecretOnly,
        },
      ],
    }));
    this.selectedPlacedId.set(stampId);
    this.selectedPlacedKind.set('object');
    this.selectedNode.update((cur) => ({ ...cur, gridX: x, gridZ: z }));
    this.stage.focusGizmoAt(x, node.elevationY + 0.1, z);
  }

  onDeleteSelectedPlacedNode(): void {
    const pickedId = this.selectedPlacedId();
    const pickedKind = this.selectedPlacedKind();
    if (!pickedId) return;
    this.recordHistoryBeforeEdit('Delete Selected Item');
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      stamps: pickedKind === 'object' ? cur.stamps.filter((s) => s.id !== pickedId) : cur.stamps,
      walls:
        pickedKind === 'wall'
          ? (cur.walls ?? []).filter((w) => w.id !== pickedId)
          : pickedKind === 'door'
            ? (cur.walls ?? []).map((w) => ({
                ...w,
                openings: w.openings.filter((op) => op.id !== pickedId),
              }))
            : cur.walls,
      lights: pickedKind === 'light' ? cur.lights.filter((l) => l.id !== pickedId) : cur.lights,
    }));
    this.selectedPlacedId.set(null);
    this.selectedPlacedKind.set(null);
    this.selectedPlacedWallId.set(null);
    this.stage.focusGizmoAt(null);
  }

  onSpawnCustomLightAt(x?: number, z?: number): void {
    const coords = this.stage.lastPickedCoords();
    const lx = x ?? coords.x;
    const lz = z ?? coords.z;
    const lightId = `light-${this.sceneGraph().revision + 1}`;
    this.recordHistoryBeforeEdit('Add Scene Light');
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      lights: [
        ...cur.lights,
        {
          id: lightId,
          label: `${this.customLightKind().toUpperCase()} Light`,
          kind: this.customLightKind(),
          colorHex: this.customLightColor(),
          intensity: this.torchIntensity() / 100,
          range: this.customLightRange(),
          widthMeters: this.lightPlacementWidth(),
          x: lx,
          y: this.lightHeightMeters(),
          z: lz,
          showFixture: this.lightShowFixture(),
        },
      ],
    }));
    this.selectedPlacedId.set(lightId);
    this.selectedPlacedKind.set('light');
    this.stage.focusGizmoAt(lx, 0.1, lz);
  }

  private syncActiveOrLastLight(): void {
    const targetId =
      this.selectedPlacedKind() === 'light' ? this.selectedPlacedId() : null;
    this.commitSceneUpdate((cur) => {
      if (cur.lights.length === 0) return cur;
      const idxToUpdate = targetId
        ? cur.lights.findIndex((l) => l.id === targetId)
        : cur.lights.length - 1;
      if (idxToUpdate < 0) return cur;
      return {
        ...cur,
        revision: cur.revision + 1,
        lights: cur.lights.map((lt, idx) =>
          idx === idxToUpdate
            ? {
                ...lt,
                kind: this.customLightKind(),
                colorHex: this.customLightColor(),
                range: this.customLightRange(),
                widthMeters: this.lightPlacementWidth(),
                y: this.lightHeightMeters(),
                intensity: this.torchIntensity() / 100,
                showFixture: this.lightShowFixture(),
              }
            : lt,
        ),
      };
    });
  }

  onLightPropertyChanged(): void {
    this.syncGhostCursorToStage();
    this.syncActiveOrLastLight();
  }

  onDoorPropertyChanged(): void {
    this.syncGhostCursorToStage();
    const doorId = this.selectedPlacedKind() === 'door' ? this.selectedPlacedId() : null;
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      walls: (cur.walls ?? []).map((w) => ({
        ...w,
        openings: w.openings.map((op, idx) =>
          (doorId ? op.id === doorId : idx === w.openings.length - 1)
            ? {
                ...op,
                t: this.doorWallPositionPct() / 100,
                widthMeters: this.doorWidthMeters(),
                heightMeters: this.doorHeightMeters(),
                isOpen: this.doorIsOpen(),
              }
            : op,
        ),
      })),
    }));
  }

  pushCelestialLightToStage(): void {
    this.stage.updateCelestialLight({
      mode: this.celestialMode(),
      azimuthDeg: this.celestialAzimuthDeg(),
      altitudeDeg: this.celestialAltitudeDeg(),
      shadowDarkness: this.shadowDarkness(),
      showSkyOrb: this.activeDockToolId() === 'sun-moon',
    });
  }

  onGridModeChange(mode: string): void {
    this.gridSizeLabel.set(mode);
    this.stage.setGridMode(mode);
    this.render2dViewport();
  }

  on2dCanvasMove(event: MouseEvent): void {
    const canvas = this.canvas2dRef?.nativeElement;
    if (!canvas) return;
    const coords = Real2dMapRenderer.screenToWorld(canvas, event.clientX, event.clientY);
    this.onCanvasHoverAt(coords.x, coords.z);
    if (event.buttons === 1) {
      this.onSurfaceDragAt(coords.x, coords.z, 1);
    }
  }

  on2dCanvasClick(event: MouseEvent): void {
    const canvas = this.canvas2dRef?.nativeElement;
    if (!canvas) return;
    const coords = Real2dMapRenderer.screenToWorld(canvas, event.clientX, event.clientY);
    this.applyCanvasStrokeAt(coords.x, coords.z);
  }

  private render2dViewport(ghostX?: number, ghostZ?: number): void {
    const canvas = this.canvas2dRef?.nativeElement;
    if (!canvas) return;
    Real2dMapRenderer.renderSceneToCanvas(canvas, this.sceneGraph(), {
      hideGmSecrets: this.showPlayerSafeOnly(),
      selectedNodeId: this.selectedPlacedId() ?? this.selectedNode().id,
      gridMode: this.gridSizeLabel(),
      floorAlbedoUrl: this.sceneGraph().floorAlbedoUrl,
      floorTilingScale: this.floorTilingScale(),
      ghostX,
      ghostZ,
      ghostLabel: this.selectedNode().name,
      wallStartAnchor: this.wallStartAnchor(),
      celestialMode: this.celestialMode(),
      celestialAzimuthDeg: this.celestialAzimuthDeg(),
      celestialAltitudeDeg: this.celestialAltitudeDeg(),
      onImageLoaded: () => this.render2dViewport(),
    });
  }

  onCameraViewChange(view: LwMapCameraView): void {
    this.cameraView.set(view);
    this.stage.setCameraMode(view);
    setTimeout(() => {
      this.stage.resize();
      this.render2dViewport();
    }, 30);
  }

  onThemeChange(theme: string): void {
    this.activeTheme.set(theme);
    this.commitSceneUpdate((cur) => ({ ...cur, biome: theme, revision: cur.revision + 1 }));
  }

  onQualityChange(preset: LwMapQualityPreset): void {
    this.activeQuality.set(preset);
    this.stage.setQualityPreset(preset);
  }

  onTogglePlayerSafeView(): void {
    this.showPlayerSafeOnly.update((v) => !v);
    this.stage.setPlayerSafeFilter(this.showPlayerSafeOnly(), this.sceneGraph());
    this.render2dViewport();
  }

  onExportScenePng(variant: 'gm' | 'player-safe'): void {
    this.showPlayerSafeOnly.set(variant === 'player-safe');
    this.stage.setPlayerSafeFilter(variant === 'player-safe', this.sceneGraph());
    this.render2dViewport();
    this.pngPipelineBanner.set(
      `Exported ${variant === 'player-safe' ? 'Player-Safe' : 'GM Master'} PNG.`,
    );
  }

  private updateTargetStamp(
    updater: (s: MapSceneGraphState['stamps'][number]) => MapSceneGraphState['stamps'][number],
  ): void {
    const targetId =
      this.selectedPlacedKind() === 'object' ? this.selectedPlacedId() : null;
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      stamps: cur.stamps.map((s, idx) =>
        (targetId ? s.id === targetId : idx === cur.stamps.length - 1) ? updater(s) : s,
      ),
    }));
  }

  onInspectorPositionChange(axis: 'x' | 'z', value: number): void {
    this.selectedNode.update((cur) =>
      axis === 'x' ? { ...cur, gridX: value } : { ...cur, gridZ: value },
    );
    this.updateTargetStamp((s) => (axis === 'x' ? { ...s, x: value } : { ...s, z: value }));
  }

  onInspectorElevationChange(elevationY: number): void {
    this.selectedNode.update((cur) => ({ ...cur, elevationY }));
    this.syncGhostCursorToStage();
    this.updateTargetStamp((s) => ({ ...s, offsetY: elevationY }));
  }

  onInspectorHeightChange(heightSquares: number): void {
    this.selectedNode.update((cur) => ({
      ...cur,
      heightSquares,
      subtitle: `3D Wall · ${heightSquares * 5} ft`,
    }));
    this.syncGhostCursorToStage();
    const targetWallId =
      this.selectedPlacedKind() === 'wall' ? this.selectedPlacedId() : null;
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      walls: (cur.walls ?? []).map((w, idx, arr) =>
        (targetWallId ? w.id === targetWallId : idx === arr.length - 1)
          ? { ...w, heightMeters: heightSquares * 1.5 }
          : w,
      ),
    }));
  }

  onInspectorThicknessChange(thickness: number): void {
    this.selectedNode.update((cur) => ({ ...cur, thickness }));
    this.syncGhostCursorToStage();
    const targetWallId =
      this.selectedPlacedKind() === 'wall' ? this.selectedPlacedId() : null;
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      walls: (cur.walls ?? []).map((w, idx, arr) =>
        (targetWallId ? w.id === targetWallId : idx === arr.length - 1)
          ? { ...w, thicknessMeters: 0.45 * thickness }
          : w,
      ),
    }));
  }

  onInspectorRotationChange(rotationDeg: number): void {
    this.selectedNode.update((cur) => ({ ...cur, rotationDeg }));
    this.syncGhostCursorToStage();
    const rad = (rotationDeg * Math.PI) / 180;
    this.updateTargetStamp((s) => ({ ...s, rotationY: rad }));
  }

  onInspectorTiltChange(tiltDeg: number): void {
    this.selectedNode.update((cur) => ({ ...cur, tiltDeg }));
    this.updateTargetStamp((s) => ({ ...s, tiltX: tiltDeg }));
  }

  onInspectorScaleChange(scale: number): void {
    this.selectedNode.update((cur) => ({ ...cur, scale }));
    this.syncGhostCursorToStage();
    this.updateTargetStamp((s) => ({ ...s, scale }));
  }

  onInspectorAxisScaleChange(axis: 'x' | 'y' | 'z', val: number): void {
    this.selectedNode.update((cur) =>
      axis === 'x'
        ? { ...cur, scaleX: val }
        : axis === 'y'
          ? { ...cur, scaleY: val }
          : { ...cur, scaleZ: val },
    );
    this.updateTargetStamp((s) =>
      axis === 'x'
        ? { ...s, scaleX: val }
        : axis === 'y'
          ? { ...s, scaleY: val }
          : { ...s, scaleZ: val },
    );
  }

  onInspectorSecretToggle(): void {
    this.selectedNode.update((cur) => ({ ...cur, gmSecretOnly: !cur.gmSecretOnly }));
    const nextVal = this.selectedNode().gmSecretOnly;
    this.updateTargetStamp((s) => ({ ...s, gmSecretOnly: nextVal }));
  }

  onClearWaterSplines(): void {
    this.recordHistoryBeforeEdit('Clear Water Splines');
    this.commitSceneUpdate((cur) => ({ ...cur, revision: cur.revision + 1, waterSplines: [] }));
  }

  onClearScatterClusters(): void {
    this.recordHistoryBeforeEdit('Clear Scatter Clusters');
    this.commitSceneUpdate((cur) => ({
      ...cur,
      revision: cur.revision + 1,
      scatterDensity: 0,
      scatterClusters: [],
    }));
  }

  onUploadSingleGlb(file: File): void {
    this.pngApi.uploadSingleGlb(file, (asset) => this.onSelectPngAsset(asset));
  }

  private captureCurrentSnapshot(label: string): MapStudioSnapshot {
    return {
      label,
      timestamp: `Rev ${this.sceneGraph().revision}`,
      sceneGraph: this.sceneGraph(),
      layers: this.studio.layers(),
      activeLevelIndex: this.studio.activeLevelIndex(),
    };
  }

  private recordHistoryBeforeEdit(label: string): void {
    this.history.pushSnapshot(this.captureCurrentSnapshot(label));
  }

  private commitSceneUpdate(updater: (cur: MapSceneGraphState) => MapSceneGraphState): void {
    this.sceneGraph.update((cur) => {
      const updated = updater(cur);
      this.stage.syncSceneGraph(updated);
      return updated;
    });
    this.render2dViewport();
  }

  undoLastCommand(): void {
    const prev = this.history.undo(this.captureCurrentSnapshot('Current State'));
    if (prev) {
      this.sceneGraph.set(prev.sceneGraph);
      this.stage.syncSceneGraph(prev.sceneGraph);
      this.render2dViewport();
    }
  }

  redoLastCommand(): void {
    const next = this.history.redo(this.captureCurrentSnapshot('Current State'));
    if (next) {
      this.sceneGraph.set(next.sceneGraph);
      this.stage.syncSceneGraph(next.sceneGraph);
      this.render2dViewport();
    }
  }

  saveSceneRevision(): void {
    this.studio.saveAuthoritativeRevision(
      this.selectedSceneKey(),
      this.sceneGraph().revision,
      this.store.viewerRole(),
      (newRev) => this.sceneGraph.update((cur) => ({ ...cur, revision: newRev })),
    );
    this.pngPipelineBanner.set(`Saved '${this.mapTitle()}' (Rev ${this.sceneGraph().revision}).`);
  }

  publishMapToCoreCampaign(): void {
    this.saveSceneRevision();
    const campName = this.store.activeCampaign().name;
    const sessLabel =
      this.sessions().find((s) => s.id === this.assignSessionId())?.label ?? this.assignSessionId();
    const encLabel =
      this.encounters().find((e) => e.id === this.assignEncounterId())?.label ??
      this.assignEncounterId();
    this.adventureGuide.assignBattlemapToSessionAndPlace({
      sceneKey: this.selectedSceneKey(),
      sceneTitle: this.mapTitle(),
      sessionId: this.assignSessionId(),
      locationNodeId: this.assignLocationNodeId(),
      artworkUrl: '/battlemap-showcase.jpg',
      biome: this.activeTheme(),
    });
    this.pngPipelineBanner.set(
      `Published '${this.mapTitle()}' (${this.dimensionMode().toUpperCase()}) -> ${campName} · ${sessLabel} · ${encLabel}`,
    );
  }
}
