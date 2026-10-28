import { inject, Injectable, Injector, NgZone, signal } from '@angular/core';
import type { FullscreenDiceBabylonRunner } from './fullscreen-dice-babylon.runner';
import type { DicePolyhedronType } from './models';

export type FullscreenDiceOverlayPhase =
  | 'hidden'
  | 'rolling'
  | 'settled'
  | 'bg-fading'
  | 'dice-hold'
  | 'dice-fading'
  | 'alert-hold'
  | 'alert-fading';

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
  private stageTimers: number[] = [];

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

    // Step 1: Semi-opaque background and 3D dice appear immediately
    this.overlayPhase.set('rolling');

    void this.ensureRunner().then(runner => {
      if (this.canvas) {
        runner.mountCanvas(this.canvas);
      }
      runner.runRoll(entries, req, () => {
        // Step 2: Dice have completely stopped — show bottom-right results popup
        this.ngZone.run(() => {
          this.overlayPhase.set('settled');
        });

        // Step 3: Wait 2 seconds (2000ms), then fade away the opaque bg over 2.5 seconds (2500ms)
        this.schedule(2000, () => {
          this.overlayPhase.set('bg-fading');
        });

        // Step 4: Once the bg finishes its 2.5s fade (at 4500ms), leave the dice on screen for another 2 seconds (2000ms)
        this.schedule(4500, () => {
          this.overlayPhase.set('dice-hold');
        });

        // Step 5: After those 2 seconds on the clear screen (at 6500ms), fade out the dice over 1.5 seconds (1500ms)
        this.schedule(6500, () => {
          this.overlayPhase.set('dice-fading');
        });

        // Step 6: Once the dice finish fading out (at 8000ms), clear the 3D dice meshes and keep the bottom-right Alertify/result popup up for 5 more seconds (5000ms)
        this.schedule(8000, () => {
          this.runner?.clearAll();
          this.overlayPhase.set('alert-hold');
        });

        // Step 7: After 5 seconds (at 13000ms), fade out the bottom-right popup (900ms) and reset to hidden
        this.schedule(13000, () => {
          this.overlayPhase.set('alert-fading');
        });

        this.schedule(13900, () => {
          this.clearResultsNow();
        });
      });
    });
  }

  clearResultsNow(): void {
    this.clearTimers();
    this.overlayPhase.set('hidden');
    this.activeRollSummary.set(null);
    this.runner?.clearAll();
  }

  private schedule(delayMs: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.ngZone.run(fn);
    }, delayMs);
    this.stageTimers.push(id);
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
          () => {
            const p = this.overlayPhase();
            return p === 'rolling' || p === 'settled' || p === 'bg-fading' || p === 'dice-hold' || p === 'dice-fading';
          }
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
    for (const id of this.stageTimers) {
      clearTimeout(id);
    }
    this.stageTimers = [];
  }
}
