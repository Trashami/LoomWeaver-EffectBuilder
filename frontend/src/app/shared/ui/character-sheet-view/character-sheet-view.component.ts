import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgpProgress, NgpProgressIndicator, NgpProgressTrack } from 'ng-primitives/progress';
import {
  CREATOR_EQUIPMENT_DATABASE,
  CREATOR_SPELL_DATABASE,
  DEFAULT_CAMPAIGN_HISTORY,
  DEFAULT_MENTIONABLE_ENTITIES,
  DEFAULT_MET_ENTITIES,
  calculateMaxPreparedSpells,
  getSpellPreparationRuleExplanation,
} from '../../../features/characters/models/character-creator-catalog.data';
import {
  AbilityScoreVm,
  CharacterCampaignHistoryEventVm,
  CharacterConnectionChipVm,
  CharacterFeatureCardVm,
  CharacterMetEntityVm,
  CharacterRichNoteVm,
  SavingThrowVm,
  CharacterSheetTab,
  CharacterSheetVm,
  CharacterSkillVm,
  CharacterSpellVm,
  EquipmentLoadoutItemVm,
  LwNoteMentionTagVm,
} from '../../../features/characters/models/character-studio.models';
import {
  CampaignAdjustedRuleVm,
  CharacterSheetActionRowVm,
  CharacterSheetInteractiveService,
  STANDARD_COMBAT_ACTIONS,
} from '../../../features/characters/services/character-sheet-interactive.service';
import {
  buildAbilityRuleVm,
  buildActionRowRuleVm,
  buildCharacterSheetActionRows,
  buildCombatActionRuleVm,
  buildFeatureOrItemRuleVm,
  buildSaveRuleVm,
  buildSkillRuleVm,
  buildSpellRuleVm,
} from '../../../features/characters/services/character-sheet-rules.helpers';
import { LwButtonComponent } from '../button/button.component';
import { LwCharacterPortraitPickerComponent } from '../character-portrait-picker/character-portrait-picker.component';
import { LwIconComponent } from '../icon/icon.component';
import { LwNoteComposerModalComponent } from '../note-composer-modal/note-composer-modal.component';
export type DndSheetMainTab = 'ACTIONS' | 'SPELLS' | 'INVENTORY' | 'FEATURES' | 'BACKGROUND' | 'NOTES' | 'EXTRAS';
export type DndActionFilter = 'ALL' | 'ATTACK' | 'ACTION' | 'BONUS ACTION' | 'REACTION' | 'OTHER' | 'LIMITED USE';
@Component({
  selector: 'lw-character-sheet-view',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgpProgress,
    NgpProgressTrack,
    NgpProgressIndicator,
    LwIconComponent,
    LwButtonComponent,
    LwCharacterPortraitPickerComponent,
    LwNoteComposerModalComponent,
  ],
  templateUrl: './character-sheet-view.component.html',
  styleUrl: './character-sheet-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LwCharacterSheetViewComponent {
  readonly interactive = inject(CharacterSheetInteractiveService);
  readonly sheet = input.required<CharacterSheetVm>();
  readonly partyRoster = input<readonly CharacterSheetVm[]>([]);
  readonly equipmentDatabase = input<readonly EquipmentLoadoutItemVm[]>(CREATOR_EQUIPMENT_DATABASE);
  readonly spellDatabase = input<readonly CharacterSpellVm[]>(CREATOR_SPELL_DATABASE);
  readonly mentionableEntities = input<readonly LwNoteMentionTagVm[]>(DEFAULT_MENTIONABLE_ENTITIES);
  readonly activeTab = model<CharacterSheetTab>('overview');
  readonly characterSelected = output<string>();
  readonly createCharacterRequested = output<void>();
  readonly editCharacterRequested = output<CharacterSheetVm>();
  readonly studioRosterRequested = output<void>();
  readonly levelUpRequested = output<{ featureName: string; abilityCode: AbilityScoreVm['code'] }>();
  readonly portraitChangeRequested = output<void>();
  readonly portraitSelected = output<string>();
  readonly abilityAdjusted = output<{ code: AbilityScoreVm['code']; delta: number }>();
  readonly equipmentToggled = output<string>();
  readonly equipmentAdded = output<{ item: EquipmentLoadoutItemVm; equipNow: boolean }>();
  readonly equipmentRemoved = output<string>();
  readonly spellPreparedToggled = output<string>();
  readonly spellAdded = output<{ spell: CharacterSpellVm; prepared: boolean }>();
  readonly connectionSelected = output<CharacterConnectionChipVm>();
  readonly noteAdded = output<string>();
  readonly richNoteAdded = output<CharacterRichNoteVm>();
  readonly mainSheetTab = signal<DndSheetMainTab>('ACTIONS');
  readonly actionSubFilter = signal<DndActionFilter>('ALL');
  readonly hpDeltaInput = signal<number>(5);
  readonly customHpCurrent = signal<number | null>(null);
  readonly portraitModalOpen = signal<boolean>(false);
  readonly noteComposerOpen = signal<boolean>(false);
  readonly equipmentSearch = signal<string>('');
  readonly spellSearch = signal<string>('');
  readonly metFilter = signal<'All' | 'NPC' | 'Place'>('All');
  readonly historyFilter = signal<'All' | 'Session' | 'Encounter' | 'Quest' | 'Milestone'>('All');
  readonly inspectedMetEntity = signal<CharacterMetEntityVm | null>(null);
  readonly pendingSpellPrep = signal<{
    spell: CharacterSpellVm;
    makingPrepared: boolean;
    rule: ReturnType<typeof getSpellPreparationRuleExplanation>;
  } | null>(null);
  readonly mainTabs: readonly { id: DndSheetMainTab; label: string }[] = [
    { id: 'ACTIONS', label: 'ACTIONS' },
    { id: 'SPELLS', label: 'SPELLS' },
    { id: 'INVENTORY', label: 'INVENTORY' },
    { id: 'FEATURES', label: 'FEATURES & TRAITS' },
    { id: 'BACKGROUND', label: 'BACKGROUND' },
    { id: 'NOTES', label: 'NOTES' },
    { id: 'EXTRAS', label: 'EXTRAS & TELEMETRY' },
  ];
  readonly actionFilters: readonly DndActionFilter[] = [
    'ALL',
    'ATTACK',
    'ACTION',
    'BONUS ACTION',
    'REACTION',
    'OTHER',
    'LIMITED USE',
  ];
  readonly standardCombatActions = STANDARD_COMBAT_ACTIONS;
  readonly buildActionRowRuleVm = buildActionRowRuleVm;
  readonly d20Numbers = Array.from({ length: 20 }, (_, i) => i + 1);
  constructor() {
    effect(() => {
      const s = this.sheet();
      if (s?.characterKey) {
        this.interactive.fetchLiveState(s.characterKey);
      }
    });
  }
  readonly effectiveHpCurrent = computed<number>(() => this.customHpCurrent() ?? this.sheet().currentHp);
  readonly economy = computed(() => this.interactive.getEconomyFor(this.sheet().characterKey));
  readonly telemetry = computed(() =>
    this.interactive.getTelemetryFor(this.sheet().characterKey, this.sheet().name),
  );
  readonly xpProgressPercent = computed<number>(() => {
    const s = this.sheet();
    if (!s.nextLevelXp || s.nextLevelXp <= 0) return 75;
    return Math.max(8, Math.min(100, Math.round((s.currentXp / s.nextLevelXp) * 100)));
  });
  readonly primaryAbilityCode = computed<AbilityScoreVm['code']>(() => {
    const sorted = [...this.sheet().abilities].sort((a, b) => b.score - a.score);
    return sorted[0]?.code ?? 'INT';
  });
  readonly primaryAbilityScore = computed<number>(() => {
    const code = this.primaryAbilityCode();
    return this.sheet().abilities.find((a) => a.code === code)?.score ?? 16;
  });
  readonly primaryAbilityMod = computed<number>(() => {
    const code = this.primaryAbilityCode();
    return this.sheet().abilities.find((a) => a.code === code)?.modifier ?? 3;
  });
  readonly spellAttackBonus = computed<number>(() => this.sheet().proficiencyBonus + this.primaryAbilityMod());
  readonly spellSaveDc = computed<number>(() => 8 + this.spellAttackBonus());
  readonly passivePerception = computed<number>(
    () => 10 + (this.sheet().skills.find((sk) => sk.label === 'Perception')?.bonus ?? 2),
  );
  readonly passiveInvestigation = computed<number>(
    () => 10 + (this.sheet().skills.find((sk) => sk.label === 'Investigation')?.bonus ?? 3),
  );
  readonly passiveInsight = computed<number>(
    () => 10 + (this.sheet().skills.find((sk) => sk.label === 'Insight')?.bonus ?? 2),
  );
  readonly allActionRows = computed<readonly CharacterSheetActionRowVm[]>(() =>
    buildCharacterSheetActionRows(this.sheet(), this.primaryAbilityMod(), this.spellSaveDc()),
  );
  readonly filteredActionRows = computed<readonly CharacterSheetActionRowVm[]>(() => {
    const f = this.actionSubFilter();
    const list = this.allActionRows();
    if (f === 'ALL') return list;
    if (f === 'ACTION') return list.filter((r) => r.actionSlotCost === 'action');
    return list.filter((r) => r.filterCategory === f);
  });
  readonly maxPreparedSpells = computed<number>(() =>
    calculateMaxPreparedSpells(this.sheet().level, this.primaryAbilityScore()),
  );
  readonly allCharacterSpells = computed<readonly CharacterSpellVm[]>(() =>
    this.sheet().spellGroups.flatMap((g) =>
      g.spells.map((sp) => ({
        ...sp,
        level: sp.level ?? (g.isCantrip ? 0 : 1),
        prepared: g.isCantrip ? true : (sp.prepared ?? true),
      })),
    ),
  );
  readonly preparedLeveledSpellsCount = computed<number>(
    () => this.allCharacterSpells().filter((sp) => (sp.level ?? 1) > 0 && sp.prepared).length,
  );
  readonly filteredSpellCompendium = computed<readonly CharacterSpellVm[]>(() => {
    const q = this.spellSearch().trim().toLowerCase();
    return this.spellDatabase()
      .filter((sp) => !q || sp.name.toLowerCase().includes(q) || sp.school.toLowerCase().includes(q))
      .slice(0, 14);
  });
  readonly equippedItems = computed<readonly EquipmentLoadoutItemVm[]>(() =>
    this.sheet().equipment.filter((e) => e.equipped),
  );
  readonly backpackItems = computed<readonly EquipmentLoadoutItemVm[]>(() =>
    this.sheet().equipment.filter((e) => !e.equipped),
  );
  readonly filteredEquipmentCatalog = computed<readonly EquipmentLoadoutItemVm[]>(() => {
    const q = this.equipmentSearch().trim().toLowerCase();
    return this.equipmentDatabase()
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.slot.toLowerCase().includes(q))
      .slice(0, 16);
  });
  readonly metEntitiesList = computed<readonly CharacterMetEntityVm[]>(() => {
    const list = this.sheet().metEntities ?? DEFAULT_MET_ENTITIES;
    const f = this.metFilter();
    return f === 'All' ? list : list.filter((e) => e.entityType === f);
  });
  readonly campaignHistoryList = computed<readonly CharacterCampaignHistoryEventVm[]>(() => {
    const list = this.sheet().campaignHistory ?? DEFAULT_CAMPAIGN_HISTORY;
    const f = this.historyFilter();
    return f === 'All' ? list : list.filter((e) => e.category === f);
  });
  readonly totalCarriedWeightLbs = computed<number>(() => this.sheet().equipment.reduce((acc, e) => acc + (e.weightLb ?? 2), 0));
  readonly carryingCapacityLbs = computed<number>(() => {
    const str = this.sheet().abilities.find((a) => a.code === 'STR')?.score ?? 10;
    return str * 15;
  });
  formatMod(mod: number): string {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }
  applyHeal(): void {
    const amt = Math.max(1, Number(this.hpDeltaInput()) || 1);
    this.customHpCurrent.set(Math.min(this.sheet().maxHp, this.effectiveHpCurrent() + amt));
  }
  applyDamage(): void {
    const amt = Math.max(1, Number(this.hpDeltaInput()) || 1);
    this.customHpCurrent.set(Math.max(0, this.effectiveHpCurrent() - amt));
  }
  onAbilityClicked(ab: AbilityScoreVm): void {
    const rule = buildAbilityRuleVm(ab);
    this.interactive.inspectRuleInDrawer(rule);
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'ability',
      itemId: rule.id,
      itemName: `${ab.label} Check`,
      actionSlotCost: 'none',
      diceSides: 20,
      diceCount: 1,
      modifier: ab.modifier,
    });
  }
  onSaveClicked(sv: SavingThrowVm): void {
    const rule = buildSaveRuleVm(sv);
    this.interactive.inspectRuleInDrawer(rule);
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'save',
      itemId: rule.id,
      itemName: `${sv.code} Saving Throw`,
      actionSlotCost: 'none',
      diceSides: 20,
      diceCount: 1,
      modifier: sv.bonus,
    });
  }
  onSkillClicked(sk: CharacterSkillVm): void {
    const rule = buildSkillRuleVm(sk);
    this.interactive.inspectRuleInDrawer(rule);
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'skill',
      itemId: rule.id,
      itemName: `${sk.label} (${sk.abilityCode})`,
      actionSlotCost: 'none',
      diceSides: 20,
      diceCount: 1,
      modifier: sk.bonus,
    });
  }
  onInitiativeClicked(): void {
    const s = this.sheet();
    const rule: CampaignAdjustedRuleVm = {
      id: 'rule-initiative',
      categoryLabel: 'Combat Initiative',
      title: 'Initiative Roll',
      subtitle: `DEX Modifier ${this.formatMod(s.initiativeBonus)}`,
      castingOrActionTime: 'Start of Encounter',
      rangeOrArea: 'Self',
      componentsOrSlot: 'Free Roll',
      durationLabel: 'Encounter Duration',
      sourceLabel: 'PHB 2024 / VTT Combat Engine',
      damageOrBonusBadge: `${this.formatMod(s.initiativeBonus)} Init`,
      standardRuleText: 'At the beginning of every combat encounter, roll 1d20 + your Initiative bonus to determine turn order.',
      campaignAdjustedRuleTitle: 'Adjusted Campaign Rule (VTT Sync)',
      campaignAdjustedRuleText: 'Rolling Initiative from your Character Sheet automatically updates your turn position in the live VTT Initiative Tracker.',
      tags: ['Initiative', 'DEX', 'VTT Synced'],
      rollConfig: { category: 'initiative', actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: s.initiativeBonus },
    };
    this.interactive.inspectRuleInDrawer(rule);
    this.interactive.executeSheetRollAndAction(s, {
      category: 'initiative',
      itemId: 'init-roll',
      itemName: 'Initiative',
      actionSlotCost: 'none',
      diceSides: 20,
      diceCount: 1,
      modifier: s.initiativeBonus,
    });
  }
  onArmorClassClicked(): void {
    const s = this.sheet();
    this.interactive.inspectRuleInDrawer({
      id: 'rule-ac',
      categoryLabel: 'Defense & Ward',
      title: `Armor Class (${s.armorClass})`,
      subtitle: 'Equipped Armor & Dexterity Defense',
      castingOrActionTime: 'Passive Defense',
      rangeOrArea: 'Self',
      componentsOrSlot: `AC ${s.armorClass}`,
      durationLabel: 'Continuous',
      sourceLabel: 'PHB 2024 / Action Studio',
      damageOrBonusBadge: `AC ${s.armorClass}`,
      standardRuleText: `Enemy attack rolls must meet or exceed AC ${s.armorClass} to land a strike.`,
      campaignAdjustedRuleTitle: 'Adjusted Campaign Rule (Shield & Deflection)',
      campaignAdjustedRuleText: 'Casting Shield (+5 AC) or triggering Cinth Artificer wards as a Reaction turns a hit into an Interrupted Attack in campaign telemetry.',
      tags: [`AC ${s.armorClass}`, 'Defense', 'Reaction Ready'],
    });
  }
  onActionRowHitClicked(row: CharacterSheetActionRowVm): void {
    const rule = buildActionRowRuleVm(row);
    this.interactive.inspectRuleInDrawer(rule);
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: row.filterCategory === 'ATTACK' ? 'attack' : 'feature',
      itemId: row.id,
      itemName: row.name,
      actionSlotCost: row.actionSlotCost,
      diceSides: 20,
      diceCount: 1,
      modifier: row.attackBonus,
      damageDiceCount: row.damageDiceCount,
      damageDiceSides: row.damageDiceSides,
      damageBonus: row.damageBonus,
      damageType: row.damageType,
      spellSlotLevel: row.spellSlotLevel,
      limitedUseId: row.limitedUseId,
      maxLimitedUses: row.limitedUseMax,
    });
  }
  onActionRowDamageClicked(row: CharacterSheetActionRowVm): void {
    this.interactive.inspectRuleInDrawer(buildActionRowRuleVm(row));
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'damage',
      itemId: `${row.id}-dmg`,
      itemName: `${row.name} (${row.damageType})`,
      actionSlotCost: 'none',
      diceSides: row.damageDiceSides,
      diceCount: row.damageDiceCount,
      modifier: row.damageBonus,
      damageType: row.damageType,
    });
  }
  onCombatActionClicked(ca: (typeof STANDARD_COMBAT_ACTIONS)[number]): void {
    const rule = buildCombatActionRuleVm(ca, this.primaryAbilityMod());
    this.interactive.inspectRuleInDrawer(rule);
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'combat-action',
      itemId: ca.id,
      itemName: `${ca.name} Action`,
      actionSlotCost: ca.cost,
      diceSides: 20,
      diceCount: 1,
      modifier: this.primaryAbilityMod(),
    });
  }
  onSpellCastClicked(sp: CharacterSpellVm, slotMax = 4): void {
    const rule = buildSpellRuleVm(sp, this.spellAttackBonus(), this.spellSaveDc());
    this.interactive.inspectRuleInDrawer(rule);
    const isCantrip = (sp.level ?? 0) === 0;
    const cost: 'action' | 'bonus' | 'reaction' = (sp.actionCost ?? "1 Action").toLowerCase().includes('bonus')
      ? 'bonus'
      : (sp.actionCost ?? "1 Action").toLowerCase().includes('reaction')
        ? 'reaction'
        : 'action';
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'spell-attack',
      itemId: sp.id,
      itemName: sp.name,
      actionSlotCost: cost,
      diceSides: 20,
      diceCount: 1,
      modifier: this.spellAttackBonus(),
      damageDiceCount: isCantrip ? 2 : (sp.level ?? 1) + 1,
      damageDiceSides: 8,
      damageBonus: 0,
      damageType: `${sp.school} Force`,
      spellSlotLevel: isCantrip ? undefined : (sp.level ?? 1),
      maxSpellSlots: slotMax,
    });
  }
  onFeatureOrItemInspect(item: CharacterFeatureCardVm | EquipmentLoadoutItemVm, kind: 'feature' | 'item'): void {
    const rule = buildFeatureOrItemRuleVm(item, kind, this.primaryAbilityMod());
    this.interactive.inspectRuleInDrawer(rule);
  }
  executeInspectedRuleRoll(rule: CampaignAdjustedRuleVm): void {
    if (!rule.rollConfig) return;
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: rule.rollConfig.category,
      itemId: rule.id,
      itemName: rule.title,
      actionSlotCost: rule.rollConfig.actionSlotCost,
      diceSides: rule.rollConfig.diceSides,
      diceCount: rule.rollConfig.diceCount,
      modifier: rule.rollConfig.modifier,
      damageDiceCount: rule.rollConfig.damageDiceCount,
      damageDiceSides: rule.rollConfig.damageDiceSides,
      damageBonus: rule.rollConfig.damageBonus,
      damageType: rule.rollConfig.damageType,
      spellSlotLevel: rule.rollConfig.spellSlotLevel,
      limitedUseId: rule.rollConfig.limitedUseId,
    });
  }
  promptSpellPreparationToggle(spell: CharacterSpellVm): void {
    if ((spell.level ?? 1) === 0) return;
    const makingPrepared = !spell.prepared;
    const rule = getSpellPreparationRuleExplanation(
      this.sheet().classOrArchetype,
      this.sheet().level,
      spell.name,
      spell.level ?? 1,
      makingPrepared,
    );
    this.pendingSpellPrep.set({ spell, makingPrepared, rule });
  }
  confirmSpellPreparationChange(): void {
    const pending = this.pendingSpellPrep();
    if (!pending) return;
    this.spellPreparedToggled.emit(pending.spell.id);
    this.pendingSpellPrep.set(null);
  }
  slotRange(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, (_, i) => i);
  }
}
