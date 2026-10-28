import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { NgpButton } from 'ng-primitives/button';
import { DicePolyhedronType } from '../../../features/dice/engine/models/dice-model.types';

export interface DicePoolRollRequest {
  readonly pool: ReadonlyArray<{ dieType: DicePolyhedronType; sides: number; count: number }>;
  readonly rollMode: 'normal' | 'advantage' | 'disadvantage';
  readonly isRandomQuickRoll?: boolean;
}

interface DieMenuOption {
  readonly dieType: DicePolyhedronType;
  readonly label: string;
  readonly sides: number;
}

const DIE_MENU_COLUMN: readonly DieMenuOption[] = [
  { dieType: 'd100', label: 'd100', sides: 100 },
  { dieType: 'd20', label: 'd20', sides: 20 },
  { dieType: 'd12', label: 'd12', sides: 12 },
  { dieType: 'd10', label: 'd10', sides: 10 },
  { dieType: 'd8', label: 'd8', sides: 8 },
  { dieType: 'd6', label: 'd6', sides: 6 },
  { dieType: 'd4', label: 'd4', sides: 4 }
];

@Component({
  selector: 'lw-dice-roller-menu',
  standalone: true,
  imports: [NgpButton],
  templateUrl: './dice-roller-menu.component.html',
  styleUrl: './dice-roller-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LwDiceRollerMenuComponent {
  readonly dieOptions = DIE_MENU_COLUMN;
  readonly counts = signal<Record<DicePolyhedronType, number>>({
    d100: 0,
    d20: 0,
    d12: 0,
    d10: 0,
    d8: 0,
    d6: 0,
    d4: 0
  });
  readonly rollMode = signal<'normal' | 'advantage' | 'disadvantage'>('normal');

  readonly rollPoolRequested = output<DicePoolRollRequest>();
  readonly clearRequested = output<void>();

  readonly totalQueued = computed(() =>
    Object.values(this.counts()).reduce((sum, n) => sum + n, 0)
  );

  incrementDie(dieType: DicePolyhedronType): void {
    this.counts.update(prev => ({
      ...prev,
      [dieType]: Math.min(20, (prev[dieType] ?? 0) + 1)
    }));
  }

  decrementDie(event: MouseEvent, dieType: DicePolyhedronType): void {
    event.preventDefault();
    this.counts.update(prev => ({
      ...prev,
      [dieType]: Math.max(0, (prev[dieType] ?? 0) - 1)
    }));
  }

  toggleRollMode(mode: 'advantage' | 'disadvantage'): void {
    this.rollMode.update(curr => (curr === mode ? 'normal' : mode));
  }

  clearAll(): void {
    this.counts.set({
      d100: 0,
      d20: 0,
      d12: 0,
      d10: 0,
      d8: 0,
      d6: 0,
      d4: 0
    });
    this.rollMode.set('normal');
    this.clearRequested.emit();
  }

  triggerRoll(): void {
    const current = this.counts();
    const pool = this.dieOptions
      .filter(opt => (current[opt.dieType] ?? 0) > 0)
      .map(opt => ({
        dieType: opt.dieType,
        sides: opt.sides,
        count: current[opt.dieType]
      }));

    if (pool.length === 0) {
      pool.push({ dieType: 'd20', sides: 20, count: 1 });
    }

    this.rollPoolRequested.emit({
      pool,
      rollMode: this.rollMode(),
      isRandomQuickRoll: false
    });
  }

  /**
   * Quick random roll button that never exceeds 5 random dice total.
   */
  triggerRandomRollUpToFive(): void {
    const totalDice = Math.floor(Math.random() * 5) + 1; // 1..5 random dice, never exceeds 5
    const bucket = new Map<DicePolyhedronType, { dieType: DicePolyhedronType; sides: number; count: number }>();

    for (let i = 0; i < totalDice; i++) {
      const pick = this.dieOptions[Math.floor(Math.random() * this.dieOptions.length)];
      const existing = bucket.get(pick.dieType);
      if (existing) {
        existing.count += 1;
      } else {
        bucket.set(pick.dieType, { dieType: pick.dieType, sides: pick.sides, count: 1 });
      }
    }

    const nextCounts: Record<DicePolyhedronType, number> = {
      d100: 0,
      d20: 0,
      d12: 0,
      d10: 0,
      d8: 0,
      d6: 0,
      d4: 0
    };
    for (const [k, v] of bucket.entries()) {
      nextCounts[k] = v.count;
    }
    this.counts.set(nextCounts);

    this.rollPoolRequested.emit({
      pool: Array.from(bucket.values()),
      rollMode: this.rollMode(),
      isRandomQuickRoll: true
    });
  }
}
