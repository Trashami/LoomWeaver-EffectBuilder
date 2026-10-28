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
  DEFAULT_MENTIONABLE_ENTITIES,
  DEFAULT_MET_ENTITIES,
  calculateMaxPreparedSpells,
  getSpellPreparationRuleExplanation,
} from '../../../features/characters/models/character-creator-catalog.data';
import {
  AbilityScoreVm,
  CharacterConnectionChipVm,
  CharacterFeatureCardVm,
  CharacterMetEntityVm,
  CharacterRichNoteVm,
  CharacterSheetTab,
  CharacterSheetVm,
  CharacterSkillVm,
  CharacterSpellVm,
  EquipmentLoadoutItemVm,
  LwNoteMentionTagVm,
  SavingThrowVm,
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
  buildCharacterContextRuleVm,
  buildCharacterSheetActionRows,
  buildCombatActionRuleVm,
  buildFeatureOrItemRuleVm,
  buildSaveRuleVm,
  buildSkillRuleVm,
  buildSpellRuleVm,
  getEquipmentItemImageUrl,
  matchesItemQuickFilter,
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
  readonly portraitModalOpen = signal<boolean>(false);
  readonly noteComposerOpen = signal<boolean>(false);
  readonly itemBrowserModalOpen = signal<boolean>(false);
  readonly equipmentSearch = signal<string>('');
  readonly itemQuickFilter = signal<string>('all');
  readonly spellSearch = signal<string>('');
  readonly metFilter = signal<'All' | 'NPC' | 'Place'>('All');
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

  readonly itemQuickFilters: readonly { id: string; label: string }[] = [
    { id: 'all', label: 'All Items' },
    { id: 'magical', label: 'Magical' },
    { id: 'rings', label: 'Rings & Amulets' },
    { id: 'weapons', label: 'Weapons' },
    { id: 'armor', label: 'Armor & Shields' },
    { id: 'potions', label: 'Potions & Vials' },
    { id: 'focuses', label: 'Arcane Focuses' },
    { id: 'gear', label: 'Gear & Tools' },
  ];

  readonly standardCombatActions = STANDARD_COMBAT_ACTIONS;
  readonly d20Numbers = Array.from({ length: 20 }, (_, i) => i + 1);

  constructor() {
    effect(() => {
      const s = this.sheet();
      if (s?.characterKey) {
        this.interactive.fetchLiveState(s.characterKey);
      }
    });
  }

  readonly effectiveHpCurrent = computed<number>(() => this.interactive.getLiveHpFor(this.sheet()));
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
  readonly equippedItems = computed<readonly EquipmentLoadoutItemVm[]>(() =>
    this.sheet().equipment.filter((e) => e.equipped),
  );
  readonly backpackItems = computed<readonly EquipmentLoadoutItemVm[]>(() =>
    this.sheet().equipment.filter((e) => !e.equipped),
  );

  readonly filteredEquipmentCatalog = computed<readonly EquipmentLoadoutItemVm[]>(() => {
    const q = this.equipmentSearch().trim().toLowerCase();
    const flt = this.itemQuickFilter();
    return this.equipmentDatabase().filter((item) => {
      if (!matchesItemQuickFilter(item, flt)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.slot.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.bonusLabel.toLowerCase().includes(q) ||
        (item.rarity ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly metEntitiesList = computed<readonly CharacterMetEntityVm[]>(() => {
    const list = this.sheet().metEntities ?? DEFAULT_MET_ENTITIES;
    const f = this.metFilter();
    return f === 'All' ? list : list.filter((e) => e.entityType === f);
  });

  readonly totalCarriedWeightLbs = computed<number>(() =>
    this.sheet().equipment.reduce((acc, e) => acc + (e.weightLb ?? 2), 0),
  );
  readonly carryingCapacityLbs = computed<number>(() => {
    const str = this.sheet().abilities.find((a) => a.code === 'STR')?.score ?? 10;
    return str * 15;
  });

  itemImageUrl(item: EquipmentLoadoutItemVm): string {
    return getEquipmentItemImageUrl(item);
  }

  formatMod(mod: number): string {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  applyHeal(): void {
    const amt = Math.max(1, Number(this.hpDeltaInput()) || 1);
    this.interactive.applyCharacterHpChange(this.sheet(), this.effectiveHpCurrent() + amt);
  }

  applyDamage(): void {
    const amt = Math.max(1, Number(this.hpDeltaInput()) || 1);
    this.interactive.applyCharacterHpChange(this.sheet(), this.effectiveHpCurrent() - amt);
  }

  /* 1. PURE ROLL HANDLERS (Clicking the +Modifier / Hit / Damage Box ONLY rolls!) */
  rollAbilityOnly(ab: AbilityScoreVm): void {
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'ability', itemId: `rule-ab-${ab.code}`, itemName: `${ab.label} Check`,
      actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: ab.modifier,
      modifiersBreakdown: `${ab.code} ${this.formatMod(ab.modifier)}`,
    });
  }

  rollSaveOnly(sv: SavingThrowVm): void {
    const abMod = this.sheet().abilities.find((a) => a.code === sv.code)?.modifier ?? 0;
    const profPart = sv.proficient ? `, Prof +${this.sheet().proficiencyBonus}` : '';
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'save', itemId: `rule-save-${sv.code}`, itemName: `${sv.code} Saving Throw`,
      actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: sv.bonus,
      modifiersBreakdown: `${sv.code} ${this.formatMod(abMod)}${profPart}`,
    });
  }

  rollSkillOnly(sk: CharacterSkillVm): void {
    const abMod = this.sheet().abilities.find((a) => a.code === sk.abilityCode)?.modifier ?? 0;
    const profPart = sk.proficient ? `, Prof +${this.sheet().proficiencyBonus}` : '';
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'skill', itemId: `rule-skill-${sk.id}`, itemName: `${sk.label} (${sk.abilityCode})`,
      actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: sk.bonus,
      modifiersBreakdown: `${sk.abilityCode} ${this.formatMod(abMod)}${profPart}`,
    });
  }

  rollInitiativeOnly(): void {
    const s = this.sheet();
    this.interactive.executeSheetRollAndAction(s, {
      category: 'initiative', itemId: 'init-roll', itemName: 'Initiative Roll',
      actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: s.initiativeBonus,
      modifiersBreakdown: `DEX ${this.formatMod(s.initiativeBonus)}`,
    });
  }

  rollActionHitOnly(row: CharacterSheetActionRowVm): void {
    const base = this.primaryAbilityMod() + this.sheet().proficiencyBonus;
    const itemBonus = row.attackBonus - base;
    const itemPart = itemBonus > 0 ? `, Gear +${itemBonus}` : '';
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: row.filterCategory === 'ATTACK' ? 'attack' : 'feature',
      itemId: row.id, itemName: `${row.name} · Attack Roll`,
      actionSlotCost: row.actionSlotCost, diceSides: 20, diceCount: 1, modifier: row.attackBonus,
      modifiersBreakdown: `${this.primaryAbilityCode()} ${this.formatMod(this.primaryAbilityMod())}, Prof +${this.sheet().proficiencyBonus}${itemPart}`,
      spellSlotLevel: row.spellSlotLevel, limitedUseId: row.limitedUseId, maxLimitedUses: row.limitedUseMax,
    });
  }

  rollActionDamageOnly(row: CharacterSheetActionRowVm): void {
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'damage', itemId: `${row.id}-dmg`, itemName: `${row.name} · ${row.damageType} Damage`,
      actionSlotCost: 'none', diceSides: row.damageDiceSides, diceCount: row.damageDiceCount,
      modifier: row.damageBonus, damageType: row.damageType,
      modifiersBreakdown: row.damageBonus !== 0 ? `${this.primaryAbilityCode()} ${this.formatMod(row.damageBonus)}` : 'Weapon / Spell Dice',
    });
  }

  rollSpellCastOnly(sp: CharacterSpellVm, slotMax = 4): void {
    const isCantrip = (sp.level ?? 0) === 0;
    const costStr = (sp.actionCost ?? '1 Action').toLowerCase();
    const cost: 'action' | 'bonus' | 'reaction' = costStr.includes('bonus') ? 'bonus' : costStr.includes('reaction') ? 'reaction' : 'action';
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: 'spell-attack', itemId: sp.id, itemName: `${sp.name} · Spell Cast`, actionSlotCost: cost,
      diceSides: 20, diceCount: 1, modifier: this.spellAttackBonus(),
      modifiersBreakdown: `${this.primaryAbilityCode()} ${this.formatMod(this.primaryAbilityMod())}, Prof +${this.sheet().proficiencyBonus}`,
      damageDiceCount: isCantrip ? 2 : (sp.level ?? 1) + 1, damageDiceSides: 8, damageBonus: 0,
      damageType: `${sp.school} Force`, spellSlotLevel: isCantrip ? undefined : (sp.level ?? 1), maxSpellSlots: slotMax,
    });
  }

  /* 2. INSPECT HANDLERS (Clicking any Card / Row / Section opens Right Drawer!) */
  inspectAbility(ab: AbilityScoreVm): void {
    this.interactive.inspectRuleInDrawer(buildAbilityRuleVm(ab, this.sheet()));
  }

  inspectSave(sv: SavingThrowVm): void {
    this.interactive.inspectRuleInDrawer(buildSaveRuleVm(sv, this.sheet()));
  }

  inspectSkill(sk: CharacterSkillVm): void {
    this.interactive.inspectRuleInDrawer(buildSkillRuleVm(sk, this.sheet()));
  }

  inspectContextRule(
    kind: 'proficiency' | 'speed' | 'inspiration' | 'hp' | 'sense' | 'training' | 'defense' | 'condition',
    title: string,
    detail: string,
  ): void {
    this.interactive.inspectRuleInDrawer(buildCharacterContextRuleVm(kind, title, detail, this.sheet()));
  }

  inspectInitiative(): void {
    const s = this.sheet();
    this.interactive.inspectRuleInDrawer({
      id: 'rule-initiative', categoryLabel: `${s.name} · Combat Initiative`,
      title: `Initiative (${this.formatMod(s.initiativeBonus)})`,
      subtitle: `DEX Modifier (${this.formatMod(s.initiativeBonus)}) · Level ${s.level} ${s.classOrArchetype}`,
      castingOrActionTime: 'Start of Encounter', rangeOrArea: 'Self', componentsOrSlot: `1d20 ${this.formatMod(s.initiativeBonus)}`,
      durationLabel: 'Encounter Duration', sourceLabel: 'VTT Combat Engine', damageOrBonusBadge: `${this.formatMod(s.initiativeBonus)} Init`,
      standardRuleText: `${s.name}'s Initiative bonus is ${this.formatMod(s.initiativeBonus)} (derived from DEX score). Click the ${this.formatMod(s.initiativeBonus)} box to roll 1d20 ${this.formatMod(s.initiativeBonus)} directly.`,
      campaignAdjustedRuleTitle: 'Adjusted Campaign Rule (VTT Sync)',
      campaignAdjustedRuleText: `Rolling Initiative from ${s.name}'s sheet automatically updates turn order in the live VTT Initiative Tracker.`,
      tags: ['Initiative', s.name, `${this.formatMod(s.initiativeBonus)}`],
      rollConfig: { category: 'initiative', actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: s.initiativeBonus },
    });
  }

  inspectArmorClass(): void {
    const s = this.sheet();
    const dexMod = s.abilities.find((a) => a.code === 'DEX')?.modifier ?? 2;
    this.interactive.inspectRuleInDrawer({
      id: 'rule-ac', categoryLabel: `${s.name} · Defense & Ward`, title: `Armor Class (AC ${s.armorClass})`,
      subtitle: `${s.name} · Equipped Armor + DEX (${this.formatMod(dexMod)})`,
      castingOrActionTime: 'Passive Defense', rangeOrArea: 'Self', componentsOrSlot: `AC ${s.armorClass}`,
      durationLabel: 'Continuous', sourceLabel: 'Action Studio', damageOrBonusBadge: `AC ${s.armorClass}`,
      standardRuleText: `Enemy attack rolls against ${s.name} must meet or exceed AC ${s.armorClass} to land a strike. Equipped armor and wards contribute to this total.`,
      campaignAdjustedRuleTitle: 'Adjusted Campaign Rule (Shield & Deflection)',
      campaignAdjustedRuleText: `Casting Shield (+5 AC -> AC ${s.armorClass + 5}) as a Reaction turns an incoming hit into an Interrupted Attack in campaign telemetry.`,
      tags: [`AC ${s.armorClass}`, s.name, 'Reaction Ready'],
    });
  }

  inspectActionRow(row: CharacterSheetActionRowVm): void {
    this.interactive.inspectRuleInDrawer(buildActionRowRuleVm(row));
  }

  inspectCombatAction(ca: (typeof STANDARD_COMBAT_ACTIONS)[number]): void {
    this.interactive.inspectRuleInDrawer(buildCombatActionRuleVm(ca, this.primaryAbilityMod()));
  }

  inspectSpellRow(sp: CharacterSpellVm): void {
    this.interactive.inspectRuleInDrawer(buildSpellRuleVm(sp, this.spellAttackBonus(), this.spellSaveDc()));
  }

  inspectFeatureOrItem(item: CharacterFeatureCardVm | EquipmentLoadoutItemVm, kind: 'feature' | 'item'): void {
    this.interactive.inspectRuleInDrawer(buildFeatureOrItemRuleVm(item, kind, this.primaryAbilityMod()));
  }

  executeInspectedRuleRoll(rule: CampaignAdjustedRuleVm): void {
    if (!rule.rollConfig) return;
    this.interactive.executeSheetRollAndAction(this.sheet(), {
      category: rule.rollConfig.category, itemId: rule.id, itemName: rule.title,
      actionSlotCost: rule.rollConfig.actionSlotCost, diceSides: rule.rollConfig.diceSides,
      diceCount: rule.rollConfig.diceCount, modifier: rule.rollConfig.modifier,
      damageDiceCount: rule.rollConfig.damageDiceCount, damageDiceSides: rule.rollConfig.damageDiceSides,
      damageBonus: rule.rollConfig.damageBonus, damageType: rule.rollConfig.damageType,
      spellSlotLevel: rule.rollConfig.spellSlotLevel, limitedUseId: rule.rollConfig.limitedUseId,
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
