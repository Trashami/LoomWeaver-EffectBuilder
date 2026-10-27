export type CharacterStudioViewMode = 'roster' | 'creator' | 'viewer';

export type CharacterSheetTab =
  | 'overview'
  | 'abilities'
  | 'skills'
  | 'feats'
  | 'spells'
  | 'equipment'
  | 'inventory'
  | 'background'
  | 'notes'
  | 'connections'
  | 'history';

export type LwNoteCategory =
  | 'character'
  | 'session'
  | 'npc'
  | 'location'
  | 'quest'
  | 'lore'
  | 'combat';

export type LwNoteVisibility = 'private' | 'dm-only' | 'global';

export interface LwNoteMentionTagVm {
  readonly compositeKey: string;
  readonly name: string;
  readonly entityType: string;
  readonly routeLink: string;
}

export interface CharacterRichNoteVm {
  readonly id: string;
  readonly title: string;
  readonly noteType: LwNoteCategory;
  readonly visibility: LwNoteVisibility;
  readonly authorUsername: string;
  readonly createdAtLabel: string;
  readonly contentHtml: string;
  readonly contentText: string;
  readonly sourceEntityKey: string;
  readonly sourceEntityName: string;
  readonly mentionedEntities: readonly LwNoteMentionTagVm[];
}

export interface CharacterMetEntityVm {
  readonly id: string;
  readonly compositeKey: string;
  readonly name: string;
  readonly entityType: 'NPC' | 'Place';
  readonly roleOrRegion: string;
  readonly dispositionOrStatus: string;
  readonly sessionMet: string;
  readonly summary: string;
  readonly details: string;
  readonly playerNotesOrClues: string;
  readonly routeLink: string;
  readonly connectedNames: readonly string[];
}

export interface CharacterCampaignHistoryEventVm {
  readonly id: string;
  readonly category: 'Session' | 'Encounter' | 'Quest' | 'Milestone';
  readonly title: string;
  readonly sessionLabel: string;
  readonly locationName: string;
  readonly summary: string;
  readonly outcomeOrReward: string;
  readonly routeLink: string;
  readonly compositeKey: string;
}

export interface AbilityScoreVm {
  readonly code: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  readonly label: string;
  readonly score: number;
  readonly modifier: number;
}

export interface SavingThrowVm {
  readonly code: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  readonly label: string;
  readonly bonus: number;
  readonly proficient: boolean;
}

export interface CharacterSkillVm {
  readonly id: string;
  readonly label: string;
  readonly abilityCode: AbilityScoreVm['code'];
  readonly bonus: number;
  readonly proficient: boolean;
  readonly expertise?: boolean;
}

export interface CharacterSpellVm {
  readonly id: string;
  readonly name: string;
  readonly school: string;
  readonly icon: string;
  readonly tone: 'emerald' | 'gold' | 'crimson' | 'neutral';
  readonly actionCost: string;
  readonly summary: string;
  readonly level?: number;
  readonly prepared?: boolean;
  readonly range?: string;
  readonly duration?: string;
  readonly concentration?: boolean;
  readonly ritual?: boolean;
}

export interface CharacterSpellGroupVm {
  readonly groupId: string;
  readonly label: string;
  readonly slotsRemaining: number;
  readonly slotsMax: number;
  readonly isCantrip?: boolean;
  readonly spells: readonly CharacterSpellVm[];
}

export interface EquipmentLoadoutItemVm {
  readonly id: string;
  readonly name: string;
  readonly slot: 'Armor' | 'Main Hand' | 'Off Hand' | 'Focus' | 'Companion' | 'Gear';
  readonly summary: string;
  readonly bonusLabel: string;
  readonly acBonus: number;
  readonly attackBonus: number;
  readonly equipped: boolean;
  readonly entitlement: 'free' | 'included' | 'purchased' | 'locked';
  readonly icon?: string;
  readonly weightLb?: number;
  readonly valueGp?: number;
  readonly rarity?: string;
  readonly source?: string;
}

export interface CharacterFeatureCardVm {
  readonly id: string;
  readonly title: string;
  readonly category: 'class' | 'feat' | 'ancestry';
  readonly summary: string;
  readonly icon: string;
  readonly tone: 'emerald' | 'gold' | 'crimson' | 'neutral';
}

export interface CharacterPersonalityVm {
  readonly personality: string;
  readonly ideals: string;
  readonly bonds: string;
  readonly flaws: string;
}

export interface CharacterConnectionChipVm {
  readonly id: string;
  readonly label: string;
  readonly routeLink: string;
  readonly compositeKey: string;
}

export interface CharacterConnectionsVm {
  readonly locations: readonly CharacterConnectionChipVm[];
  readonly npcs: readonly CharacterConnectionChipVm[];
  readonly factions: readonly CharacterConnectionChipVm[];
}

export interface CharacterSheetVm {
  readonly compositeKey: string;
  readonly characterKey: string;
  readonly ownerAccountId: string;
  readonly ownerUsername?: string;
  readonly campaignId: number;
  readonly name: string;
  readonly roleBadge: string;
  readonly portraitUrl: string;
  readonly pronouns: string;
  readonly alignment: string;
  readonly quote: string;
  readonly ancestryOrClan: string;
  readonly subrace: string;
  readonly classOrArchetype: string;
  readonly subclass: string;
  readonly backgroundName: string;
  readonly backgroundSummary: string;
  readonly tags: readonly string[];
  readonly systemCode: 'dnd5e' | 'pf2e' | 'vampire_v5';
  readonly level: number;
  readonly currentXp: number;
  readonly nextLevelXp: number;
  readonly levelUpEligible: boolean;
  readonly maxHp: number;
  readonly currentHp: number;
  readonly armorClass: number;
  readonly initiativeBonus: number;
  readonly speedFeet: number;
  readonly proficiencyBonus: number;
  readonly primaryAttackBonus: number;
  readonly actionEconomySummary: string;
  readonly abilities: readonly AbilityScoreVm[];
  readonly savingThrows: readonly SavingThrowVm[];
  readonly skills: readonly CharacterSkillVm[];
  readonly spellGroups: readonly CharacterSpellGroupVm[];
  readonly equipment: readonly EquipmentLoadoutItemVm[];
  readonly featureCards: readonly CharacterFeatureCardVm[];
  readonly features: readonly string[];
  readonly personality: CharacterPersonalityVm;
  readonly connections: CharacterConnectionsVm;
  readonly notes: readonly string[];
  readonly richNotes?: readonly CharacterRichNoteVm[];
  readonly metEntities?: readonly CharacterMetEntityVm[];
  readonly campaignHistory?: readonly CharacterCampaignHistoryEventVm[];
  readonly historyEvents: readonly string[];
}

export interface CreatorTraitVm {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

export interface CreatorSubraceOptionVm {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly portraitUrl: string;
  readonly source: 'PHB' | 'SRD 5.1' | 'Homebrew';
}

export interface CreatorAncestryOptionVm {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly source: 'PHB' | 'SRD 5.1' | 'Homebrew';
  readonly portraitUrl: string;
  readonly galleryPortraits: readonly string[];
  readonly speedFeet?: number;
  readonly abilityBonuses?: Readonly<Partial<Record<AbilityScoreVm['code'], number>>>;
  readonly traits: readonly CreatorTraitVm[];
  readonly subraces: readonly CreatorSubraceOptionVm[];
}

export interface CreatorClassOptionVm {
  readonly id: string;
  readonly name: string;
  readonly subclassDefault: string;
  readonly subclasses?: readonly string[];
  readonly tagline: string;
  readonly hitDie: number;
  readonly primaryAbility: AbilityScoreVm['code'];
  readonly savingThrows: readonly [AbilityScoreVm['code'], AbilityScoreVm['code']];
  readonly features: readonly CharacterFeatureCardVm[];
  readonly startingSpells: readonly CharacterSpellGroupVm[];
}

export interface CreatorBackgroundOptionVm {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly summary: string;
  readonly source?: string;
  readonly recommendedClasses?: readonly string[];
  readonly recommendedAncestries?: readonly string[];
  readonly skillProficiencies: readonly string[];
  readonly toolProficiencies?: readonly string[];
  readonly featureName?: string;
  readonly defaultQuote: string;
  readonly personality: CharacterPersonalityVm;
}

export interface CreatorFeatOptionVm {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly source: string;
  readonly prerequisite: string;
  readonly abilityBonus: string;
  readonly summary: string;
}

export interface CharacterCreatorDraftVm {
  readonly name: string;
  readonly pronouns: string;
  readonly alignment: string;
  readonly quote: string;
  readonly portraitUrl: string;
  readonly level?: number;
  readonly ancestryId: string;
  readonly subraceId: string;
  readonly classId: string;
  readonly subclass: string;
  readonly backgroundId: string;
  readonly selectedSkills: readonly string[];
  readonly selectedFeatId: string;
  readonly startingPack: string;
  readonly equipmentItems?: readonly EquipmentLoadoutItemVm[];
  readonly equippedItemIds?: readonly string[];
  readonly backpackItemIds?: readonly string[];
  readonly personalityTrait?: string;
  readonly ideal?: string;
  readonly bond?: string;
  readonly flaw?: string;
  readonly abilities: Readonly<Record<AbilityScoreVm['code'], number>>;
}
