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
import { Router, RouterLink } from '@angular/router';
import { NgpButton } from 'ng-primitives/button';
import { LoomWeaverStoreService } from '../../core/services/loomweaver-store.service';
import {
  LwBadgeComponent,
  LwButtonComponent,
  LwIconComponent,
} from '../../shared/ui/public-api';
import { WebAudioAmbienceService } from '../assets/engine/web-audio-ambience.service';
import { BabylonEffectStageService } from '../effects/engine/babylon-effect-stage.service';
import { VttTokenVm } from '../effects/engine/effect-timeline.contract';
import {
  feetToSvgPx,
  svgToWorldPoint,
  worldToSvgX,
  worldToSvgY,
} from './engine/vtt-los-and-grid.engine';
import { VttTacticalAbilityVm } from './models/vtt-battle.models';
import { VttBattleStateService } from './services/vtt-battle-state.service';
import { VttCombatService } from './services/vtt-combat.service';

@Component({
  selector: 'lw-arcane-screen-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgpButton,
    LwBadgeComponent,
    LwButtonComponent,
    LwIconComponent,
  ],
  templateUrl: './arcane-screen.page.html',
  styleUrl: './arcane-screen.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArcaneScreenPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('vttCanvas') private vttCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('battleSvg') private battleSvgRef?: ElementRef<SVGSVGElement>;

  readonly store = inject(LoomWeaverStoreService);
  readonly vtt = inject(VttCombatService);
  readonly battle = inject(VttBattleStateService);
  readonly stage = inject(BabylonEffectStageService);
  readonly audio = inject(WebAudioAmbienceService);
  private readonly router = inject(Router);

  readonly gridEnabled = signal<boolean>(true);
  readonly activeCanvasTool = signal<'select' | 'draw' | 'inspect' | '3d'>('select');

  readonly timerSeconds = signal<number>(872);
  readonly timerRunning = signal<boolean>(true);
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  readonly selectedDiceFormula = signal<string>('1d20');
  readonly dmToolReadout = signal<string>(
    'Session Ready: Use Quick DCs, Roll Dice, or click any token with Shift / [T] to multi-target.',
  );

  // Quick-Add Monster & NPC Form State
  readonly quickAddMonsterId = signal<string>('creat-goblin-scout-a');
  readonly quickAddNpcName = signal<string>('');
  readonly quickAddNpcTitle = signal<string>('Cinth Artificer Scout');
  readonly quickAddNpcScope = signal<'Encounter' | 'Region'>('Encounter');
  readonly quickAddNpcDisposition = signal<'Friendly' | 'Neutral' | 'Deceptive' | 'Hostile'>('Friendly');

  // Chat Composer State
  readonly chatDraft = signal<string>('');
  readonly chatWhisperGmOnly = signal<boolean>(false);

  // Coordinate helpers exposed to template
  readonly toSvgX = worldToSvgX;
  readonly toSvgY = worldToSvgY;
  readonly toSvgPx = feetToSvgPx;

  readonly gridVerticalLines = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];
  readonly gridHorizontalLines = [100, 200, 300, 400, 500, 600, 700];

  readonly formattedTimer = computed(() => {
    const total = this.timerSeconds();
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  });

  readonly shouldRenderPlayerFog = computed(
    () =>
      this.battle.fogMode() !== 'no-fog' &&
      (this.store.viewerRole() === 'players' || this.battle.gmPreviewPlayerVision()),
  );

  ngAfterViewInit(): void {
    const canvas = this.vttCanvasRef?.nativeElement;
    if (canvas) {
      this.stage.mountStage(
        canvas,
        this.vtt.tokens(),
        this.vtt.selectedAttackerKey(),
        this.vtt.selectedTargetKey(),
        (clickedKey) => this.vtt.selectedTargetKey.set(clickedKey),
      );
    }
    this.timerHandle = setInterval(() => {
      if (this.timerRunning()) {
        this.timerSeconds.update((s) => s + 1);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.stage.dispose();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (event.key === 'Escape') {
        this.battle.cancelAllInteractiveModes();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.battle.cancelAllInteractiveModes();
      this.battle.openDmDrawer.set('none');
      this.dmToolReadout.set('Exited targeting / measure mode (Esc).');
    } else if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      this.battle.targetSelectionMode.update((v) => !v);
      this.dmToolReadout.set(
        this.battle.targetSelectionMode()
          ? 'Multi-Target Mode [T] Active: Click tokens to select multiple targets (Esc to exit).'
          : 'Multi-Target Mode [T] Deactivated.',
      );
    }
  }

  onBattleMapPointerMove(event: MouseEvent): void {
    const svg = this.battleSvgRef?.nativeElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * 1200;
    const svgY = ((event.clientY - rect.top) / rect.height) * 800;
    this.battle.cursorWorldPos.set(svgToWorldPoint(svgX, svgY));
  }

  onBattleMapClick(event: MouseEvent): void {
    if (this.battle.measureEnabled() && this.battle.measureSubMode() === 'movement') {
      this.commitMovePreview();
      return;
    }
    if (this.battle.pendingAbility()) {
      this.executePendingAbilityCast();
    }
  }

  onTokenClicked(event: MouseEvent, token: VttTokenVm): void {
    event.stopPropagation();
    const hadPending = !!this.battle.pendingAbility();
    this.battle.handleTokenClick(token, event.shiftKey);
    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
    if (hadPending && !event.shiftKey && !this.battle.targetSelectionMode()) {
      this.executePendingAbilityCast();
    }
  }

  commitMovePreview(): void {
    const move = this.battle.activeMovementPreview();
    if (!move || move.distanceFeet <= 0) return;
    const dist = move.distanceFeet;
    this.battle.commitStealthGridMove();
    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
    this.dmToolReadout.set(
      `Moved ${this.battle.activeObserverToken().name} ${dist} ft along the 5-ft grid.`,
    );
  }

  selectTurnAbility(ability: VttTacticalAbilityVm): void {
    if (!this.battle.isAbilityAvailableOnTurn(ability)) {
      this.dmToolReadout.set(`${ability.actionCost} already spent this turn.`);
      return;
    }
    if (this.battle.pendingAbility()?.id === ability.id) {
      this.executePendingAbilityCast();
      return;
    }
    this.battle.beginAbilityTargeting(ability);
    this.dmToolReadout.set(
      `Targeting "${ability.name}" (${ability.rangeFeet}ft range, ${ability.aoeRadiusFeet}ft AoE): Move cursor on map & click to cast, or press Esc to cancel.`,
    );
  }

  executePendingAbilityCast(): void {
    const confirmed = this.battle.confirmPendingAbilityCast();
    if (!confirmed) return;
    const { ability, targets } = confirmed;
    const targetList = targets.length > 0 ? targets : [this.vtt.selectedTarget()];

    let lastFx: ReturnType<typeof this.vtt.executeActionOnTarget> | null = null;
    for (const target of targetList) {
      this.vtt.selectedTargetKey.set(target.key);
      lastFx = this.vtt.executeActionOnTarget(ability);
    }

    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
    if (lastFx) {
      this.stage.playTrajectoryEffect(lastFx.preset, lastFx.startPos, lastFx.endPos);
    }
    this.dmToolReadout.set(
      `Executed ${ability.name} against ${targetList.map((t) => t.name).join(', ')}.`,
    );
  }

  switchLiveEncounter(encounterId: string): void {
    this.vtt.launchEncounterIntoVtt(encounterId);
    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
  }

  nextTurn(): void {
    this.vtt.advanceTurn();
    const active = this.vtt.selectedAttacker();
    if (active) {
      this.battle.resetTurnMovement(active.key);
    }
    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
  }

  spawnSelectedBestiaryMonster(): void {
    const pick =
      this.vtt.creatures().find((c) => c.id === this.quickAddMonsterId()) ??
      this.vtt.creatures()[0];
    if (!pick) return;
    this.vtt.spawnCreatureIntoVtt(pick);
    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
    this.dmToolReadout.set(`Added ${pick.name} onto the battle map.`);
  }

  addQuickNpcToMap(): void {
    this.battle.quickAddNpcToEncounter(
      this.quickAddNpcName(),
      this.quickAddNpcTitle(),
      this.quickAddNpcScope(),
      this.quickAddNpcDisposition(),
      true,
    );
    this.quickAddNpcName.set('');
    this.stage.syncTokens(
      this.vtt.tokens(),
      this.vtt.selectedAttackerKey(),
      this.vtt.selectedTargetKey(),
    );
    this.dmToolReadout.set('Added NPC to Encounter & Battle Map.');
  }

  rollQuickDcCheck(dc: number, label: string): void {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + 4;
    this.dmToolReadout.set(
      `Quick DC ${dc} (${label}): Rolled ${d20} + 4 = ${total} -> ${total >= dc ? 'SUCCESS' : 'FAILURE'}`,
    );
  }

  rollSelectedDice(): void {
    const f = this.selectedDiceFormula();
    const [countStr, sidesStr] = f.toLowerCase().split('d');
    const count = Math.max(1, Number(countStr) || 1);
    const sides = Math.max(4, Number(sidesStr) || 20);
    let sum = 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }
    this.dmToolReadout.set(`Rolled ${f}: [${rolls.join(', ')}] = ${sum}`);
  }

  submitChat(): void {
    this.battle.sendChatMessage(this.chatDraft(), this.chatWhisperGmOnly());
    this.chatDraft.set('');
  }

  openEditCurrentEncounter(): void {
    void this.router.navigate(['/encounters'], {
      queryParams: { edit: this.vtt.activeEncounterId() },
    });
  }
}
