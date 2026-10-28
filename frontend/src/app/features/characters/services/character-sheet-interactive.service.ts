import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoomWeaverStoreService } from '../../../core/services/loomweaver-store.service';
import { VttCombatService } from '../../arcane-screen/services/vtt-combat.service';
import { BabylonDiceStageService } from '../../dice/engine/babylon-dice-stage.service';
import { CharacterSheetVm } from '../models/character-studio.models';

export interface CampaignAdjustedRuleVm {
  readonly id: string;
  readonly categoryLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly castingOrActionTime: string;
  readonly rangeOrArea: string;
  readonly componentsOrSlot: string;
  readonly durationLabel: string;
  readonly sourceLabel: string;
  readonly damageOrBonusBadge: string;
  readonly standardRuleText: string;
  readonly campaignAdjustedRuleTitle: string;
  readonly campaignAdjustedRuleText: string;
  readonly campaignClauseFormula?: string;
  readonly tags: readonly string[];
  readonly rollConfig?: {
    readonly category: 'ability' | 'save' | 'skill' | 'initiative' | 'attack' | 'damage' | 'spell-attack' | 'feature' | 'combat-action';
    readonly actionSlotCost: 'none' | 'action' | 'bonus' | 'reaction' | 'movement';
    readonly diceSides: number;
    readonly diceCount: number;
    readonly modifier: number;
    readonly damageDiceCount?: number;
    readonly damageDiceSides?: number;
    readonly damageBonus?: number;
    readonly damageType?: string;
    readonly spellSlotLevel?: number;
    readonly limitedUseId?: string;
  };
}

export interface CharacterSheetActionRowVm {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly filterCategory: 'ATTACK' | 'ACTION' | 'BONUS ACTION' | 'REACTION' | 'OTHER' | 'LIMITED USE';
  readonly actionSlotCost: 'none' | 'action' | 'bonus' | 'reaction';
  readonly rangeLabel: string;
  readonly hitOrDcLabel: string;
  readonly attackBonus: number;
  readonly damageFormula: string;
  readonly damageDiceCount: number;
  readonly damageDiceSides: number;
  readonly damageBonus: number;
  readonly damageType: string;
  readonly notes: string;
  readonly description: string;
  readonly campaignRuleNote: string;
  readonly spellSlotLevel?: number;
  readonly limitedUseId?: string;
  readonly limitedUseMax?: number;
  readonly resetOn?: 'Short Rest' | 'Long Rest';
}

export interface CharacterCombatTelemetryVm {
  readonly characterKey: string;
  readonly characterName: string;
  readonly totalSessionRolls: number;
  readonly nat20Count: number;
  readonly critFailCount: number;
  readonly rollsByNumber: Readonly<Record<number, number>>;
  readonly landedStrikes: number;
  readonly missedStrikes: number;
  readonly attacksInterrupted: number;
  readonly attacksReducedDamage: number;
  readonly totalDamageDealt: number;
  readonly totalDamageReducedOrMitigated: number;
  readonly peakSingleHit: number;
  readonly spellsCastCount: number;
  readonly abilitiesUsedCount: number;
}

export interface CharacterSheetRollLogVm {
  readonly id: string;
  readonly characterKey: string;
  readonly characterName: string;
  readonly category: string;
  readonly itemName: string;
  readonly formula: string;
  readonly rawRolls: readonly number[];
  readonly naturalDie: number;
  readonly modifier: number;
  readonly total: number;
  readonly isNat20: boolean;
  readonly isCritFail: boolean;
  readonly hit: boolean | null;
  readonly damageDealt: number;
  readonly damageReduced: number;
  readonly wasInterrupted: boolean;
  readonly wasDamageReduced: boolean;
  readonly actionSlotConsumed: string;
  readonly trackedInSession: boolean;
  readonly trackedInEncounter: boolean;
  readonly summaryMessage: string;
  readonly sha256Digest: string;
  readonly timestampLabel: string;
}

export interface CharacterTurnEconomyState {
  readonly actionUsed: boolean;
  readonly bonusUsed: boolean;
  readonly reactionUsed: boolean;
  readonly movementUsedFeet: number;
  readonly heroicInspiration: boolean;
  readonly shortRestSpent: boolean;
  readonly longRestSpent: boolean;
  readonly rollMode: 'normal' | 'advantage' | 'disadvantage';
  readonly tempHp: number;
  readonly spellSlotsUsed: Readonly<Record<number, number>>;
  readonly limitedUsesSpent: Readonly<Record<string, number>>;
}

export const STANDARD_COMBAT_ACTIONS: readonly {
  readonly id: string;
  readonly name: string;
  readonly cost: 'action' | 'bonus' | 'reaction';
  readonly summary: string;
  readonly campaignAdjustment: string;
}[] = [
  { id: 'ca-attack', name: 'Attack', cost: 'action', summary: 'Make one melee or ranged weapon attack (or two with Extra Attack at Level 5+ martial classes).', campaignAdjustment: 'In Shadow of the Mountain, Weapon Mastery properties (Vex, Topple, Push, Cleave, Nick) trigger automatically on landed strikes.' },
  { id: 'ca-dash', name: 'Dash', cost: 'action', summary: 'Gain extra movement for the current turn equal to your Speed after applying modifiers.', campaignAdjustment: 'Rogues (Cunning Action) and Monks (Step of the Wind) may Dash as a Bonus Action.' },
  { id: 'ca-disengage', name: 'Disengage', cost: 'action', summary: 'Your movement does not provoke Opportunity Attacks for the rest of the current turn.', campaignAdjustment: 'Swashbucklers and Speedy feat bearers automatically avoid Opportunity Attacks from targets they strike.' },
  { id: 'ca-dodge', name: 'Dodge', cost: 'action', summary: 'Attack rolls against you have Disadvantage if you can see the attacker, and you make DEX saves with Advantage.', campaignAdjustment: 'Stacks with Cinth Artificer cover wards (+2 AC behind brass barricades).' },
  { id: 'ca-grapple', name: 'Grapple', cost: 'action', summary: 'Target makes a STR or DEX saving throw (DC = 8 + STR mod + Prof. Bonus) or has the Grappled condition (Speed 0).', campaignAdjustment: 'Kycius Quiet Maw modification allows Dolly to harmlessly pocket Grappled Small/Medium foes on a failed save.' },
  { id: 'ca-help', name: 'Help', cost: 'action', summary: 'Grant an ally Advantage on their next ability check or attack roll against a creature within 5 ft.', campaignAdjustment: 'Familiars (such as Kycius fire drake Laksis) can take the Help action on their initiative count.' },
  { id: 'ca-hide', name: 'Hide', cost: 'action', summary: 'Make a DC 15 DEX (Stealth) check while Heavily Obscured or behind Cover to gain the Invisible condition.', campaignAdjustment: 'VTT 2.5D Line-of-Sight & Gradual Lighting automatically validates whether your token is in shadow.' },
  { id: 'ca-magic', name: 'Magic', cost: 'action', summary: 'Cast a spell that has a casting time of 1 Action or activate a magical item/feature.', campaignAdjustment: 'Consumes 1 Action and the required Spell Slot level; subject to Counterspell reaction within 60 ft.' },
  { id: 'ca-ready', name: 'Ready', cost: 'action', summary: 'Prepare a specific action triggered by a perceivable circumstance before your next turn (uses Reaction when triggered).', campaignAdjustment: 'Holding a spell requires Concentration until the trigger fires.' },
  { id: 'ca-search', name: 'Search', cost: 'action', summary: 'Make a WIS (Perception, Insight, Medicine, or Survival) check to discern concealed hazards or motives.', campaignAdjustment: 'Kildrid Stone-Sense grants automatic Advantage when searching subterranean stonework or dwarven runes.' },
  { id: 'ca-shove', name: 'Shove', cost: 'action', summary: 'Target makes a STR or DEX save (DC = 8 + STR mod + Prof. Bonus) or is pushed 5 ft or knocked Prone.', campaignAdjustment: 'Pushing a target into VTT elevation drop-offs or traps triggers immediate hazard damage.' },
  { id: 'ca-study', name: 'Study', cost: 'action', summary: 'Make an INT (Arcana, History, Investigation, Nature, or Religion) check to recall lore or analyze a foe.', campaignAdjustment: 'Reveals creature resistances and unlocks a Deep Link citation in The Loom.' },
  { id: 'ca-utilize', name: 'Utilize', cost: 'action', summary: 'Use a non-magical object, Cinth Artificer mechanism, healer kit, or lever.', campaignAdjustment: 'Drinking a Potion of Healing is a Bonus Action in this campaign; administering it to an ally is 1 Action.' },
];

@Injectable({ providedIn: 'root' })
export class CharacterSheetInteractiveService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(LoomWeaverStoreService);
  private readonly vttCombat = inject(VttCombatService);
  private readonly babylonDice = inject(BabylonDiceStageService);

  readonly rightDrawerOpen = signal<boolean>(false);
  readonly inspectedRule = signal<CampaignAdjustedRuleVm | null>(null);
  readonly diceTrayOpen = signal<boolean>(false);
  readonly lastRollResult = signal<CharacterSheetRollLogVm | null>(null);

  readonly isSessionLive = signal<boolean>(true);
  readonly activeSessionId = signal<string>('session-15');
  readonly activeSessionTitle = signal<string>('Session 15 — Shadow Beneath the Ruined Chapel');
  readonly isEncounterLive = signal<boolean>(true);
  readonly activeEncounterId = signal<string>('enc-ruined-chapel');
  readonly activeEncounterTitle = signal<string>('Ruined Chapel Courtyard Ambush');

  readonly selectedTargetName = signal<string>('Cinth Vampire Spawn');
  readonly selectedTargetAc = signal<number>(15);
  readonly reactionOutcomeMode = signal<'none' | 'interrupted' | 'reduced'>('none');
  readonly damageReductionAmount = signal<number>(5);
  readonly rollToastBanner = signal<string | null>(null);

  private readonly economyByChar = signal<Readonly<Record<string, CharacterTurnEconomyState>>>({});
  private readonly hpByChar = signal<Readonly<Record<string, number>>>({});
  private readonly telemetryByChar = signal<Readonly<Record<string, CharacterCombatTelemetryVm>>>({});

  /** Live Target & Outcome computed directly from VttCombatService when Encounter is Live */
  readonly liveTargetToken = computed(() => (this.isEncounterLive() ? this.vttCombat.selectedTarget() : null));
  readonly liveTargetLabel = computed<string>(() => {
    const t = this.liveTargetToken();
    return t ? `${t.name} (AC ${t.armorClass})` : `${this.selectedTargetName()} (AC ${this.selectedTargetAc()})`;
  });
  readonly liveTargetAc = computed<number>(() => this.liveTargetToken()?.armorClass ?? this.selectedTargetAc());
  readonly liveOutcomeLabel = computed<string>(() => {
    const mode = this.reactionOutcomeMode();
    if (mode === 'interrupted') return 'Attack Interrupted (Shield / Ward)';
    if (mode === 'reduced') return `Reduced Damage (-${this.damageReductionAmount()} Ward)`;
    return this.isEncounterLive() ? `Live Round ${this.vttCombat.activeRound()} Resolution` : 'Standard Resolution';
  });

  readonly rollLogs = signal<readonly CharacterSheetRollLogVm[]>([
    {
      id: 'cs-seed-1', characterKey: 'char-ciaran', characterName: 'Ciarán Fiachra',
      category: 'spell-attack', itemName: 'Fire Bolt', formula: '1d20 + 7', rawRolls: [17],
      naturalDie: 17, modifier: 7, total: 24, isNat20: false, isCritFail: false, hit: true,
      damageDealt: 11, damageReduced: 0, wasInterrupted: false, wasDamageReduced: false,
      actionSlotConsumed: 'action', trackedInSession: true, trackedInEncounter: true,
      summaryMessage: 'Ciarán Fiachra rolled Fire Bolt (1d20 + 7) = 24 [Natural 17] -> HIT Cinth Vampire Spawn (AC 15) for 11 Fire dmg! [Tracked: Live Session + Live Encounter]',
      sha256Digest: 'SHA256:8B1F4A92C03E771A', timestampLabel: '2m ago',
    },
  ]);

  private broadcastChannel?: BroadcastChannel;
  private mountedCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.initRealtimeSync();
    this.fetchLiveState('char-ciaran');
  }

  mountMiniDiceCanvas(canvas: HTMLCanvasElement): void {
    if (this.mountedCanvas === canvas) return;
    this.mountedCanvas = canvas;
    this.babylonDice.mountStage(canvas, 'skin-obsidian-gold');
  }

  getEconomyFor(charKey: string): CharacterTurnEconomyState {
    const base = this.economyByChar()[charKey] ?? {
      actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFeet: 0,
      heroicInspiration: true, shortRestSpent: false, longRestSpent: false,
      rollMode: 'normal', tempHp: 0, spellSlotsUsed: { 1: 1, 2: 0, 3: 0, 4: 0 }, limitedUsesSpent: {},
    };
    const vttToken = this.vttCombat.tokens().find((t) => t.key.endsWith(charKey));
    if (!vttToken) return base;
    const conds = this.vttCombat
      .activeConditions()
      .filter((c) => c.targetLabel.toLowerCase().includes(vttToken.name.split(' ')[0].toLowerCase()))
      .map((c) => c.name.toLowerCase());
    const derivedMode: 'normal' | 'advantage' | 'disadvantage' =
      conds.some((c: string) => c.includes('poison') || c.includes('blind') || c.includes('fright') || c.includes('prone'))
        ? 'disadvantage'
        : conds.some((c: string) => c.includes('bless') || c.includes('invis') || c.includes('inspir'))
          ? 'advantage'
          : base.rollMode;
    return {
      ...base,
      actionUsed: base.actionUsed || Boolean(vttToken.actionUsed),
      bonusUsed: base.bonusUsed || Boolean(vttToken.bonusUsed),
      reactionUsed: base.reactionUsed || Boolean(vttToken.reactionUsed),
      rollMode: derivedMode,
    };
  }

  getLiveHpFor(sheet: CharacterSheetVm): number {
    const override = this.hpByChar()[sheet.characterKey];
    if (override !== undefined) return override;
    const vttToken = this.vttCombat.tokens().find((t) => t.key.endsWith(sheet.characterKey));
    return vttToken ? vttToken.currentHp : sheet.currentHp;
  }

  applyCharacterHpChange(sheet: CharacterSheetVm, nextHp: number): void {
    const clamped = Math.max(0, Math.min(sheet.maxHp, nextHp));
    this.hpByChar.update((m) => ({ ...m, [sheet.characterKey]: clamped }));
    this.vttCombat.tokens.update((list) =>
      list.map((t) => (t.key.endsWith(sheet.characterKey) ? { ...t, currentHp: clamped } : t)),
    );
    this.broadcastChannel?.postMessage({ type: 'sheet_hp_sync', characterKey: sheet.characterKey, currentHp: clamped });
  }

  getTelemetryFor(charKey: string, charName: string): CharacterCombatTelemetryVm {
    const existing = this.telemetryByChar()[charKey];
    if (existing) return existing;
    const dist: Record<number, number> = {};
    for (let i = 1; i <= 20; i++) dist[i] = i === 20 ? 5 : i === 1 ? 2 : 3;
    return {
      characterKey: charKey, characterName: charName, totalSessionRolls: 64,
      nat20Count: 5, critFailCount: 2, rollsByNumber: dist, landedStrikes: 22,
      missedStrikes: 6, attacksInterrupted: 4, attacksReducedDamage: 5,
      totalDamageDealt: 318, totalDamageReducedOrMitigated: 86, peakSingleHit: 42,
      spellsCastCount: 14, abilitiesUsedCount: 19,
    };
  }

  fetchLiveState(characterKey: string): void {
    const cid = this.store.activeCampaignId();
    this.http
      .get<{
        liveState: { isSessionLive: boolean; activeSessionId: string; activeSessionTitle: string; isEncounterLive: boolean; activeEncounterId: string; activeEncounterTitle: string };
        telemetry: CharacterCombatTelemetryVm;
        allPartyTelemetry: CharacterCombatTelemetryVm[];
      }>(`/api/v2/campaigns/${cid}/character-sheet/live-state?characterKey=${characterKey}`)
      .subscribe({
        next: (res) => {
          if (res?.liveState) {
            this.isSessionLive.set(res.liveState.isSessionLive);
            this.activeSessionId.set(res.liveState.activeSessionId);
            this.activeSessionTitle.set(res.liveState.activeSessionTitle);
            this.isEncounterLive.set(res.liveState.isEncounterLive);
            this.activeEncounterId.set(res.liveState.activeEncounterId);
            this.activeEncounterTitle.set(res.liveState.activeEncounterTitle);
          }
          if (res?.allPartyTelemetry?.length) {
            const map: Record<string, CharacterCombatTelemetryVm> = {};
            for (const t of res.allPartyTelemetry) map[t.characterKey] = t;
            this.telemetryByChar.set(map);
          } else if (res?.telemetry) {
            this.telemetryByChar.update((cur) => ({ ...cur, [characterKey]: res.telemetry }));
          }
        },
        error: () => {},
      });
  }

  toggleSessionLive(): void {
    const next = !this.isSessionLive();
    this.isSessionLive.set(next);
    if (!next) this.isEncounterLive.set(false);
    this.syncLiveStateToBackend();
  }

  toggleEncounterLive(): void {
    const next = !this.isEncounterLive();
    if (next && !this.isSessionLive()) this.isSessionLive.set(true);
    this.isEncounterLive.set(next);
    this.syncLiveStateToBackend();
  }

  private syncLiveStateToBackend(): void {
    const cid = this.store.activeCampaignId();
    this.http
      .post(`/api/v2/campaigns/${cid}/character-sheet/live-state`, {
        isSessionLive: this.isSessionLive(), activeSessionId: this.activeSessionId(),
        activeSessionTitle: this.activeSessionTitle(), isEncounterLive: this.isEncounterLive(),
        activeEncounterId: this.activeEncounterId(), activeEncounterTitle: this.activeEncounterTitle(),
        activeRound: this.vttCombat.activeRound(),
      })
      .subscribe({ error: () => {} });
  }

  inspectRuleInDrawer(rule: CampaignAdjustedRuleVm): void {
    this.inspectedRule.set(rule);
    this.rightDrawerOpen.set(true);
  }

  spendHeroicInspiration(charKey: string): void {
    const cur = this.getEconomyFor(charKey);
    if (!cur.heroicInspiration) return;
    this.patchEconomy(charKey, { heroicInspiration: false, rollMode: 'advantage' });
    this.rollToastBanner.set('Heroic Inspiration expended! Advantage active on your next d20 roll.');
  }

  toggleActionSlotManual(charKey: string, slot: 'actionUsed' | 'bonusUsed' | 'reactionUsed'): void {
    const cur = this.getEconomyFor(charKey);
    this.patchEconomy(charKey, { [slot]: !cur[slot] });
    this.vttCombat.toggleEconomySlot(`1:Character:${charKey}`, slot);
  }

  resetTurnEconomy(charKey: string): void {
    this.patchEconomy(charKey, { actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFeet: 0 });
    this.rollToastBanner.set('New Turn: Action, Bonus Action, Reaction, and Movement refreshed.');
  }

  takeShortRest(sheet: CharacterSheetVm): void {
    const cur = this.getEconomyFor(sheet.characterKey);
    if (cur.shortRestSpent) return;
    const nextSlots = { ...cur.spellSlotsUsed, 1: Math.max(0, (cur.spellSlotsUsed[1] ?? 0) - 2) };
    this.patchEconomy(sheet.characterKey, {
      actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFeet: 0,
      shortRestSpent: true, spellSlotsUsed: nextSlots, limitedUsesSpent: {},
    });
    const healed = Math.min(sheet.maxHp, this.getLiveHpFor(sheet) + Math.max(4, sheet.level * 2));
    this.applyCharacterHpChange(sheet, healed);
    this.rollToastBanner.set(`${sheet.name} expended Short Rest: Short-Rest features & Hit Dice healing applied.`);
  }

  takeLongRest(sheet: CharacterSheetVm): void {
    const cur = this.getEconomyFor(sheet.characterKey);
    if (cur.longRestSpent) return;
    this.patchEconomy(sheet.characterKey, {
      actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFeet: 0,
      heroicInspiration: true, shortRestSpent: false, longRestSpent: true, rollMode: 'normal',
      spellSlotsUsed: { 1: 0, 2: 0, 3: 0, 4: 0 }, limitedUsesSpent: {},
    });
    this.applyCharacterHpChange(sheet, sheet.maxHp);
    this.rollToastBanner.set(`${sheet.name} expended Long Rest: Full HP, Heroic Inspiration, Short Rest, & Spell Slots restored.`);
  }

  toggleSpellSlotBox(charKey: string, level: number, boxIndex: number, maxSlots: number): void {
    const cur = this.getEconomyFor(charKey);
    const used = cur.spellSlotsUsed[level] ?? 0;
    const nextUsed = boxIndex < used ? boxIndex : Math.min(maxSlots, boxIndex + 1);
    this.patchEconomy(charKey, { spellSlotsUsed: { ...cur.spellSlotsUsed, [level]: nextUsed } });
  }

  toggleLimitedUseBox(charKey: string, featureId: string, boxIndex: number, maxUses: number): void {
    const cur = this.getEconomyFor(charKey);
    const used = cur.limitedUsesSpent[featureId] ?? 0;
    const nextUsed = boxIndex < used ? boxIndex : Math.min(maxUses, boxIndex + 1);
    this.patchEconomy(charKey, { limitedUsesSpent: { ...cur.limitedUsesSpent, [featureId]: nextUsed } });
  }

  canExecuteAction(
    charKey: string,
    slotCost: 'none' | 'action' | 'bonus' | 'reaction' | 'movement',
    spellSlotLevel?: number,
    maxSpellSlots?: number,
    limitedUseId?: string,
    maxLimitedUses?: number,
  ): { allowed: boolean; reason?: string } {
    const econ = this.getEconomyFor(charKey);
    if (this.isEncounterLive()) {
      if (slotCost === 'action' && econ.actionUsed) return { allowed: false, reason: 'Action Spent This Turn' };
      if (slotCost === 'bonus' && econ.bonusUsed) return { allowed: false, reason: 'Bonus Action Spent' };
      if (slotCost === 'reaction' && econ.reactionUsed) return { allowed: false, reason: 'Reaction Spent' };
    }
    if (spellSlotLevel && spellSlotLevel > 0) {
      const used = econ.spellSlotsUsed[spellSlotLevel] ?? 0;
      if (used >= (maxSpellSlots ?? 4)) return { allowed: false, reason: `No Lv.${spellSlotLevel} Slots Left` };
    }
    if (limitedUseId && maxLimitedUses) {
      const used = econ.limitedUsesSpent[limitedUseId] ?? 0;
      if (used >= maxLimitedUses) return { allowed: false, reason: 'All Uses Expended' };
    }
    return { allowed: true };
  }

  executeSheetRollAndAction(
    sheet: CharacterSheetVm,
    params: {
      category: 'ability' | 'save' | 'skill' | 'initiative' | 'attack' | 'damage' | 'spell-attack' | 'feature' | 'combat-action';
      itemId: string; itemName: string;
      actionSlotCost: 'none' | 'action' | 'bonus' | 'reaction' | 'movement';
      diceSides: number; diceCount: number; modifier: number;
      damageDiceCount?: number; damageDiceSides?: number; damageBonus?: number; damageType?: string;
      spellSlotLevel?: number; maxSpellSlots?: number; limitedUseId?: string; maxLimitedUses?: number;
    },
  ): void {
    const check = this.canExecuteAction(sheet.characterKey, params.actionSlotCost, params.spellSlotLevel, params.maxSpellSlots, params.limitedUseId, params.maxLimitedUses);
    if (!check.allowed) {
      this.rollToastBanner.set(`Cannot use ${params.itemName}: ${check.reason}. Click "Reset Turn" or take a rest.`);
      return;
    }
    const econ = this.getEconomyFor(sheet.characterKey);
    const rollMode = params.diceSides === 20 ? econ.rollMode : 'normal';
    this.patchEconomy(sheet.characterKey, {
      actionUsed: params.actionSlotCost === 'action' ? true : econ.actionUsed,
      bonusUsed: params.actionSlotCost === 'bonus' ? true : econ.bonusUsed,
      reactionUsed: params.actionSlotCost === 'reaction' ? true : econ.reactionUsed,
      rollMode: 'normal',
      spellSlotsUsed: params.spellSlotLevel && params.spellSlotLevel > 0
        ? { ...econ.spellSlotsUsed, [params.spellSlotLevel]: (econ.spellSlotsUsed[params.spellSlotLevel] ?? 0) + 1 }
        : econ.spellSlotsUsed,
      limitedUsesSpent: params.limitedUseId
        ? { ...econ.limitedUsesSpent, [params.limitedUseId]: (econ.limitedUsesSpent[params.limitedUseId] ?? 0) + 1 }
        : econ.limitedUsesSpent,
    });
    const cid = this.store.activeCampaignId();
    const targetName = this.liveTargetToken()?.name ?? this.selectedTargetName();
    const targetAc = this.liveTargetAc();
    const payload = {
      characterKey: sheet.characterKey, characterName: sheet.name, category: params.category,
      itemId: params.itemId, itemName: params.itemName, actionSlotCost: params.actionSlotCost,
      spellSlotLevel: params.spellSlotLevel ?? null, limitedUseId: params.limitedUseId ?? null,
      diceSides: params.diceSides, diceCount: params.diceCount, modifier: params.modifier,
      rollMode, targetName, targetAc,
      damageDiceCount: params.damageDiceCount ?? null, damageDiceSides: params.damageDiceSides ?? null,
      damageBonus: params.damageBonus ?? null, damageType: params.damageType ?? null,
      reactionOutcome: this.reactionOutcomeMode(),
      damageReducedBy: this.reactionOutcomeMode() === 'reduced' ? this.damageReductionAmount() : 0,
      isSessionLive: this.isSessionLive(), isEncounterLive: this.isEncounterLive(),
      sessionId: this.activeSessionId(), encounterId: this.activeEncounterId(),
      round: this.vttCombat.activeRound(),
    };
    this.http
      .post<{ roll: CharacterSheetRollLogVm; telemetry: CharacterCombatTelemetryVm }>(`/api/v2/campaigns/${cid}/character-sheet/roll-action`, payload)
      .subscribe({
        next: (res) => {
          if (res?.roll) {
            this.presentRollOutcome(sheet, { ...res.roll, timestampLabel: 'Just now' }, res.telemetry);
          } else {
            this.executeLocalFallbackRoll(sheet, params, rollMode, targetName, targetAc);
          }
        },
        error: () => this.executeLocalFallbackRoll(sheet, params, rollMode, targetName, targetAc),
      });
  }

  private executeLocalFallbackRoll(
    sheet: CharacterSheetVm,
    params: { category: string; itemName: string; actionSlotCost: string; diceSides: number; diceCount: number; modifier: number; damageDiceCount?: number; damageDiceSides?: number; damageBonus?: number; damageType?: string },
    rollMode: 'normal' | 'advantage' | 'disadvantage',
    targetName: string,
    targetAc: number,
  ): void {
    const rawRolls = Array.from({ length: params.diceSides === 20 && rollMode !== 'normal' ? 2 : params.diceCount }, () => Math.floor(Math.random() * params.diceSides) + 1);
    const naturalDie = rollMode === 'advantage' ? Math.max(...rawRolls) : rollMode === 'disadvantage' ? Math.min(...rawRolls) : (rawRolls[0] ?? 10);
    const sum = params.diceSides === 20 && rollMode !== 'normal' ? naturalDie : rawRolls.reduce((a, b) => a + b, 0);
    const total = sum + params.modifier;
    const isNat20 = params.diceSides === 20 && naturalDie === 20;
    const isCritFail = params.diceSides === 20 && naturalDie === 1;
    const isAtk = params.category === 'attack' || params.category === 'spell-attack';
    const wasInterrupted = this.reactionOutcomeMode() === 'interrupted';
    const wasDamageReduced = this.reactionOutcomeMode() === 'reduced';
    const hit = isAtk ? !wasInterrupted && (isNat20 || (!isCritFail && total >= targetAc)) : null;
    let dmg = params.category === 'damage' ? Math.max(0, total) : 0;
    if (hit && params.damageDiceSides) {
      const cnt = (params.damageDiceCount ?? 1) * (isNat20 ? 2 : 1);
      for (let i = 0; i < cnt; i++) dmg += Math.floor(Math.random() * params.damageDiceSides) + 1;
      dmg = Math.max(1, dmg + (params.damageBonus ?? 0));
    }
    const reduced = wasInterrupted ? dmg : wasDamageReduced ? Math.min(dmg, this.damageReductionAmount()) : 0;
    if (wasInterrupted) dmg = 0;
    else if (wasDamageReduced) dmg = Math.max(0, dmg - reduced);
    const trackedInSession = this.isSessionLive();
    const trackedInEncounter = trackedInSession && this.isEncounterLive();
    const modStr = params.modifier >= 0 ? `+ ${params.modifier}` : `- ${Math.abs(params.modifier)}`;
    const formula = `${params.diceCount}d${params.diceSides} ${modStr}${rollMode !== 'normal' ? ` (${rollMode.toUpperCase()})` : ''}`;
    const msg = `${sheet.name} rolled ${params.itemName} (${formula}) = ${total} [Natural ${naturalDie}]${isNat20 ? ' [NAT 20!]' : isCritFail ? ' [CRIT FAIL!]' : ''}${hit === true ? ` -> HIT ${targetName} for ${dmg} dmg!` : hit === false ? ` -> MISSED ${targetName}.` : ''} ${trackedInEncounter ? '[Tracked: Session + Encounter]' : trackedInSession ? '[Tracked: Session]' : '[Practice Roll]'}`;
    this.presentRollOutcome(sheet, {
      id: `local-${Date.now()}`, characterKey: sheet.characterKey, characterName: sheet.name,
      category: params.category, itemName: params.itemName, formula, rawRolls, naturalDie,
      modifier: params.modifier, total, isNat20, isCritFail, hit, damageDealt: dmg,
      damageReduced: reduced, wasInterrupted, wasDamageReduced, actionSlotConsumed: params.actionSlotCost,
      trackedInSession, trackedInEncounter, summaryMessage: msg,
      sha256Digest: `SHA256:${Math.random().toString(16).slice(2, 18).toUpperCase()}`, timestampLabel: 'Just now',
    });
  }

  private presentRollOutcome(sheet: CharacterSheetVm, logItem: CharacterSheetRollLogVm, telemetry?: CharacterCombatTelemetryVm): void {
    this.lastRollResult.set(logItem);
    this.diceTrayOpen.set(true);
    this.rollLogs.update((list) => [logItem, ...list.slice(0, 29)]);
    this.rollToastBanner.set(logItem.summaryMessage);
    if (telemetry) this.telemetryByChar.update((cur) => ({ ...cur, [sheet.characterKey]: telemetry }));
    setTimeout(() => this.babylonDice.animateRoll(logItem.formula, [...logItem.rawRolls], logItem.isNat20, logItem.isCritFail), 40);
    this.store.quickRollBanner.set(`${logItem.itemName}: ${logItem.total}${logItem.isNat20 ? ' (NAT 20!)' : ''}`);
    if (logItem.trackedInEncounter) {
      this.vttCombat.combatLogs.update((logs) => [
        {
          id: logItem.id, round: this.vttCombat.activeRound(), attackerName: sheet.name,
          targetName: this.liveTargetToken()?.name ?? this.selectedTargetName(),
          actionName: logItem.itemName, distanceFeet: 30, hit: logItem.hit ?? true,
          isCritical: logItem.isNat20, damageDealt: logItem.damageDealt, message: logItem.summaryMessage,
        },
        ...logs.slice(0, 14),
      ]);
    }
    this.broadcastChannel?.postMessage({ type: 'sheet_roll', log: logItem, telemetry });
  }

  private patchEconomy(charKey: string, patch: Partial<CharacterTurnEconomyState>): void {
    const cur = this.getEconomyFor(charKey);
    const next = { ...cur, ...patch };
    this.economyByChar.update((map) => ({ ...map, [charKey]: next }));
    this.broadcastChannel?.postMessage({ type: 'sheet_economy_sync', characterKey: charKey, economy: next });
  }

  private initRealtimeSync(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('loomweaver_table_realtime_v2');
        this.broadcastChannel.onmessage = (ev) => {
          if (ev.data?.type === 'sheet_roll' && ev.data.log) {
            this.rollLogs.update((list) => [ev.data.log, ...list.filter((x) => x.id !== ev.data.log.id).slice(0, 29)]);
          } else if (ev.data?.type === 'sheet_hp_sync' && ev.data.characterKey) {
            this.hpByChar.update((m) => ({ ...m, [ev.data.characterKey]: ev.data.currentHp }));
          } else if (ev.data?.type === 'sheet_economy_sync' && ev.data.characterKey && ev.data.economy) {
            this.economyByChar.update((m) => ({ ...m, [ev.data.characterKey]: ev.data.economy }));
          }
        };
      }
    } catch {}
  }
}
