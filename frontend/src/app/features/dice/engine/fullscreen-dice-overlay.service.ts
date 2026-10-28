import { inject, Injectable, Injector, NgZone, signal } from '@angular/core';
import type { FullscreenDiceBabylonRunner } from './fullscreen-dice-babylon.runner';
import type { DicePolyhedronType } from './models';

export type FullscreenDiceOverlayPhase = 'hidden' | 'rolling' | 'settled' | 'fading';

export interface FullscreenDieEntry {
  dieType: DicePolyhedronType;
  value: number;
}

export interface FullscreenDiceRollRequest {
  label: string;
  actorName?: string;
  expression: string;
  diceValues: number[];
  diceEntries?: FullscreenDieEntry[];
  modifier?: number;
  total: number;
  outcomeBadge?: string;
  isNat20?: boolean;
  isCritFail?: boolean;
}

export interface FullscreenDiceRollSummary {
  label: string;
  actorName: string;
  expression: string;
  breakdownTerms: string;
  total: number;
  outcomeBadge: string;
  isNat20: boolean;
  isCritFail: boolean;
}

@Injectable({ providedIn: 'root' })
export class FullscreenDiceOverlayService {
  private readonly ngZone = inject(NgZone);
  private readonly injector = inject(Injector);

  readonly overlayPhase = signal<FullscreenDiceOverlayPhase>('hidden');
  readonly activeRollSummary = signal<FullscreenDiceRollSummary | null>(null);

  private canvas: HTMLCanvasElement | null = null;
  private runner: FullscreenDiceBabylonRunner | null = null;
  private runnerPromise: Promise<FullscreenDiceBabylonRunner> | null = null;
  private holdTimer: number | null = null;
  private fadeTimer: number | null = null;

  registerOverlayCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    if (this.runner) {
      this.runner.mountCanvas(canvas);
    }
  }

  triggerFullScreenRoll(req: FullscreenDiceRollRequest): void {
    this.clearTimers();

    const entries = this.resolveDieEntries(req);
    const mod = req.modifier ?? 0;
    const diceTerms = entries.map(e => String(e.value)).join(' + ');
    const modTerm = mod > 0 ? ` + ${mod}` : mod < 0 ? ` - ${Math.abs(mod)}` : '';
    const breakdownTerms = `${diceTerms}${modTerm}`;

    this.activeRollSummary.set({
      label: req.label,
      actorName: req.actorName ?? '',
      expression: req.expression,
      breakdownTerms,
      total: req.total,
      outcomeBadge: req.outcomeBadge ?? (req.isNat20 ? 'CRITICAL SUCCESS' : req.isCritFail ? 'CRITICAL FAIL' : ''),
      isNat20: Boolean(req.isNat20),
      isCritFail: Boolean(req.isCritFail)
    });

    // Step 1: Opaque black overlay covers the screen immediately while dice roll
    this.overlayPhase.set('rolling');

    void this.ensureRunner().then(runner => {
      if (this.canvas) {
        runner.mountCanvas(this.canvas);
      }
      runner.runRoll(entries, req, () => {
        // Step 2: Dice have completely stopped — show bottom-right results popup over opaque overlay
        this.ngZone.run(() => {
          this.overlayPhase.set('settled');
        });

        // Step 3: Wait ~2 seconds (2000ms), then start a 2.5-second fade of the dice and opaque overlay
        this.holdTimer = window.setTimeout(() => {
          this.ngZone.run(() => {
            this.overlayPhase.set('fading');
          });
          this.fadeTimer = window.setTimeout(() => {
            this.ngZone.run(() => {
              this.clearResultsNow();
            });
          }, 2500);
        }, 2000);
      });
    });
  }

  clearResultsNow(): void {
    this.clearTimers();
    this.overlayPhase.set('hidden');
    this.activeRollSummary.set(null);
    this.runner?.clearAll();
  }

  private async ensureRunner(): Promise<FullscreenDiceBabylonRunner> {
    if (this.runner) {
      return this.runner;
    }
    if (!this.runnerPromise) {
      this.runnerPromise = Promise.all([
        import('./fullscreen-dice-babylon.runner'),
        import('./audio'),
        import('./babylon-dice-stage.service')
      ]).then(([runnerMod, audioMod, stageMod]) => {
        const soundService = this.injector.get(audioMod.DiceSoundService);
        const stageService = this.injector.get(stageMod.BabylonDiceStageService);
        const instance = new runnerMod.FullscreenDiceBabylonRunner(
          this.ngZone,
          soundService,
          stageService,
          () => this.overlayPhase() !== 'hidden'
        );
        if (this.canvas) {
          instance.mountCanvas(this.canvas);
        }
        this.runner = instance;
        return instance;
      });
    }
    return this.runnerPromise;
  }

  private resolveDieEntries(req: FullscreenDiceRollRequest): FullscreenDieEntry[] {
    if (req.diceEntries && req.diceEntries.length > 0) {
      return req.diceEntries;
    }
    const dieType = this.parseDieType(req.expression);
    const values = req.diceValues.length > 0 ? req.diceValues : [Math.max(1, req.total - (req.modifier ?? 0))];
    return values.map(v => ({ dieType, value: v }));
  }

  private parseDieType(expression: string): DicePolyhedronType {
    const match = /d(100|20|12|10|8|6|4)\b/i.exec(expression || '1d20');
    if (!match) {
      return 'd20';
    }
    const raw = `d${match[1]}`;
    return (raw === 'd100' ? 'd10' : raw) as DicePolyhedronType;
  }

  private clearTimers(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}
