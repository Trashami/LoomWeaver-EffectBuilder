import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgpButton } from 'ng-primitives/button';
import { NgpProgress, NgpProgressIndicator, NgpProgressTrack } from 'ng-primitives/progress';
import { NgpTabButton, NgpTabList, NgpTabset } from 'ng-primitives/tabs';
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
  CharacterMetEntityVm,
  CharacterRichNoteVm,
  CharacterSheetTab,
  CharacterSheetVm,
  CharacterSpellVm,
  EquipmentLoadoutItemVm,
  LwNoteMentionTagVm,
} from '../../../features/characters/models/character-studio.models';
import { LwButtonComponent } from '../button/button.component';
import { LwCharacterPortraitPickerComponent } from '../character-portrait-picker/character-portrait-picker.component';
import { LwIconComponent } from '../icon/icon.component';
import { LwNoteComposerModalComponent } from '../note-composer-modal/note-composer-modal.component';

@Component({
  selector: 'lw-character-sheet-view',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgpButton,
    NgpTabset,
    NgpTabList,
    NgpTabButton,
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

  readonly editingAbilities = signal<boolean>(false);
  readonly newNoteText = signal<string>('');
  readonly noteComposerOpen = signal<boolean>(false);
  readonly levelUpAbilityCode = signal<AbilityScoreVm['code']>('INT');
  readonly levelUpPerkName = signal<string>('Anelith Resonance Mastery');

  readonly equipmentSearch = signal<string>('');
  readonly spellSearch = signal<string>('');
  readonly pendingSpellPrep = signal<{
    spell: CharacterSpellVm;
    makingPrepared: boolean;
    rule: ReturnType<typeof getSpellPreparationRuleExplanation>;
  } | null>(null);

  readonly inspectedMetEntity = signal<CharacterMetEntityVm | null>(null);
  readonly metFilter = signal<'All' | 'NPC' | 'Place'>('All');
  readonly historyFilter = signal<'All' | 'Session' | 'Encounter' | 'Quest' | 'Milestone'>('All');

  readonly levelUpPerkChoices: readonly string[] = [
    'Anelith Resonance Mastery',
    'Cinth Artificer Overclock',
    'Shadow of the Mountain Ward',
    'Warcaster Concentration Mastery',
  ];

  readonly tabs: readonly { id: CharacterSheetTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'skills', label: 'Skills' },
    { id: 'feats', label: 'Feats & Features' },
    { id: 'spells', label: 'Spells' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'background', label: 'Background' },
    { id: 'notes', label: 'Notes' },
    { id: 'connections', label: 'Places & NPCs Met' },
    { id: 'history', label: 'History' },
  ];

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

  readonly spellSaveDc = computed<number>(
    () => 8 + this.sheet().proficiencyBonus + this.primaryAbilityMod(),
  );

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
      .slice(0, 18);
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
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.slot.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q),
      )
      .slice(0, 20);
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

  readonly proficientSkillsCount = computed<number>(
    () => this.sheet().skills.filter((sk) => sk.proficient).length,
  );

  readonly carryingCapacityLbs = computed<number>(() => {
    const str = this.sheet().abilities.find((a) => a.code === 'STR')?.score ?? 10;
    return str * 15;
  });

  readonly classFeatures = computed(() =>
    this.sheet().featureCards.filter((f) => f.category === 'class'),
  );

  readonly featFeatures = computed(() =>
    this.sheet().featureCards.filter((f) => f.category !== 'class'),
  );

  formatMod(mod: number, bracketed = false): string {
    const signed = mod >= 0 ? `+${mod}` : `${mod}`;
    return bracketed ? `[${signed}]` : signed;
  }

  saveForAbility(code: AbilityScoreVm['code']) {
    return this.sheet().savingThrows.find((sv) => sv.code === code);
  }

  toggleEquipmentItem(item: EquipmentLoadoutItemVm): void {
    this.equipmentToggled.emit(item.id);
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

  triggerLevelUp(): void {
    this.levelUpRequested.emit({
      featureName: this.levelUpPerkName(),
      abilityCode: this.levelUpAbilityCode(),
    });
  }

  onRichNoteSaved(note: CharacterRichNoteVm): void {
    this.richNoteAdded.emit(note);
  }
}
