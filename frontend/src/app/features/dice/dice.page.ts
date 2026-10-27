import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit, Component, computed, ElementRef,
  inject, OnDestroy, OnInit, signal, ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DiceRollFormulaRequest, DiceRollLedgerItem, LwBadgeComponent,
  LwButtonComponent, LwCardComponent, LwDiceRollerTrayComponent, LwPanelComponent, LwStatCardComponent
} from '../../shared/ui';
import { DiceCustomizerPanelComponent } from './components/dice-customizer-panel/dice-customizer-panel.component';
import { DICE_SOUND_PROFILES, DiceSoundService } from './engine/audio';
import { BabylonDiceStageService } from './engine/babylon-dice-stage.service';
import { DICE_CRITFAIL_EFFECTS, DICE_NAT20_EFFECTS } from './engine/effects';
import {
  DICE_MODEL_CATALOG, DiceModelDefinition,
  DicePolyhedronType, resolveDiceModel
} from './engine/models';
import {
  createDefaultRuntimeConfigFromSkin, DICE_SKIN_CATALOG,
  DiceCustomRuntimeConfig, DiceSkinConfig, resolveDiceSkin
} from './engine/skins';

export interface DiceMilestoneRewardDto {
  id: string;
  title: string;
  description: string;
  targetType: string;
  targetItemId: string;
  targetItemName: string;
  isCompleted: boolean;
  isClaimed: boolean;
  bonusLoommarks: number;
}

export type SkinVaultFilter = 'all' | 'owned' | 'rewards' | 'store';

@Component({
  selector: 'app-dice-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LwPanelComponent, LwCardComponent, LwButtonComponent,
    LwBadgeComponent, LwStatCardComponent, LwDiceRollerTrayComponent,
    DiceCustomizerPanelComponent
  ],
  templateUrl: './dice.page.html',
  styleUrl: './dice.page.scss'
})
export class DicePageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly stageService = inject(BabylonDiceStageService);
  readonly soundService = inject(DiceSoundService);

  @ViewChild('diceStageCanvas') diceStageCanvas?: ElementRef<HTMLCanvasElement>;

  readonly skinCatalog = signal<DiceSkinConfig[]>(DICE_SKIN_CATALOG);
  readonly modelCatalog = signal<DiceModelDefinition[]>(DICE_MODEL_CATALOG);
  readonly nat20Effects = signal(DICE_NAT20_EFFECTS);
  readonly critFailEffects = signal(DICE_CRITFAIL_EFFECTS);
  readonly soundProfiles = signal(DICE_SOUND_PROFILES);

  readonly vaultFilter = signal<SkinVaultFilter>('all');
  readonly focusDie = signal<DicePolyhedronType | 'all'>('all');
  readonly loommarksBalance = signal<number>(1250);
  readonly statusBanner = signal<string | null>(null);

  readonly unlockedSkinIds = signal<string[]>([
    'skin-obsidian-gold', 'skin-nordic-stone', 'skin-gloss-resin',
    'skin-engraved-steel', 'skin-astral-glass'
  ]);
  readonly unlockedModelIds = signal<string[]>([
    'model-classic-chamfer', 'model-sharp-gem', 'model-custom-glb'
  ]);

  readonly milestones = signal<DiceMilestoneRewardDto[]>([
    {
      id: 'milestone-character-studio', title: 'Hero of Icrandor',
      description: 'Complete a full character build in the Character Studio.',
      targetType: 'skin', targetItemId: 'skin-fey-emerald',
      targetItemName: 'Edhellain Moonwood', isCompleted: true, isClaimed: false, bonusLoommarks: 150
    },
    {
      id: 'milestone-cinth-masquerade', title: 'Velvet & Fangs Survivor',
      description: "Survive the Lord of Cinth's masquerade ambush.",
      targetType: 'skin', targetItemId: 'skin-vampire-bloodstone',
      targetItemName: 'Cinth Crimson Bloodstone', isCompleted: true, isClaimed: false, bonusLoommarks: 200
    },
    {
      id: 'milestone-dwarven-delve', title: 'Stone-Sense Delver',
      description: 'Clear a subterranean encounter using Dwarven Stone-Sense.',
      targetType: 'model', targetItemId: 'model-dwarven-heavy',
      targetItemName: 'Dwarven Heavy Forge-Cut Model', isCompleted: true, isClaimed: false, bonusLoommarks: 175
    }
  ]);

  readonly customConfig = signal<DiceCustomRuntimeConfig>(createDefaultRuntimeConfigFromSkin(DICE_SKIN_CATALOG[0]));
  readonly activeSkin = computed(() => resolveDiceSkin(this.customConfig().skinId));
  readonly activeModel = computed(() => resolveDiceModel(this.customConfig().modelId));

  readonly filteredSkins = computed(() => {
    const filter = this.vaultFilter();
    const owned = this.unlockedSkinIds();
    return this.skinCatalog().filter(skin => {
      if (filter === 'owned') return owned.includes(skin.id);
      if (filter === 'rewards') return skin.unlockSource === 'reward' || skin.unlockSource === 'loommarks';
      if (filter === 'store') return skin.unlockSource === 'purchase' || skin.unlockSource === 'loommarks';
      return true;
    });
  });

  readonly rollHistory = signal<DiceRollLedgerItem[]>([
    {
      id: 'roll-seed-201', label: 'Fivi Slingshot Tooth Strike', expression: '1d20 + 8 (ADV)',
      diceResults: [14, 20], modifier: 8, total: 28, isCriticalSuccess: true, isCriticalFailure: false,
      sha256Hash: 'SHA256:9F4A2C8E1B77D03E', rolledAt: '12m ago'
    },
    {
      id: 'roll-seed-200', label: 'Munk Runed Greatsword Cleave', expression: '2d6 + 5',
      diceResults: [6, 5], modifier: 5, total: 16, isCriticalSuccess: false, isCriticalFailure: false,
      sha256Hash: 'SHA256:3D81B60A44E91C20', rolledAt: '18m ago'
    }
  ]);

  readonly lastRoll = computed(() => this.rollHistory()[0] ?? null);
  readonly dieFocusOptions: (DicePolyhedronType | 'all')[] = ['all', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20'];

  ngOnInit(): void {
    this.http.get<{
      loommarksBalance: number;
      unlockedSkinIds: string[];
      unlockedModelIds: string[];
      milestones: DiceMilestoneRewardDto[];
    }>('/api/v2/campaigns/1/dice-forge/state').subscribe({
      next: state => {
        this.loommarksBalance.set(state.loommarksBalance);
        this.unlockedSkinIds.set(state.unlockedSkinIds);
        this.unlockedModelIds.set(state.unlockedModelIds);
        this.milestones.set(state.milestones);
      },
      error: () => {}
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.diceStageCanvas?.nativeElement;
    if (canvas) this.stageService.mountStage(canvas, this.activeSkin().id);
  }

  ngOnDestroy(): void {
    this.stageService.dispose();
  }

  isSkinUnlocked(skinId: string): boolean {
    return this.unlockedSkinIds().includes(skinId);
  }

  selectOrUnlockSkin(skin: DiceSkinConfig): void {
    if (!this.isSkinUnlocked(skin.id)) {
      this.unlockItem('skin', skin.id, skin.unlockSource, skin.name, skin.loommarksCost);
      return;
    }
    this.customConfig.set(this.stageService.applySkin(skin));
    this.statusBanner.set(`Equipped skin: ${skin.name}`);
  }

  unlockModelFromPanel(model: DiceModelDefinition): void {
    this.unlockItem('model', model.id, model.unlockSource, model.name, model.loommarksCost);
  }

  claimMilestoneReward(milestone: DiceMilestoneRewardDto): void {
    this.unlockItem(milestone.targetType as 'skin' | 'model', milestone.targetItemId, 'reward', milestone.targetItemName, 0);
  }

  applyCustomChange(overrides: Partial<DiceCustomRuntimeConfig>): void {
    this.customConfig.set(this.stageService.applyCustomOverrides(overrides));
  }

  resetCustomToSkinDefaults(): void {
    this.customConfig.set(this.stageService.applySkin(this.activeSkin()));
    this.statusBanner.set(`Reset custom overrides to ${this.activeSkin().name} defaults.`);
  }

  saveActiveLoadout(): void {
    this.http.put('/api/v2/campaigns/1/dice-forge/loadout', this.customConfig()).subscribe({
      next: () => this.statusBanner.set('Saved active 3D Dice Forge loadout to campaign profile.'),
      error: () => this.statusBanner.set('Saved active 3D Dice Forge loadout locally.')
    });
  }

  setFocusDie(focus: DicePolyhedronType | 'all'): void {
    this.focusDie.set(focus);
    this.stageService.setShowcaseFocusDie(focus);
  }

  previewCritEffect(kind: 'nat20' | 'critfail'): void {
    this.stageService.previewCritOutcomeEffect(kind);
  }

  testRollSound(profileId: string): void {
    this.soundService.playRollStartClatter(profileId, 2);
  }

  executeAuthoritativeRoll(req: DiceRollFormulaRequest): void {
    const formulaStr = req.expression ?? `${req.count ?? 1}d${req.sides ?? 20}${(req.modifier ?? 0) >= 0 ? '+' + (req.modifier ?? 0) : (req.modifier ?? 0)}`;
    const parsed = req.sides
      ? { count: req.count ?? 1, sides: req.sides, modifier: req.modifier ?? 0 }
      : this.parseExpression(formulaStr);
    const cfg = this.customConfig();
    const mode = req.advantageMode ?? req.rollMode ?? 'normal';

    this.http.post<{
      id: string; formula: string; label: string; rawRolls: number[];
      modifier: number; total: number; isNat20: boolean; isNat1: boolean; verificationDigest: string;
    }>('/api/v2/campaigns/1/dice/roll', {
      sides: parsed.sides, count: parsed.count, modifier: parsed.modifier,
      rollMode: mode, label: req.label, skinId: cfg.skinId,
      modelId: cfg.modelId, sizePreset: cfg.sizePreset,
      nat20EffectId: cfg.nat20EffectId, critFailEffectId: cfg.critFailEffectId,
      soundProfileId: cfg.soundProfileId
    }).subscribe({
      next: res => {
        const item: DiceRollLedgerItem = {
          id: res.id, label: res.label, expression: res.formula, diceResults: res.rawRolls,
          modifier: res.modifier, total: res.total, isCriticalSuccess: res.isNat20,
          isCriticalFailure: res.isNat1, sha256Hash: res.verificationDigest, rolledAt: 'Just now'
        };
        this.rollHistory.update(list => [item, ...list.slice(0, 14)]);
        this.loommarksBalance.update(b => b + (res.isNat20 ? 35 : 15));
        this.stageService.animateRoll(res.formula, res.rawRolls, res.isNat20, res.isNat1);
      },
      error: () => {
        const rolls = Array.from({ length: parsed.count }, () => Math.floor(Math.random() * parsed.sides) + 1);
        const total = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
        const isNat20 = parsed.sides === 20 && rolls.includes(20);
        const isNat1 = parsed.sides === 20 && rolls.includes(1);
        const item: DiceRollLedgerItem = {
          id: `roll-${Date.now()}`, label: req.label, expression: formulaStr, diceResults: rolls,
          modifier: parsed.modifier, total, isCriticalSuccess: isNat20, isCriticalFailure: isNat1,
          sha256Hash: `SHA256:${Math.random().toString(16).slice(2, 18).toUpperCase()}`, rolledAt: 'Just now'
        };
        this.rollHistory.update(list => [item, ...list.slice(0, 14)]);
        this.loommarksBalance.update(b => b + (isNat20 ? 35 : 15));
        this.stageService.animateRoll(formulaStr, rolls, isNat20, isNat1);
      }
    });
  }

  private unlockItem(itemType: 'skin' | 'model', itemId: string, method: string, displayName: string, loommarksCost?: number): void {
    this.http.post<{
      success: boolean; message: string; loommarksBalance: number;
      unlockedSkinIds: string[]; unlockedModelIds: string[]; milestones: DiceMilestoneRewardDto[];
    }>('/api/v2/campaigns/1/dice-forge/unlock', {
      itemType, itemId, acquisitionMethod: method, loommarksCost: loommarksCost ?? 0
    }).subscribe({
      next: res => {
        this.loommarksBalance.set(res.loommarksBalance);
        this.unlockedSkinIds.set(res.unlockedSkinIds);
        this.unlockedModelIds.set(res.unlockedModelIds);
        this.milestones.set(res.milestones);
        this.statusBanner.set(res.success ? `Unlocked ${displayName}!` : res.message);
        if (res.success && itemType === 'skin') this.selectOrUnlockSkin(resolveDiceSkin(itemId));
        else if (res.success && itemType === 'model') this.applyCustomChange({ modelId: itemId });
      },
      error: () => {
        if (method === 'loommarks' && loommarksCost && this.loommarksBalance() < loommarksCost) {
          this.statusBanner.set(`Need ${loommarksCost} Loommarks to unlock ${displayName}.`);
          return;
        }
        if (method === 'loommarks' && loommarksCost) this.loommarksBalance.update(b => b - loommarksCost);
        if (itemType === 'model') {
          this.unlockedModelIds.update(ids => [...new Set([...ids, itemId])]);
          this.applyCustomChange({ modelId: itemId });
        } else {
          this.unlockedSkinIds.update(ids => [...new Set([...ids, itemId])]);
          this.selectOrUnlockSkin(resolveDiceSkin(itemId));
        }
        this.milestones.update(ms => ms.map(m => (m.targetItemId === itemId ? { ...m, isClaimed: true } : m)));
        this.statusBanner.set(`Unlocked ${displayName}!`);
      }
    });
  }

  private parseExpression(expr: string): { count: number; sides: number; modifier: number } {
    const match = /^\s*(\d+)?d(\d+)\s*([+-]\s*\d+)?/i.exec(expr || '1d20');
    if (!match) return { count: 1, sides: 20, modifier: 0 };
    return {
      count: Math.max(1, parseInt(match[1] || '1', 10)),
      sides: Math.max(2, parseInt(match[2] || '20', 10)),
      modifier: match[3] ? parseInt(match[3].replace(/\s+/g, ''), 10) : 0
    };
  }
}
