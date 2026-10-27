import { Injectable, inject, signal } from '@angular/core'; import { HttpClient } from '@angular/common/http';
import { LoomWeaverStoreService } from '../../../core/services/loomweaver-store.service'; import { VttCombatService } from '../../arcane-screen/services/vtt-combat.service';
import { CharacterSheetVm } from '../models/character-studio.models'; export interface CampaignAdjustedRuleVm {
  readonly id: string; readonly categoryLabel: string;
  readonly title: string; readonly subtitle: string;
  readonly castingOrActionTime: string; readonly rangeOrArea: string;
  readonly componentsOrSlot: string; readonly durationLabel: string;
  readonly sourceLabel: string; readonly damageOrBonusBadge: string;
  readonly standardRuleText: string; readonly campaignAdjustedRuleTitle: string;
  readonly campaignAdjustedRuleText: string; readonly campaignClauseFormula?: string;
  readonly tags: readonly string[]; readonly rollConfig?: {
    readonly category: 'ability' | 'save' | 'skill' | 'initiative' | 'attack' | 'damage' | 'spell-attack' | 'feature' | 'combat-action'; readonly actionSlotCost: 'none' | 'action' | 'bonus' | 'reaction' | 'movement';
    readonly diceSides: number; readonly diceCount: number;
    readonly modifier: number; readonly damageDiceCount?: number;
    readonly damageDiceSides?: number; readonly damageBonus?: number;
    readonly damageType?: string; readonly spellSlotLevel?: number;
    readonly limitedUseId?: string; };
} export interface CharacterSheetActionRowVm {
  readonly id: string; readonly name: string;
  readonly subtitle: string; readonly filterCategory: 'ATTACK' | 'ACTION' | 'BONUS ACTION' | 'REACTION' | 'OTHER' | 'LIMITED USE';
  readonly actionSlotCost: 'none' | 'action' | 'bonus' | 'reaction'; readonly rangeLabel: string;
  readonly hitOrDcLabel: string; readonly attackBonus: number;
  readonly damageFormula: string; readonly damageDiceCount: number;
  readonly damageDiceSides: number; readonly damageBonus: number;
  readonly damageType: string; readonly notes: string;
  readonly description: string; readonly campaignRuleNote: string;
  readonly spellSlotLevel?: number; readonly limitedUseId?: string;
  readonly limitedUseMax?: number; readonly resetOn?: 'Short Rest' | 'Long Rest';
} export interface CharacterCombatTelemetryVm {
  readonly characterKey: string; readonly characterName: string;
  readonly totalSessionRolls: number; readonly nat20Count: number;
  readonly critFailCount: number; readonly rollsByNumber: Readonly<Record<number, number>>;
  readonly landedStrikes: number; readonly missedStrikes: number;
  readonly attacksInterrupted: number; readonly attacksReducedDamage: number;
  readonly totalDamageDealt: number; readonly totalDamageReducedOrMitigated: number;
  readonly peakSingleHit: number; readonly spellsCastCount: number;
  readonly abilitiesUsedCount: number; }
export interface CharacterSheetRollLogVm { readonly id: string;
  readonly characterKey: string; readonly characterName: string;
  readonly category: string; readonly itemName: string;
  readonly formula: string; readonly rawRolls: readonly number[];
  readonly naturalDie: number; readonly modifier: number;
  readonly total: number; readonly isNat20: boolean;
  readonly isCritFail: boolean; readonly hit: boolean | null;
  readonly damageDealt: number; readonly damageReduced: number;
  readonly wasInterrupted: boolean; readonly wasDamageReduced: boolean;
  readonly actionSlotConsumed: string; readonly trackedInSession: boolean;
  readonly trackedInEncounter: boolean; readonly summaryMessage: string;
  readonly sha256Digest: string; readonly timestampLabel: string;
} export interface CharacterTurnEconomyState {
  readonly actionUsed: boolean; readonly bonusUsed: boolean;
  readonly reactionUsed: boolean; readonly movementUsedFeet: number;
  readonly heroicInspiration: boolean; readonly tempHp: number;
  readonly spellSlotsUsed: Readonly<Record<number, number>>; readonly limitedUsesSpent: Readonly<Record<string, number>>;
} export const STANDARD_COMBAT_ACTIONS: readonly {
  readonly id: string; readonly name: string;
  readonly cost: 'action' | 'bonus' | 'reaction'; readonly summary: string;
  readonly campaignAdjustment: string; }[] = [
  { id: 'ca-attack', name: 'Attack', cost: 'action', summary: 'Make one melee or ranged weapon attack (or two with Extra Attack at Level 5+ martial classes).', campaignAdjustment: 'In Shadow of the Mountain, Weapon Mastery properties (Vex, Topple, Push, Cleave, Nick) trigger automatically on landed strikes.' }, { id: 'ca-dash', name: 'Dash', cost: 'action', summary: 'Gain extra movement for the current turn equal to your Speed after applying modifiers.', campaignAdjustment: 'Rogues (Cunning Action) and Monks (Step of the Wind) may Dash as a Bonus Action.' },
  { id: 'ca-disengage', name: 'Disengage', cost: 'action', summary: 'Your movement does not provoke Opportunity Attacks for the rest of the current turn.', campaignAdjustment: 'Swashbucklers and Mobile/Speedy feat bearers automatically avoid Opportunity Attacks from targets they strike.' }, { id: 'ca-dodge', name: 'Dodge', cost: 'action', summary: 'Attack rolls against you have Disadvantage if you can see the attacker, and you make DEX saves with Advantage.', campaignAdjustment: 'Stacks with Cinth Artificer cover wards (+2 AC behind brass barricades).' },
  { id: 'ca-grapple', name: 'Grapple', cost: 'action', summary: 'Target makes a STR or DEX saving throw (DC = 8 + STR mod + Prof. Bonus) or has the Grappled condition (Speed 0).', campaignAdjustment: 'Kycius Quiet Maw modification allows Dolly to harmlessly pocket Grappled Small/Medium foes on a failed save.' }, { id: 'ca-help', name: 'Help', cost: 'action', summary: 'Grant an ally Advantage on their next ability check or attack roll against a creature within 5 ft.', campaignAdjustment: 'Familiars (such as Kycius fire drake Laksis) can take the Help action on their initiative count.' },
  { id: 'ca-hide', name: 'Hide', cost: 'action', summary: 'Make a DC 15 DEX (Stealth) check while Heavily Obscured or behind Three-Quarters/Total Cover to gain the Invisible condition.', campaignAdjustment: 'VTT 2.5D Line-of-Sight & Gradual Lighting automatically validates whether your token is in shadow.' }, { id: 'ca-magic', name: 'Magic', cost: 'action', summary: 'Cast a spell that has a casting time of 1 Action or activate a magical item/feature.', campaignAdjustment: 'Consumes 1 Action and the required Spell Slot level; subject to Counterspell reaction within 60 ft.' },
  { id: 'ca-ready', name: 'Ready', cost: 'action', summary: 'Prepare a specific action triggered by a perceivable circumstance before your next turn (uses Reaction when triggered).', campaignAdjustment: 'Holding a spell requires Concentration until the trigger fires.' }, { id: 'ca-search', name: 'Search', cost: 'action', summary: 'Make a WIS (Perception, Insight, Medicine, or Survival) check to discern concealed hazards or motives.', campaignAdjustment: 'Kildrid Stone-Sense grants automatic Advantage when searching subterranean stonework or dwarven runes.' },
  { id: 'ca-shove', name: 'Shove', cost: 'action', summary: 'Target makes a STR or DEX save (DC = 8 + STR mod + Prof. Bonus) or is pushed 5 ft or knocked Prone.', campaignAdjustment: 'Pushing a target into VTT elevation drop-offs or traps triggers immediate hazard damage.' },
  { id: 'ca-study', name: 'Study', cost: 'action', summary: 'Make an INT (Arcana, History, Investigation, Nature, or Religion) check to recall lore or analyze a foe.', campaignAdjustment: 'Reveals creature resistances and unlocks a Deep Link citation in The Loom.' },
  { id: 'ca-utilize', name: 'Utilize', cost: 'action', summary: 'Use a non-magical object, Cinth Artificer mechanism, healer kit, or lever.', campaignAdjustment: 'Drinking a Potion of Healing is a Bonus Action in this campaign; administering it to an ally is 1 Action.' },
];
@Injectable({ providedIn: 'root' })
export class CharacterSheetInteractiveService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(LoomWeaverStoreService);
  private readonly vttCombat = inject(VttCombatService);
  /** Right Collapsible Campaign Rules Drawer — collapsed by default, auto-opens on item selection */
  readonly rightDrawerOpen = signal<boolean>(false);
  readonly inspectedRule = signal<CampaignAdjustedRuleVm | null>(null);
  /** Live Session & Encounter Gating */
  readonly isSessionLive = signal<boolean>(true);
  readonly activeSessionId = signal<string>('session-15');
  readonly activeSessionTitle = signal<string>('Session 15 — Shadow Beneath the Ruined Chapel');
  readonly isEncounterLive = signal<boolean>(true);
  readonly activeEncounterId = signal<string>('enc-ruined-chapel');
  readonly activeEncounterTitle = signal<string>('Ruined Chapel Courtyard Ambush');
  readonly signalRConnected = signal<boolean>(true);
  readonly selectedTargetName = signal<string>('Cinth Vampire Spawn (AC 15)');
  readonly selectedTargetAc = signal<number>(15);
  readonly reactionOutcomeMode = signal<'none' | 'interrupted' | 'reduced'>('none');
  readonly damageReductionAmount = signal<number>(5);
  readonly rollToastBanner = signal<string | null>(null);
  private readonly economyByChar = signal<Readonly<Record<string, CharacterTurnEconomyState>>>({});
  private readonly telemetryByChar = signal<Readonly<Record<string, CharacterCombatTelemetryVm>>>({});
  readonly rollLogs = signal<readonly CharacterSheetRollLogVm[]>([
    {
      id: 'cs-seed-1',
      characterKey: 'char-ciaran',
      characterName: 'Ciarán Fiachra',
      category: 'spell-attack',
      itemName: 'Fire Bolt',
      formula: '1d20 + 7',
      rawRolls: [17],
      naturalDie: 17,
      modifier: 7,
      total: 24,
      isNat20: false,
      isCritFail: false,
      hit: true,
      damageDealt: 11,
      damageReduced: 0,
      wasInterrupted: false,
      wasDamageReduced: false,
      actionSlotConsumed: 'action',
      trackedInSession: true,
      trackedInEncounter: true,
      summaryMessage: 'Ciarán Fiachra rolled Fire Bolt (1d20 + 7) = 24 [Natural 17] -> HIT Cinth Vampire Spawn (AC 15) for 11 Fire dmg! [Tracked: Live Session + Live Encounter]',
      sha256Digest: 'SHA256:8B1F4A92C03E771A',
      timestampLabel: '2m ago',
    },
  ]);
  private broadcastChannel?: BroadcastChannel;
  constructor() {
    this.initRealtimeSync();
    this.fetchLiveState('char-ciaran');
  }
  getEconomyFor(charKey: string): CharacterTurnEconomyState {
    return (
      this.economyByChar()[charKey] ?? {
        actionUsed: false,
        bonusUsed: false,
        reactionUsed: false,
        movementUsedFeet: 0,
        heroicInspiration: true,
        tempHp: 0,
        spellSlotsUsed: { 1: 1, 2: 0, 3: 0, 4: 0 },
        limitedUsesSpent: {},
      }
    );
  }
  getTelemetryFor(charKey: string, charName: string): CharacterCombatTelemetryVm {
    const existing = this.telemetryByChar()[charKey];
    if (existing) return existing;
    const dist: Record<number, number> = {};
    for (let i = 1; i <= 20; i++) dist[i] = i === 20 ? 5 : i === 1 ? 2 : 3;
    return {
      characterKey: charKey,
      characterName: charName,
      totalSessionRolls: 64,
      nat20Count: 5,
      critFailCount: 2,
      rollsByNumber: dist,
      landedStrikes: 22,
      missedStrikes: 6,
      attacksInterrupted: 4,
      attacksReducedDamage: 5,
      totalDamageDealt: 318,
      totalDamageReducedOrMitigated: 86,
      peakSingleHit: 42,
      spellsCastCount: 14,
      abilitiesUsedCount: 19,
    };
  }
  fetchLiveState(characterKey: string): void {
    const cid = this.store.activeCampaignId();
    this.http
      .get<{
        liveState: {
          isSessionLive: boolean;
          activeSessionId: string;
          activeSessionTitle: string;
          isEncounterLive: boolean;
          activeEncounterId: string;
          activeEncounterTitle: string;
        };
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
        isSessionLive: this.isSessionLive(),
        activeSessionId: this.activeSessionId(),
        activeSessionTitle: this.activeSessionTitle(),
        isEncounterLive: this.isEncounterLive(),
        activeEncounterId: this.activeEncounterId(),
        activeEncounterTitle: this.activeEncounterTitle(),
        activeRound: this.vttCombat.activeRound(),
      })
      .subscribe({ error: () => {} });
  }
  inspectRuleInDrawer(rule: CampaignAdjustedRuleVm): void {
    this.inspectedRule.set(rule);
    this.rightDrawerOpen.set(true);
  }
  toggleHeroicInspiration(charKey: string): void {
    const cur = this.getEconomyFor(charKey);
    this.patchEconomy(charKey, { heroicInspiration: !cur.heroicInspiration });
  }
  toggleActionSlotManual(charKey: string, slot: 'actionUsed' | 'bonusUsed' | 'reactionUsed'): void {
    const cur = this.getEconomyFor(charKey);
    this.patchEconomy(charKey, { [slot]: !cur[slot] });
    this.vttCombat.toggleEconomySlot(`1:Character:${charKey}`, slot);
  }
  resetTurnEconomy(charKey: string): void {
    this.patchEconomy(charKey, {
      actionUsed: false,
      bonusUsed: false,
      reactionUsed: false,
      movementUsedFeet: 0,
    });
    this.rollToastBanner.set('New Turn: Action, Bonus Action, Reaction, and 30 ft Movement refreshed.');
  }
  takeShortRest(sheet: CharacterSheetVm): void {
    const cur = this.getEconomyFor(sheet.characterKey);
    const nextSlots = { ...cur.spellSlotsUsed, 1: Math.max(0, (cur.spellSlotsUsed[1] ?? 0) - 2) };
    this.patchEconomy(sheet.characterKey, {
      actionUsed: false,
      bonusUsed: false,
      reactionUsed: false,
      movementUsedFeet: 0,
      spellSlotsUsed: nextSlots,
      limitedUsesSpent: {},
    });
    this.rollToastBanner.set(`${sheet.name} completed a Short Rest (1 Hour): Short-Rest features & Arcane Recovery restored.`);
  }
  takeLongRest(sheet: CharacterSheetVm): void {
    this.patchEconomy(sheet.characterKey, {
      actionUsed: false,
      bonusUsed: false,
      reactionUsed: false,
      movementUsedFeet: 0,
      heroicInspiration: true,
      spellSlotsUsed: { 1: 0, 2: 0, 3: 0, 4: 0 },
      limitedUsesSpent: {},
    });
    this.rollToastBanner.set(`${sheet.name} completed a Long Rest (8 Hours): Full HP, all Spell Slots, and Limited-Use charges restored.`);
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
      itemId: string;
      itemName: string;
      actionSlotCost: 'none' | 'action' | 'bonus' | 'reaction' | 'movement';
      diceSides: number;
      diceCount: number;
      modifier: number;
      damageDiceCount?: number;
      damageDiceSides?: number;
      damageBonus?: number;
      damageType?: string;
      spellSlotLevel?: number;
      maxSpellSlots?: number;
      limitedUseId?: string;
      maxLimitedUses?: number;
    },
  ): void {
    const check = this.canExecuteAction(
      sheet.characterKey,
      params.actionSlotCost,
      params.spellSlotLevel,
      params.maxSpellSlots,
      params.limitedUseId,
      params.maxLimitedUses,
    );
    if (!check.allowed) {
      this.rollToastBanner.set(`Cannot use ${params.itemName}: ${check.reason}. Reset turn economy or take a rest.`);
      return;
    }
    const econ = this.getEconomyFor(sheet.characterKey);
    this.patchEconomy(sheet.characterKey, {
      actionUsed: params.actionSlotCost === 'action' ? true : econ.actionUsed,
      bonusUsed: params.actionSlotCost === 'bonus' ? true : econ.bonusUsed,
      reactionUsed: params.actionSlotCost === 'reaction' ? true : econ.reactionUsed,
      spellSlotsUsed: params.spellSlotLevel && params.spellSlotLevel > 0 ? { ...econ.spellSlotsUsed, [params.spellSlotLevel]: (econ.spellSlotsUsed[params.spellSlotLevel] ?? 0) + 1 } : econ.spellSlotsUsed,
      limitedUsesSpent: params.limitedUseId ? { ...econ.limitedUsesSpent, [params.limitedUseId]: (econ.limitedUsesSpent[params.limitedUseId] ?? 0) + 1 } : econ.limitedUsesSpent,
    });
    const cid = this.store.activeCampaignId();
    const payload = {
      characterKey: sheet.characterKey,
      characterName: sheet.name,
      category: params.category,
      itemId: params.itemId,
      itemName: params.itemName,
      actionSlotCost: params.actionSlotCost,
      spellSlotLevel: params.spellSlotLevel ?? null,
      limitedUseId: params.limitedUseId ?? null,
      diceSides: params.diceSides,
      diceCount: params.diceCount,
      modifier: params.modifier,
      rollMode: 'normal',
      targetName: this.selectedTargetName(),
      targetAc: this.selectedTargetAc(),
      damageDiceCount: params.damageDiceCount ?? null,
      damageDiceSides: params.damageDiceSides ?? null,
      damageBonus: params.damageBonus ?? null,
      damageType: params.damageType ?? null,
      reactionOutcome: this.reactionOutcomeMode(),
      damageReducedBy: this.reactionOutcomeMode() === 'reduced' ? this.damageReductionAmount() : 0,
      isSessionLive: this.isSessionLive(),
      isEncounterLive: this.isEncounterLive(),
      sessionId: this.activeSessionId(),
      encounterId: this.activeEncounterId(),
      round: this.vttCombat.activeRound(),
    };
    this.http
      .post<{ roll: CharacterSheetRollLogVm; telemetry: CharacterCombatTelemetryVm }>(
        `/api/v2/campaigns/${cid}/character-sheet/roll-action`,
        payload,
      )
      .subscribe({
        next: (res) => {
          if (res?.roll) {
            const logItem: CharacterSheetRollLogVm = { ...res.roll, timestampLabel: 'Just now' };
            this.rollLogs.update((list) => [logItem, ...list.slice(0, 29)]);
            this.rollToastBanner.set(logItem.summaryMessage);
            this.syncRollIntoEncounterAndLoom(sheet, logItem);
            this.broadcastChannel?.postMessage({ type: 'sheet_roll', log: logItem, telemetry: res.telemetry });
          }
          if (res?.telemetry) {
            this.telemetryByChar.update((cur) => ({ ...cur, [sheet.characterKey]: res.telemetry }));
          }
        },
        error: () => {},
      });
  }
  private syncRollIntoEncounterAndLoom(sheet: CharacterSheetVm, logItem: CharacterSheetRollLogVm): void {
    this.store.quickRollBanner.set(`${logItem.itemName}: ${logItem.total}${logItem.isNat20 ? ' (NAT 20!)' : ''}`);
    if (logItem.trackedInEncounter) {
      this.vttCombat.combatLogs.update((logs) => [
        {
          id: logItem.id,
          round: this.vttCombat.activeRound(),
          attackerName: sheet.name,
          targetName: this.selectedTargetName(),
          actionName: logItem.itemName,
          distanceFeet: 30,
          hit: logItem.hit ?? true,
          isCritical: logItem.isNat20,
          damageDealt: logItem.damageDealt,
          message: logItem.summaryMessage,
        },
        ...logs.slice(0, 14),
      ]);
    }
  }
  private patchEconomy(charKey: string, patch: Partial<CharacterTurnEconomyState>): void {
    const cur = this.getEconomyFor(charKey);
    this.economyByChar.update((map) => ({ ...map, [charKey]: { ...cur, ...patch } }));
  }
  private initRealtimeSync(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('loomweaver_table_realtime_v2');
        this.broadcastChannel.onmessage = (ev) => {
          if (ev.data?.type === 'sheet_roll' && ev.data.log) {
            this.rollLogs.update((list) => [ev.data.log, ...list.filter((x) => x.id !== ev.data.log.id).slice(0, 29)]);
          }
        };
      }
    } catch {}
  }
}
