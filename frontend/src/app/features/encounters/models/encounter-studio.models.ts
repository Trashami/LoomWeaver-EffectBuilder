import { EncounterCardVm } from '../../../shared/ui/encounter-card/encounter-card.component';

export type EncounterCategoryType = 'Combat' | 'Social' | 'Exploration' | 'Mixed' | 'Boss';
export type EncounterLifecycleStatus = 'Upcoming' | 'Ready' | 'Completed';
export type TokenAssetDimensionKind = '2d' | '3d';
export type EncounterFilterTabId =
  | 'all'
  | 'upcoming'
  | 'past'
  | 'by-location'
  | 'by-creature'
  | 'custom';

export type EncounterDetailTabId =
  | 'overview'
  | 'creatures'
  | 'party-npcs'
  | 'traps'
  | 'map'
  | 'read-aloud'
  | 'rewards'
  | 'links'
  | 'notes';

export interface CampaignSessionVm {
  readonly id: string;
  readonly campaignId: number;
  readonly sessionNumber: number;
  readonly title: string;
  readonly actLabel: string;
  readonly locationName: string;
  readonly status: 'completed' | 'live' | 'upcoming';
  readonly dateLabel: string;
  readonly summary: string;
}

export interface MonsterTokenAssetVm {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly kind: TokenAssetDimensionKind;
  readonly previewUrl: string;
  readonly glbUrl?: string;
  readonly sizeLabel: 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
}

export interface EncounterObjectiveVm {
  readonly id: string;
  readonly text: string;
  readonly completed: boolean;
}

export interface EncounterMonsterSlotVm {
  readonly slotId: string;
  readonly creatureId: string;
  readonly name: string;
  readonly creatureType: string;
  readonly challengeRating: string;
  readonly xpValue: number;
  readonly count: number;
  readonly armorClass: number;
  readonly maxHp: number;
  readonly speedFeet: number;
  readonly attackBonus: number;
  readonly saveDc: number;
  readonly signatureAttack: string;
  readonly damageFormula: string;
  readonly roleSummary: string;
  readonly disposition: 'Hostile' | 'Guard' | 'Boss' | 'Minion';
  readonly tokenAssetId: string;
  readonly tokenName: string;
  readonly tokenKind: TokenAssetDimensionKind;
  readonly tokenPreviewUrl: string;
  readonly tokenGlbUrl?: string;
}

export interface EncounterPartyMemberSlotVm {
  readonly compositeKey: string;
  readonly name: string;
  readonly classSummary: string;
  readonly level: number;
  readonly armorClass: number;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly avatarUrl: string;
  readonly includedInEncounter: boolean;
}

export interface EncounterSessionNpcSlotVm {
  readonly compositeKey: string;
  readonly name: string;
  readonly role: string;
  readonly disposition: 'Allied' | 'Neutral' | 'Deceptive' | 'Hostile';
  readonly sessionId: string;
  readonly locationName: string;
  readonly avatarUrl: string;
  readonly summary: string;
  readonly gmSecret?: string;
  readonly includedInEncounter: boolean;
}

export interface EncounterTrapVm {
  readonly id: string;
  readonly name: string;
  readonly category: 'Mechanical Trap' | 'Arcane Ward' | 'Environmental Hazard' | 'Cursed Relic';
  readonly trigger: string;
  readonly perceptionDc: number;
  readonly disarmDc: number;
  readonly saveOrAttack: string;
  readonly damageFormula: string;
  readonly effectSummary: string;
  readonly armed: boolean;
}

export interface EncounterRewardItemVm {
  readonly id: string;
  readonly label: string;
  readonly kind: 'XP' | 'Gold & Coin' | 'Relic / Item' | 'Story Grant';
  readonly xpValue: number;
  readonly awarded: boolean;
}

export interface EncounterRelatedLinkVm {
  readonly compositeKey: string;
  readonly title: string;
  readonly roleLabel: string;
  readonly routeLink: string;
  readonly artworkUrl: string;
}

export interface EncounterDetailVm extends EncounterCardVm {
  readonly campaignId: number;
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly encounterType: EncounterCategoryType;
  readonly status: EncounterLifecycleStatus;
  readonly environment: string;
  readonly partyLevel: number;
  readonly estimatedDuration: string;
  readonly thumbnailUrl: string;
  readonly artworkUrl?: string;
  readonly isCustom?: boolean;
  readonly description: string;
  readonly readAloudText: string;
  readonly objectives: readonly EncounterObjectiveVm[];
  readonly monsters: readonly EncounterMonsterSlotVm[];
  readonly partyMembers: readonly EncounterPartyMemberSlotVm[];
  readonly sessionNpcs: readonly EncounterSessionNpcSlotVm[];
  readonly traps: readonly EncounterTrapVm[];
  readonly rewards: readonly EncounterRewardItemVm[];
  readonly relatedLinks: readonly EncounterRelatedLinkVm[];
  readonly sessionNotes: string;
}

export interface VttActiveConditionVm {
  readonly id: string;
  readonly name: string;
  readonly targetLabel: string;
  readonly durationLabel: string;
  readonly effectSummary: string;
  readonly concentration: boolean;
  readonly tone: 'emerald' | 'gold' | 'crimson' | 'neutral';
}
