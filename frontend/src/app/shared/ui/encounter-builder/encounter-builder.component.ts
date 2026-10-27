import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgpButton } from 'ng-primitives/button';
import { NgpTabButton, NgpTabList, NgpTabset } from 'ng-primitives/tabs';
import { SceneVm } from '../../../core/models/loomweaver.models';
import {
  CampaignSessionVm, EncounterCategoryType, EncounterDetailVm, EncounterLifecycleStatus,
  EncounterMonsterSlotVm, EncounterObjectiveVm, EncounterPartyMemberSlotVm,
  EncounterRewardItemVm, EncounterSessionNpcSlotVm, EncounterTrapVm, MonsterTokenAssetVm,
} from '../../../features/encounters/models/encounter-studio.models';
import { LwBadgeComponent } from '../badge/badge.component';
import { LwButtonComponent } from '../button/button.component';
import { CreatureCardVm } from '../creature-card/creature-card.component';
import { LwIconComponent } from '../icon/icon.component';

export type BuilderStepTab = 'general' | 'map' | 'monsters' | 'participants' | 'traps' | 'narrative';

@Component({
  selector: 'lw-encounter-builder',
  standalone: true,
  imports: [FormsModule, RouterLink, NgpButton, NgpTabset, NgpTabList, NgpTabButton, LwBadgeComponent, LwButtonComponent, LwIconComponent],
  templateUrl: './encounter-builder.component.html',
  styleUrl: './encounter-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LwEncounterBuilderComponent implements OnInit {
  readonly campaignId = input.required<number>();
  readonly campaignName = input.required<string>();
  readonly initialEncounter = input<EncounterDetailVm | null>(null);
  readonly isCreateMode = input<boolean>(false);
  readonly sessions = input.required<readonly CampaignSessionVm[]>();
  readonly availableScenes = input.required<readonly SceneVm[]>();
  readonly bestiaryCreatures = input.required<readonly CreatureCardVm[]>();
  readonly tokenAssets = input.required<readonly MonsterTokenAssetVm[]>();
  readonly defaultParty = input.required<readonly EncounterPartyMemberSlotVm[]>();
  readonly defaultSessionNpcs = input.required<readonly EncounterSessionNpcSlotVm[]>();

  readonly cancelled = output<void>();
  readonly saved = output<EncounterDetailVm>();
  readonly savedAndLaunch = output<EncounterDetailVm>();
  readonly sessionCreated = output<CampaignSessionVm>();

  readonly activeStep = signal<BuilderStepTab>('general');
  readonly stepTabs: readonly { id: BuilderStepTab; label: string }[] = [
    { id: 'general', label: '1. Session & Details' },
    { id: 'map', label: '2. Select Map' },
    { id: 'monsters', label: '3. Monsters & 2D/3D Tokens' },
    { id: 'participants', label: '4. Players & Session NPCs' },
    { id: 'traps', label: '5. Traps & Hazards' },
    { id: 'narrative', label: '6. Read-Aloud, Rewards & Notes' },
  ];

  readonly draftId = signal<string>('');
  readonly name = signal<string>('');
  readonly sessionId = signal<string>('session-14');
  readonly actLabel = signal<string>('Act II');
  readonly encounterType = signal<EncounterCategoryType>('Combat');
  readonly status = signal<EncounterLifecycleStatus>('Ready');
  readonly difficulty = signal<'Moderate' | 'Hard' | 'Deadly' | 'Mythic'>('Hard');
  readonly partyLevel = signal<number>(7);
  readonly estimatedDuration = signal<string>('45–60 minutes');
  readonly environment = signal<string>('Ruined Chapel (Indoors)');
  readonly sceneKey = signal<string>('scene-cinth-gala');
  readonly description = signal<string>('');
  readonly readAloudText = signal<string>('');
  readonly sessionNotes = signal<string>('');

  readonly objectives = signal<readonly EncounterObjectiveVm[]>([]);
  readonly newObjectiveText = signal<string>('');

  readonly monsters = signal<readonly EncounterMonsterSlotVm[]>([]);
  readonly activeTokenPickerSlotId = signal<string | null>(null);
  readonly tokenDimensionFilter = signal<'all' | '3d' | '2d'>('all');
  readonly tokenSearchQuery = signal<string>('');

  readonly customMonsterName = signal<string>('');
  readonly customMonsterCr = signal<string>('2');
  readonly customMonsterAc = signal<number>(15);
  readonly customMonsterHp = signal<number>(45);
  readonly customMonsterAttack = signal<string>('Arcane Strike (2d8 + 3)');

  readonly partyMembers = signal<readonly EncounterPartyMemberSlotVm[]>([]);
  readonly sessionNpcs = signal<readonly EncounterSessionNpcSlotVm[]>([]);
  readonly showAllCampaignNpcs = signal<boolean>(false);
  readonly newNpcName = signal<string>('');
  readonly newNpcRole = signal<string>('Session Informant · Scout');
  readonly newNpcDisposition = signal<'Allied' | 'Neutral' | 'Deceptive' | 'Hostile'>('Allied');
  readonly newNpcSummary = signal<string>('');

  readonly traps = signal<readonly EncounterTrapVm[]>([]);
  readonly newTrapName = signal<string>('');
  readonly newTrapCategory = signal<EncounterTrapVm['category']>('Mechanical Trap');
  readonly newTrapTrigger = signal<string>('Stepping on pressure plate in the central corridor');
  readonly newTrapPerceptionDc = signal<number>(14);
  readonly newTrapDisarmDc = signal<number>(15);
  readonly newTrapSave = signal<string>('DC 15 DEX Save');
  readonly newTrapDamage = signal<string>('3d8 Piercing');
  readonly newTrapEffect = signal<string>('Half damage on successful save; speed reduced by 10 ft on failure.');

  readonly rewards = signal<readonly EncounterRewardItemVm[]>([]);
  readonly newRewardLabel = signal<string>('');
  readonly newRewardKind = signal<EncounterRewardItemVm['kind']>('Relic / Item');
  readonly newRewardXp = signal<number>(500);

  readonly showNewSessionInline = signal<boolean>(false);
  readonly newSessionNumber = signal<number>(16);
  readonly newSessionTitle = signal<string>('');
  readonly newSessionAct = signal<string>('Act III');

  readonly selectedSession = computed(() => {
    const sid = this.sessionId();
    return this.sessions().find((s) => s.id === sid) ?? this.sessions()[0];
  });

  readonly selectedScene = computed(() => {
    const key = this.sceneKey();
    return this.availableScenes().find((s) => s.sceneKey === key) ?? this.availableScenes()[0];
  });

  readonly filteredTokenAssets = computed(() => {
    const dim = this.tokenDimensionFilter();
    const q = this.tokenSearchQuery().trim().toLowerCase();
    return this.tokenAssets().filter(
      (t) =>
        (dim === 'all' || t.kind === dim) &&
        (!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
    );
  });

  readonly visibleSessionNpcs = computed(() => {
    const showAll = this.showAllCampaignNpcs();
    const sid = this.sessionId();
    const all = this.sessionNpcs();
    if (showAll) return all;
    const matched = all.filter((n) => n.sessionId === sid || n.includedInEncounter);
    return matched.length > 0 ? matched : all;
  });

  readonly computedTotalXp = computed(() => {
    const monsterXp = this.monsters().reduce((sum, m) => sum + m.xpValue * m.count, 0);
    const rewardXp = this.rewards().reduce((sum, r) => sum + (r.kind === 'XP' ? 0 : r.xpValue), 0);
    return Math.max(400, monsterXp + rewardXp);
  });

  readonly computedEnemyCount = computed(() =>
    this.monsters().reduce((sum, m) => sum + m.count, 0),
  );

  ngOnInit(): void {
    const init = this.initialEncounter();
    if (init && !this.isCreateMode()) {
      this.draftId.set(init.id);
      this.name.set(init.name);
      this.sessionId.set(init.sessionId);
      this.actLabel.set(init.actLabel);
      this.encounterType.set(init.encounterType);
      this.status.set(init.status);
      this.difficulty.set(init.difficulty);
      this.partyLevel.set(init.partyLevel);
      this.estimatedDuration.set(init.estimatedDuration);
      this.environment.set(init.environment);
      this.sceneKey.set(init.sceneKey);
      this.description.set(init.description);
      this.readAloudText.set(init.readAloudText);
      this.sessionNotes.set(init.sessionNotes);
      this.objectives.set([...init.objectives]);
      this.monsters.set([...init.monsters]);
      this.partyMembers.set(
        init.partyMembers.length > 0 ? [...init.partyMembers] : [...this.defaultParty()],
      );
      const mergedNpcs = this.mergeSessionNpcs(init.sessionNpcs);
      this.sessionNpcs.set(mergedNpcs);
      this.traps.set([...init.traps]);
      this.rewards.set([...init.rewards]);
    } else {
      const firstSes = this.sessions()[0];
      const firstScene = this.availableScenes()[0];
      this.draftId.set(`enc-custom-${Date.now().toString().slice(-5)}`);
      this.name.set('New Tactical Encounter');
      this.sessionId.set(firstSes?.id ?? 'session-14');
      this.actLabel.set(firstSes?.actLabel ?? 'Act II');
      this.encounterType.set('Combat');
      this.status.set('Ready');
      this.difficulty.set('Hard');
      this.partyLevel.set(7);
      this.estimatedDuration.set('45–60 minutes');
      this.environment.set(firstScene?.biome ?? 'Dungeon Sanctum (Indoors)');
      this.sceneKey.set(firstScene?.sceneKey ?? 'scene-cinth-gala');
      this.description.set(
        'Author the tactical context, terrain advantages, and story stakes for this session encounter.',
      );
      this.readAloudText.set(
        '“Torchlight glints across carved stone as hostile silhouettes step into the chamber.”',
      );
      this.sessionNotes.set('');
      this.objectives.set([
        { id: `obj-${Date.now()}-1`, text: 'Defeat or outmaneuver the opposing force', completed: false },
        { id: `obj-${Date.now()}-2`, text: 'Secure the scene clue before reinforcements arrive', completed: false },
      ]);
      this.monsters.set([]);
      this.partyMembers.set([...this.defaultParty()]);
      this.sessionNpcs.set(
        this.defaultSessionNpcs().map((n) => ({
          ...n,
          includedInEncounter: n.sessionId === (firstSes?.id ?? 'session-14'),
        })),
      );
      this.traps.set([]);
      this.rewards.set([
        { id: `rew-${Date.now()}`, label: 'Encounter Victory XP Pool', kind: 'XP', xpValue: 2400, awarded: false },
      ]);
    }
  }

  private mergeSessionNpcs(existing: readonly EncounterSessionNpcSlotVm[]): EncounterSessionNpcSlotVm[] {
    const map = new Map<string, EncounterSessionNpcSlotVm>();
    for (const def of this.defaultSessionNpcs()) {
      map.set(def.compositeKey, { ...def, includedInEncounter: false });
    }
    for (const item of existing) {
      map.set(item.compositeKey, { ...item, includedInEncounter: true });
    }
    return Array.from(map.values());
  }

  createInlineSession(): void {
    const title = this.newSessionTitle().trim();
    if (!title) return;
    const num = this.newSessionNumber();
    const created: CampaignSessionVm = {
      id: `session-${Date.now().toString().slice(-4)}`,
      campaignId: this.campaignId(),
      sessionNumber: num,
      title: `Session ${num} — ${title}`,
      actLabel: this.newSessionAct(),
      locationName: this.selectedScene()?.name ?? 'Campaign Frontier',
      status: 'upcoming',
      dateLabel: 'Planned',
      summary: `Created in Encounter Builder for ${this.campaignName()}.`,
    };
    this.sessionCreated.emit(created);
    this.sessionId.set(created.id);
    this.actLabel.set(created.actLabel);
    this.newSessionTitle.set('');
    this.showNewSessionInline.set(false);
  }

  addObjective(): void {
    const text = this.newObjectiveText().trim();
    if (!text) return;
    this.objectives.update((list) => [
      ...list,
      { id: `obj-${Date.now()}`, text, completed: false },
    ]);
    this.newObjectiveText.set('');
  }

  removeObjective(id: string): void {
    this.objectives.update((list) => list.filter((o) => o.id !== id));
  }

  addCreatureFromBestiary(creature: CreatureCardVm): void {
    const defaultToken =
      this.tokenAssets().find((t) =>
        creature.name.toLowerCase().includes(t.name.split(' ')[0].toLowerCase()),
      ) ?? this.tokenAssets()[0];

    const existing = this.monsters().find((m) => m.creatureId === creature.id);
    if (existing) {
      this.adjustMonsterCount(existing.slotId, 1);
      return;
    }

    const slot: EncounterMonsterSlotVm = {
      slotId: `slot-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      creatureId: creature.id,
      name: creature.name,
      creatureType: creature.creatureType,
      challengeRating: creature.challengeRating,
      xpValue: creature.xpValue,
      count: 1,
      armorClass: creature.armorClass,
      maxHp: creature.maxHp,
      speedFeet: creature.speedFeet,
      attackBonus: creature.attackBonus,
      saveDc: creature.saveDc,
      signatureAttack: creature.signatureAttack,
      damageFormula: creature.damageFormula,
      roleSummary: creature.summary,
      disposition: 'Hostile',
      tokenAssetId: defaultToken.id,
      tokenName: defaultToken.name,
      tokenKind: defaultToken.kind,
      tokenPreviewUrl: defaultToken.previewUrl,
      tokenGlbUrl: defaultToken.glbUrl,
    };
    this.monsters.update((list) => [...list, slot]);
    this.activeTokenPickerSlotId.set(slot.slotId);
  }

  addCustomMonster(): void {
    const name = this.customMonsterName().trim();
    if (!name) return;
    const tok = this.tokenAssets()[0];
    const slot: EncounterMonsterSlotVm = {
      slotId: `slot-cust-${Date.now()}`,
      creatureId: `creat-cust-${Date.now()}`,
      name,
      creatureType: 'Custom Adversary',
      challengeRating: this.customMonsterCr() || '2',
      xpValue: 650,
      count: 1,
      armorClass: this.customMonsterAc(),
      maxHp: this.customMonsterHp(),
      speedFeet: 30,
      attackBonus: 6,
      saveDc: 14,
      signatureAttack: this.customMonsterAttack(),
      damageFormula: '2d8 + 3',
      roleSummary: 'Custom encounter monster',
      disposition: 'Hostile',
      tokenAssetId: tok.id,
      tokenName: tok.name,
      tokenKind: tok.kind,
      tokenPreviewUrl: tok.previewUrl,
      tokenGlbUrl: tok.glbUrl,
    };
    this.monsters.update((list) => [...list, slot]);
    this.customMonsterName.set('');
    this.activeTokenPickerSlotId.set(slot.slotId);
  }

  adjustMonsterCount(slotId: string, delta: number): void {
    this.monsters.update((list) =>
      list
        .map((m) => (m.slotId === slotId ? { ...m, count: Math.max(0, m.count + delta) } : m))
        .filter((m) => m.count > 0),
    );
  }

  assignTokenToMonster(slotId: string, asset: MonsterTokenAssetVm): void {
    this.monsters.update((list) =>
      list.map((m) =>
        m.slotId === slotId
          ? {
              ...m,
              tokenAssetId: asset.id,
              tokenName: asset.name,
              tokenKind: asset.kind,
              tokenPreviewUrl: asset.previewUrl,
              tokenGlbUrl: asset.glbUrl,
            }
          : m,
      ),
    );
  }

  togglePartyMember(compositeKey: string): void {
    this.partyMembers.update((list) =>
      list.map((p) =>
        p.compositeKey === compositeKey
          ? { ...p, includedInEncounter: !p.includedInEncounter }
          : p,
      ),
    );
  }

  toggleSessionNpc(compositeKey: string): void {
    this.sessionNpcs.update((list) =>
      list.map((n) =>
        n.compositeKey === compositeKey
          ? { ...n, includedInEncounter: !n.includedInEncounter }
          : n,
      ),
    );
  }

  addNewSessionNpc(): void {
    const name = this.newNpcName().trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const created: EncounterSessionNpcSlotVm = {
      compositeKey: `${this.campaignId()}:NPC:npc-${slug}-${Date.now().toString().slice(-3)}`,
      name,
      role: this.newNpcRole().trim() || 'Session NPC',
      disposition: this.newNpcDisposition(),
      sessionId: this.sessionId(),
      locationName: this.selectedScene()?.name ?? 'Active Scene',
      avatarUrl: '/assets/5e-tools/classes/PHB/Bard.webp',
      summary: this.newNpcSummary().trim() || `Attached to ${this.selectedSession()?.title}.`,
      includedInEncounter: true,
    };
    this.sessionNpcs.update((list) => [created, ...list]);
    this.newNpcName.set('');
    this.newNpcSummary.set('');
  }

  addTrap(): void {
    const name = this.newTrapName().trim();
    if (!name) return;
    const trap: EncounterTrapVm = {
      id: `trap-${Date.now()}`,
      name,
      category: this.newTrapCategory(),
      trigger: this.newTrapTrigger(),
      perceptionDc: this.newTrapPerceptionDc(),
      disarmDc: this.newTrapDisarmDc(),
      saveOrAttack: this.newTrapSave(),
      damageFormula: this.newTrapDamage(),
      effectSummary: this.newTrapEffect(),
      armed: true,
    };
    this.traps.update((list) => [...list, trap]);
    this.newTrapName.set('');
  }

  removeTrap(id: string): void {
    this.traps.update((list) => list.filter((t) => t.id !== id));
  }

  addReward(): void {
    const label = this.newRewardLabel().trim();
    if (!label) return;
    this.rewards.update((list) => [
      ...list,
      {
        id: `rew-${Date.now()}`,
        label,
        kind: this.newRewardKind(),
        xpValue: this.newRewardXp(),
        awarded: false,
      },
    ]);
    this.newRewardLabel.set('');
  }

  removeReward(id: string): void {
    this.rewards.update((list) => list.filter((r) => r.id !== id));
  }

  private buildEncounterPayload(): EncounterDetailVm {
    const init = this.initialEncounter();
    const ses = this.selectedSession();
    const sc = this.selectedScene();
    const cleanName = this.name().trim() || 'Untitled Encounter';
    const id = this.draftId() || `enc-${Date.now()}`;
    return {
      id,
      compositeKey: init?.compositeKey ?? `${this.campaignId()}:Encounter:${id}`,
      campaignId: this.campaignId(),
      sessionId: ses?.id ?? this.sessionId(),
      sessionTitle: ses?.title ?? 'Session 14 — Campaign Play',
      name: cleanName,
      actLabel: this.actLabel().trim() || ses?.actLabel || 'Act I',
      encounterType: this.encounterType(),
      status: this.status(),
      completed: this.status() === 'Completed',
      sceneKey: sc?.sceneKey ?? this.sceneKey(),
      sceneName: sc?.name ?? 'Assigned Battlemap',
      environment: this.environment().trim() || sc?.biome || 'Dungeon',
      difficulty: this.difficulty(),
      partyLevel: this.partyLevel(),
      estimatedDuration: this.estimatedDuration(),
      totalXp: this.computedTotalXp(),
      enemyCount: this.computedEnemyCount(),
      thumbnailUrl: init?.thumbnailUrl ?? '/combat-caves.jpg',
      isCustom: this.isCreateMode() || init?.isCustom,
      summary: this.description().trim() || cleanName,
      description: this.description().trim() || cleanName,
      readAloudText: this.readAloudText().trim(),
      objectives: this.objectives(),
      monsters: this.monsters(),
      partyMembers: this.partyMembers(),
      sessionNpcs: this.sessionNpcs().filter((n) => n.includedInEncounter),
      traps: this.traps(),
      rewards: this.rewards(),
      relatedLinks: init?.relatedLinks ?? [],
      sessionNotes: this.sessionNotes(),
    };
  }

  submitSave(): void {
    this.saved.emit(this.buildEncounterPayload());
  }

  submitSaveAndLaunch(): void {
    this.savedAndLaunch.emit(this.buildEncounterPayload());
  }
}
