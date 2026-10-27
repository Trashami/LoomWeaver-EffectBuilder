import { teleportFrame } from '../effects/teleport-preview';
import { BabylonEffectPreview } from '../effects/babylon/native-preview';
import { VisualQualityTier } from '../effects/babylon/scene-3d-assets';
import { riderPoint } from '../effects/gameplay-preview';
import { movingTarget } from '../effects/fireball-motion';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from './components/icon/icon.component';
import { EffectDefinition, PreviewScene, effectDuration } from '../effects/effect-definition';

@Component({
  selector: 'mw-effect-preview',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './effect-preview.component.html',
  styleUrl: './effect-preview.component.scss',
})
export class EffectPreviewComponent implements AfterViewInit, OnDestroy, OnChanges {
  readonly holdHidden = signal(false);
  @Output() reappearRequested = new EventEmitter<number>();
  private pendingStart: number | null = null;

  startAt(ms: number): void {
    this.holdHidden.set(false);
    this.pendingStart = ms;
  }

  reveal(): void {
    const t = this.definition.previewScene.teleport;
    if (t) this.reappearRequested.emit(t.vanishMs + t.hiddenMs);
  }

  get casterFade(): number {
    const s = this.definition.previewScene;
    return teleportFrame(s.teleport, this.previewTime(), s.caster, s.teleport?.destination ?? s.caster).alpha;
  }

  readonly view3d = signal(true);
  readonly quality = signal<VisualQualityTier>('high');
  readonly forestMap = signal(true);
  readonly tokens3d = signal(true);
  readonly background = signal(true);
  readonly ambient = signal(0.38);
  readonly bump = signal(2.2);
  readonly relief = signal(0.18);

  @Input() fullscreen = false;
  @Output() fullscreenChange = new EventEmitter<boolean>();

  private native?: BabylonEffectPreview;
  private http = inject(HttpClient);
  readonly summonArtwork = signal('');
  private artworkSource = '';
  private artworkGeneration = 0;

  toggleFullscreen(): void {
    const next = !this.fullscreen;
    this.fullscreen = next;
    this.fullscreenChange.emit(next);
    setTimeout(() => this.native?.resize(), 30);
  }

  toggleView(): void {
    this.setViewMode(!this.view3d());
  }

  setViewMode(perspective: boolean): void {
    this.view3d.set(perspective);
    this.native?.setView(perspective);
  }

  setQuality(tier: VisualQualityTier): void {
    this.quality.set(tier);
    this.native?.setQuality(tier);
  }

  projectPoint(p: { x: number; y: number }) {
    const q = this.native?.project(p) ?? p;
    return {
      x: Math.max(-0.15, Math.min(1.15, Number.isFinite(q.x) ? q.x : p.x)),
      y: Math.max(-0.15, Math.min(1.15, Number.isFinite(q.y) ? q.y : p.y)),
    };
  }

  inspect(turn = 0, tilt = 0, zoom = 1): void {
    this.native?.inspect(turn, tilt, zoom);
  }

  resetCamera(): void {
    this.native?.resetView();
  }

  onSurfaceWheel(event: WheelEvent): void {
    // Camera zoom is locked in normal view and unlocked in Full Screen Preview mode
    if (!this.fullscreen) return;
    if (typeof window !== 'undefined' && (window.visualViewport?.scale ?? 1) > 1.03 && event.ctrlKey && event.deltaY > 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaY > 0 ? 1.1 : 0.9;
    this.inspect(0, 0, factor);
  }

  onSurfacePointerDown(event: PointerEvent): void {
    if (this.editHandPath) {
      this.pathPoint(event);
      return;
    }
    if (!this.native) return;

    const bounds = this.surface.nativeElement.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;

    // 1. In normal studio view (camera locked), left-clicking a 3D token model drags the token
    if (!this.fullscreen) {
      if (event.button !== 0) return;
      const pickedRole = this.native.pickDraggableRole(localX, localY);
      if (pickedRole && pickedRole !== 'terrain') {
        const targetIdx =
          pickedRole === 'caster'
            ? -1
            : pickedRole === 'target-0'
              ? 0
              : pickedRole === 'target-1'
                ? 1
                : pickedRole === 'target-2'
                  ? 2
                  : -99;
        if (targetIdx >= -1) {
          this.drag(event, targetIdx, this.surface.nativeElement);
        }
      }
      return;
    }

    // 2. In Full Screen Preview mode: mouse drag on the map adjusts camera rotation and position!
    // Left-drag (in 3D mode without Shift) orbits/tilts camera; Right-drag, Middle-drag, Shift+Left-drag, or 2D mode pans camera position.
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    event.preventDefault();
    const surfaceEl = this.surface.nativeElement;
    let prevX = localX;
    let prevY = localY;
    const isPanGesture = !this.view3d() || event.button === 1 || event.button === 2 || event.shiftKey;
    surfaceEl.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId || !this.native) return;
      const curX = e.clientX - bounds.left;
      const curY = e.clientY - bounds.top;
      const dx = curX - prevX;
      const dy = curY - prevY;
      if (isPanGesture || e.shiftKey) {
        this.native.panScreenPixels(prevX, prevY, curX, curY);
      } else {
        this.native.inspect(dx * 0.0065, -dy * 0.005, 1);
      }
      prevX = curX;
      prevY = curY;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      surfaceEl.removeEventListener('pointermove', move);
      surfaceEl.removeEventListener('pointerup', end);
      surfaceEl.removeEventListener('pointercancel', end);
      surfaceEl.removeEventListener('lostpointercapture', end);
      if (surfaceEl.hasPointerCapture(e.pointerId)) surfaceEl.releasePointerCapture(e.pointerId);
    };
    surfaceEl.addEventListener('pointermove', move);
    surfaceEl.addEventListener('pointerup', end);
    surfaceEl.addEventListener('pointercancel', end);
    surfaceEl.addEventListener('lostpointercapture', end);
  }

  ngOnChanges(): void {
    const url = this.definition?.summon?.tokenUrl ?? '';
    if (url === this.artworkSource) return;
    this.artworkSource = url;
    const generation = ++this.artworkGeneration;
    const previous = this.summonArtwork();
    if (previous.startsWith('blob:')) URL.revokeObjectURL(previous);
    this.summonArtwork.set('');
    if (url.startsWith('/api/summon-assets/')) {
      void firstValueFrom(this.http.get(url, { responseType: 'blob' }))
        .then((blob) => {
          if (generation === this.artworkGeneration && !this.disposed) {
            this.summonArtwork.set(URL.createObjectURL(blob));
          }
        })
        .catch(() => this.error.set('Sign in as the token owner to preview private artwork.'));
    } else {
      this.summonArtwork.set(url);
    }
  }

  @ViewChild('surface', { static: true }) surface!: ElementRef<HTMLDivElement>;
  @Input({ required: true }) definition!: EffectDefinition;
  @Input() playing = true;
  @Input() loop = true;
  @Input() speed = 1;
  @Input() showGrid = true;
  @Input() seekTime: number | null = null;
  @Input() showGround = false;
  @Input() activeBolt = 0;
  @Input() boltTargets: number[] = [];
  @Input() editHandPath = false;
  @Input() handPath: { x: number; y: number }[] = [];
  @Output() handPathChanged = new EventEmitter<{ x: number; y: number }[]>();

  get handPoints() {
    const s = this.definition.previewScene;
    const a = s.caster;
    const b = s.targets[0];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const ratio = (this.surface?.nativeElement.clientWidth || 1) / (this.surface?.nativeElement.clientHeight || 1);
    return this.handPath.map((p) =>
      this.projectPoint({ x: a.x + dx * p.x - (dy / ratio) * p.y, y: a.y + dy * p.x + dx * ratio * p.y })
    );
  }

  pathPoint(event: PointerEvent, index = -1): void {
    if (!this.editHandPath || (index >= 0 && event.buttons !== 1)) return;
    event.stopPropagation();
    const rect = this.surface.nativeElement.getBoundingClientRect();
    const s = this.definition.previewScene;
    const a = s.caster;
    const b = s.targets[0];
    const dx = b.x - a.x;
    const dy = ((b.y - a.y) * rect.height) / rect.width;
    const den = dx * dx + dy * dy;
    if (den < 0.0001) return;
    const design = this.native?.designPoint(event.clientX - rect.left, event.clientY - rect.top) ?? {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const x = design.x / rect.width - a.x;
    const y = design.y / rect.width - (a.y * rect.height) / rect.width;
    const q = {
      x: Math.max(-0.5, Math.min(1.5, (x * dx + y * dy) / den)),
      y: Math.max(-1, Math.min(1, (y * dx - x * dy) / den)),
    };
    const path = this.handPath.map((p) => ({ ...p }));
    if (index < 0) {
      if (path.length >= 8) return;
      path.push(q);
    } else {
      path[index] = q;
    }
    this.handPathChanged.emit(path);
  }

  movePoint(event: PointerEvent, index: number): void {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.editStarted.emit();
  }

  removePoint(event: Event, index: number): void {
    event.stopPropagation();
    this.handPathChanged.emit(this.handPath.filter((_, i) => i !== index));
  }

  @Output() timeChanged = new EventEmitter<number>();
  @Output() sceneChanged = new EventEmitter<PreviewScene>();
  @Output() editStarted = new EventEmitter<void>();
  @Output() targetSelected = new EventEmitter<number>();

  readonly previewTime = signal(0);
  readonly rendererStatus = signal('Starting GPU renderer');
  readonly error = signal('');
  private resizeObserver?: ResizeObserver;
  private elapsed = 0;
  private disposed = false;
  private suppressClick = false;

  get summonPoint() {
    return this.projectPoint(this.definition.previewScene.targets[0]);
  }

  get multiTarget(): boolean {
    return this.definition.layers.some((l) => !!l.missile || l.kind === 'chain_lightning');
  }

  get pronePreview(): boolean {
    return !!this.definition.gameplay?.enabled && !!this.definition.gameplay.prone && this.previewTime() >= this.definition.gameplay.impactMs;
  }

  get tokens() {
    const source = this.definition.previewScene;
    const s = {
      ...source,
      targets: source.targets.map((p, i) => (i === 0 && source.targetMotion ? movingTarget(p, this.previewTime()) : p)),
    };
    return [
      {
        id: 'caster',
        label: 'Sorceress',
        point: this.projectPoint(teleportFrame(s.teleport, this.previewTime(), s.caster, s.teleport?.destination ?? s.caster).point),
        target: -1,
      },
      ...s.targets.slice(0, 3).map((point, i) => ({
        id: 'target-' + i,
        label: 'Goblin ' + (i + 1),
        point: this.projectPoint(i === 0 ? this.riderNormalized(point) : point),
        target: i,
      })),
      ...(s.teleport?.enabled
        ? [{ id: 'destination', label: 'Destination', point: this.projectPoint(s.teleport.destination), target: 3 }]
        : []),
    ];
  }

  riderNormalized(p: { x: number; y: number }) {
    const el = this.surface?.nativeElement;
    const w = el?.clientWidth || 700;
    const h = el?.clientHeight || 360;
    const a = this.definition.previewScene.caster;
    const q = riderPoint(this.definition.gameplay, this.previewTime(), { x: a.x * w, y: a.y * h }, { x: p.x * w, y: p.y * h }, 66 * Math.min(1, w / 700, h / 360));
    return { x: Math.max(-0.35, Math.min(1.35, q.x / w)), y: Math.max(-0.35, Math.min(1.35, q.y / h)) };
  }

  boltsFor(slot: number): string {
    return this.boltTargets
      .map((s, i) => (s === slot ? String(i + 1) : ''))
      .filter(Boolean)
      .join(', ');
  }

  restart(): void {
    this.pendingStart = 0;
    this.elapsed = 0;
  }

  pick(event: MouseEvent, target: number): void {
    if (event.detail !== 0 && this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (this.multiTarget && target >= 0 && target < 3) this.targetSelected.emit(target);
  }

  drag(event: PointerEvent, targetIndex: number, captureTarget?: HTMLElement): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.suppressClick = false;
    const button = captureTarget ?? (event.currentTarget as HTMLElement);
    const bounds = this.surface.nativeElement.getBoundingClientRect();
    const before = structuredClone(this.definition.previewScene);
    const initial =
      targetIndex < 0 ? before.caster : targetIndex === 3 ? before.teleport!.destination : before.targets[targetIndex];
    const start = this.native?.designPoint(event.clientX - bounds.left, event.clientY - bounds.top) ?? {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    let started = false;
    button.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      if (!started) {
        if (Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 3) return;
        this.editStarted.emit();
        started = true;
        this.suppressClick = true;
      }
      const current = this.native?.designPoint(e.clientX - bounds.left, e.clientY - bounds.top) ?? {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      };
      const scene = structuredClone(before);
      const minBound = -0.32;
      const maxBound = 1.32;
      const point = {
        x: Math.max(minBound, Math.min(maxBound, initial.x + (current.x - start.x) / Math.max(1, bounds.width))),
        y: Math.max(minBound, Math.min(maxBound, initial.y + (current.y - start.y) / Math.max(1, bounds.height))),
      };
      if (targetIndex < 0) scene.caster = point;
      else if (targetIndex === 3) scene.teleport!.destination = point;
      else scene.targets[targetIndex] = point;
      this.sceneChanged.emit(scene);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      if (e.type === 'pointercancel' && started) this.sceneChanged.emit(before);
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', end);
      button.removeEventListener('pointercancel', end);
      button.removeEventListener('lostpointercapture', end);
      if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    };
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
  }

  nudge(event: KeyboardEvent, index: number): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    this.editStarted.emit();
    const scene = structuredClone(this.definition.previewScene);
    const p = index < 0 ? scene.caster : index === 3 ? scene.teleport!.destination : scene.targets[index];
    const step = event.shiftKey ? 0.05 : 0.015;
    const minBound = -0.32;
    const maxBound = 1.32;
    p.x = Math.max(minBound, Math.min(maxBound, p.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)));
    p.y = Math.max(minBound, Math.min(maxBound, p.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)));
    this.sceneChanged.emit(scene);
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const surface = this.surface.nativeElement;
      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
      surface.appendChild(canvas);
      const native = new BabylonEffectPreview(canvas, () => surface.clientWidth, () => surface.clientHeight);
      native.setView(this.view3d());
      native.setQuality(this.quality());
      this.native = native;
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.disposed && surface.clientWidth > 0 && surface.clientHeight > 0) native.resize();
      });
      this.resizeObserver.observe(surface);
      this.rendererStatus.set('Babylon.js 3D / WebGL ' + native.engine.webGLVersion);
      let lastEmit = -1;
      let last = performance.now();
      native.engine.runRenderLoop(() => {
        if (this.disposed) return;
        const now = performance.now();
        const delta = Math.min(100, now - last);
        last = now;
        const w = surface.clientWidth;
        const h = surface.clientHeight;
        const s = this.definition.previewScene;
        const duration = effectDuration(this.definition);
        if (this.seekTime !== null) this.elapsed = this.seekTime;
        else if (this.pendingStart !== null) {
          this.elapsed = this.pendingStart;
          this.pendingStart = null;
        } else if (this.playing) this.elapsed += delta * this.speed;
        const teleport = s.teleport;
        if (teleport?.enabled && this.holdHidden() && this.seekTime === null) {
          this.elapsed = Math.min(this.elapsed, teleport.vanishMs + teleport.hiddenMs * 0.5);
        }
        if (this.loop && this.seekTime === null && this.elapsed > duration + 300) this.elapsed = 0;
        const time = Math.min(this.elapsed, duration);
        const targetAt = (ms: number) => {
          const p = s.targetMotion ? movingTarget(s.targets[0], ms) : s.targets[0];
          return { x: p.x * w, y: p.y * h };
        };
        const from = { x: s.caster.x * w, y: s.caster.y * h };
        const targets = s.targets.map((p, i) => (i === 0 ? targetAt(time) : { x: p.x * w, y: p.y * h }));
        native.render(
          this.definition,
          time,
          from,
          targets,
          Math.min(1, w / 700, h / 360),
          {
            targetAt,
            walls: (s.walls ?? []).map((wall) => ({
              a: { x: wall.a.x * w, y: wall.a.y * h },
              b: { x: wall.b.x * w, y: wall.b.y * h },
            })),
          },
          {
            background: this.background(),
            forestMap: this.forestMap(),
            tokens3d: this.tokens3d(),
            ambient: this.ambient(),
            bump: this.bump(),
            height: this.relief(),
            grid: this.showGrid,
            ground: this.showGround,
          }
        );
        const rounded = Math.round(this.elapsed / 40) * 40;
        if (rounded !== lastEmit) {
          lastEmit = rounded;
          this.previewTime.set(time);
          this.timeChanged.emit(time);
        }
      });
    } catch (error) {
      this.native?.dispose();
      this.rendererStatus.set('GPU renderer unavailable');
      this.error.set('Babylon requires hardware-accelerated WebGL. Enable browser graphics acceleration and reload. Your effect remains editable.');
      console.error('Native effect preview failed', error);
    }
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    const url = this.summonArtwork();
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    this.native?.dispose();
  }
}
