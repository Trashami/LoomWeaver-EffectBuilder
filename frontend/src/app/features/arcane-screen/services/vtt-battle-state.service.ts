import { Injectable, computed, inject, signal } from '@angular/core';
import { LoomWeaverStoreService } from '../../../core/services/loomweaver-store.service';
import { VttTokenVm } from '../../effects/engine/effect-timeline.contract';
import {
  clampLineToRangeAndWalls,
  computeClampedGridMovePath,
  computeVisibilityPolygonSvgPoints,
  distanceInFeet,
  findTokensInAoe,
  hasLineOfSight,
  worldToSvgX,
  worldToSvgY,
} from '../engine/vtt-los-and-grid.engine';
import {
  VttChatMessageVm,
  VttFogMode,
  VttMeasureSubMode,
  VttOpenDmDrawer,
  VttPoint2D,
  VttRevealedLoreVm,
  VttRightTabId,
  VttScopedNpcVm,
  VttScopedQuestVm,
  VttTacticalAbilityVm,
  VttTurnActionCategory,
  VttWallSegmentVm,
} from '../models/vtt-battle.models';
import {
  SEED_TACTICAL_TURN_ABILITIES,
  SEED_VTT_CHAT_MESSAGES,
  SEED_VTT_REVEALED_LORE,
  SEED_VTT_SCOPED_NPCS,
  SEED_VTT_SCOPED_QUESTS,
  SEED_VTT_WALL_SEGMENTS,
} from './vtt-battle.seed';
import { VttCombatService } from './vtt-combat.service';

@Injectable({ providedIn: 'root' })
export class VttBattleStateService {
  private readonly store = inject(LoomWeaverStoreService);
  private readonly vtt = inject(VttCombatService);

  // Right Collapsible Panel State
  readonly rightPanelCollapsed = signal<boolean>(false);
  readonly activeRightTab = signal<VttRightTabId>('initiative');

  // Floating Battle Map Drawers
  readonly openDmDrawer = signal<VttOpenDmDrawer>('none');

  // Per-Encounter GM Fog of War & Vision Settings
  readonly fogMode = signal<VttFogMode>('explored-los');
  readonly hideOutOfSightMonsters = signal<boolean>(true);
  readonly playerSightDistanceFeet = signal<number>(60);
  readonly gmPreviewPlayerVision = signal<boolean>(false);

  // Wall segments for current battlemap
  readonly walls = signal<readonly VttWallSegmentVm[]>(SEED_VTT_WALL_SEGMENTS);

  // Explored trail points for 'explored-los' ("Fog of war based on where they have traveled")
  readonly exploredTrailPoints = signal<readonly { x: number; z: number; radiusFeet: number }[]>([
    { x: -7, z: -3, radiusFeet: 45 },
    { x: -4, z: -5, radiusFeet: 45 },
    { x: -5, z: 1, radiusFeet: 45 },
    { x: 0, z: 0, radiusFeet: 45 },
  ]);

  // Cursor position on the battlemap in world coordinates
  readonly cursorWorldPos = signal<VttPoint2D>({ x: 4, z: 1 });

  // Measure Tool State (Spell Measure vs Stealth Movement Measure)
  readonly measureEnabled = signal<boolean>(false);
  readonly measureSubMode = signal<VttMeasureSubMode>('spell');
  readonly measuredAbilityId = signal<string>('act-kildrid-seal');
  readonly usedMovementFeetByToken = signal<Record<string, number>>({});

  // Bottom Character Action Bar & Live Targeting / Multi-Target State
  readonly activeTurnCategory = signal<VttTurnActionCategory>('all');
  readonly tacticalAbilities = signal<readonly VttTacticalAbilityVm[]>(SEED_TACTICAL_TURN_ABILITIES);
  readonly pendingAbility = signal<VttTacticalAbilityVm | null>(null);
  readonly targetSelectionMode = signal<boolean>(false);
  readonly multiTargetKeys = signal<readonly string[]>(['1:Encounter:vamp-1']);

  // Role-Scoped Right Panel Data
  readonly chatMessages = signal<readonly VttChatMessageVm[]>(SEED_VTT_CHAT_MESSAGES);
  readonly scopedQuests = signal<readonly VttScopedQuestVm[]>(SEED_VTT_SCOPED_QUESTS);
  readonly scopedNpcs = signal<readonly VttScopedNpcVm[]>(SEED_VTT_SCOPED_NPCS);
  readonly revealedLore = signal<readonly VttRevealedLoreVm[]>(SEED_VTT_REVEALED_LORE);

  // Active observer token (the selected player token whose Line of Sight is evaluated)
  readonly activeObserverToken = computed<VttTokenVm>(() => {
    const selected = this.vtt.selectedAttacker();
    if (selected && selected.faction === 'party') {
      return selected;
    }
    return this.vtt.partyTokensInScene()[0] ?? this.vtt.tokens()[0];
  });

  readonly remainingMovementFeet = computed<number>(() => {
    const observer = this.activeObserverToken();
    if (!observer) return 30;
    const spent = this.usedMovementFeetByToken()[observer.key] ?? 0;
    return Math.max(0, observer.movementFeet - spent);
  });

  readonly observerSightPolygonSvg = computed<string>(() => {
    const obs = this.activeObserverToken();
    if (!obs) return '';
    return computeVisibilityPolygonSvgPoints(
      { x: obs.x, z: obs.z },
      this.playerSightDistanceFeet(),
      this.walls(),
      96,
    );
  });

  readonly exploredCirclesSvg = computed(() =>
    this.exploredTrailPoints().map((pt, idx) => ({
      id: `exp-${idx}`,
      cx: worldToSvgX(pt.x),
      cy: worldToSvgY(pt.z),
      r: Math.round((pt.radiusFeet / 2.5 / 24) * 1200),
    })),
  );

  // Determines whether a token has Line of Sight from the active player token
  isTokenInPlayerLoS(token: VttTokenVm): boolean {
    if (token.faction === 'party') {
      const obs = this.activeObserverToken();
      if (!obs || token.key === obs.key) return true;
      return hasLineOfSight(
        { x: obs.x, z: obs.z },
        { x: token.x, z: token.z },
        this.playerSightDistanceFeet(),
        this.walls(),
      );
    }
    const obs = this.activeObserverToken();
    if (!obs) return true;
    return hasLineOfSight(
      { x: obs.x, z: obs.z },
      { x: token.x, z: token.z },
      this.playerSightDistanceFeet(),
      this.walls(),
    );
  }

  // Visible tokens on the map based on Role + GM Encounter Settings
  readonly visibleMapTokens = computed<readonly VttTokenVm[]>(() => {
    const all = this.vtt.tokens();
    const isPlayerView =
      this.store.viewerRole() === 'players' || this.gmPreviewPlayerVision();
    if (!isPlayerView || !this.hideOutOfSightMonsters()) {
      return all;
    }
    return all.filter((t) => {
      if (t.faction === 'party') return true;
      return this.isTokenInPlayerLoS(t);
    });
  });

  // Filtered abilities for the Bottom Character Action Bar
  readonly filteredTurnAbilities = computed<readonly VttTacticalAbilityVm[]>(() => {
    const cat = this.activeTurnCategory();
    const list = this.tacticalAbilities();
    if (cat === 'all') return list;
    return list.filter((a) => a.turnCategory === cat);
  });

  isAbilityAvailableOnTurn(ability: VttTacticalAbilityVm): boolean {
    const actor = this.activeObserverToken();
    if (!actor) return true;
    if (ability.actionCost === '1 Action') return !actor.actionUsed;
    if (ability.actionCost === '1 Bonus Action') return !actor.bonusUsed;
    if (ability.actionCost === '1 Reaction') return !actor.reactionUsed;
    return true;
  }

  // Selected spell for Spell Measure tool
  readonly measuredAbility = computed<VttTacticalAbilityVm>(
    () =>
      this.tacticalAbilities().find((a) => a.id === this.measuredAbilityId()) ??
      this.tacticalAbilities()[4] ??
      this.tacticalAbilities()[0],
  );

  // Live Spell Measure OR Attack/Spell Targeting Preview (Clamped to Range + Walls)
  readonly activeRangeAndAoePreview = computed(() => {
    const obs = this.activeObserverToken();
    if (!obs) return null;

    const ability = this.pendingAbility()
      ? this.pendingAbility()
      : this.measureEnabled() && this.measureSubMode() === 'spell'
        ? this.measuredAbility()
        : null;

    if (!ability) return null;

    const clamped = clampLineToRangeAndWalls(
      { x: obs.x, z: obs.z },
      this.cursorWorldPos(),
      ability.rangeFeet,
      this.walls(),
      false,
    );

    const aoeRadius = Math.max(5, ability.aoeRadiusFeet || 5);
    const highlightedTokens = findTokensInAoe(
      clamped.end,
      aoeRadius,
      this.visibleMapTokens().filter((t) => t.key !== obs.key),
    );

    return {
      ability,
      clamped,
      aoeRadiusFeet: aoeRadius,
      highlightedTokens,
      highlightedKeys: new Set(highlightedTokens.map((t) => t.key)),
    };
  });

  // Live Stealth Grid Movement Measure Preview (Clamped to Max Movement + Walls + 5ft Grid)
  readonly activeMovementPreview = computed(() => {
    if (!this.measureEnabled() || this.measureSubMode() !== 'movement') {
      return null;
    }
    const obs = this.activeObserverToken();
    if (!obs) return null;
    const maxFeet = this.remainingMovementFeet();
    return computeClampedGridMovePath(
      { x: obs.x, z: obs.z },
      this.cursorWorldPos(),
      maxFeet,
      this.walls(),
    );
  });

  // Role-Scoped Right Panel Computed Lists
  readonly visibleChatMessages = computed(() => {
    if (this.store.viewerRole() === 'gm') return this.chatMessages();
    return this.chatMessages().filter((m) => m.revealedToPlayers);
  });

  readonly visibleQuests = computed(() => {
    if (this.store.viewerRole() === 'gm') return this.scopedQuests();
    return this.scopedQuests().filter((q) => q.revealedToPlayers);
  });

  readonly visibleNpcs = computed(() => {
    if (this.store.viewerRole() === 'gm') return this.scopedNpcs();
    return this.scopedNpcs().filter((n) => n.revealedToPlayers);
  });

  readonly visibleLore = computed(() => {
    if (this.store.viewerRole() === 'gm') return this.revealedLore();
    return this.revealedLore().filter((l) => l.revealedToPlayers);
  });

  // Actions & Mutators
  toggleDmDrawer(drawer: VttOpenDmDrawer): void {
    this.openDmDrawer.update((curr) => (curr === drawer ? 'none' : drawer));
  }

  toggleMeasureTool(subMode?: VttMeasureSubMode): void {
    if (subMode) {
      if (this.measureEnabled() && this.measureSubMode() === subMode) {
        this.measureEnabled.set(false);
      } else {
        this.pendingAbility.set(null);
        this.measureSubMode.set(subMode);
        this.measureEnabled.set(true);
      }
      return;
    }
    this.measureEnabled.update((v) => !v);
    if (this.measureEnabled()) {
      this.pendingAbility.set(null);
    }
  }

  commitStealthGridMove(): void {
    const preview = this.activeMovementPreview();
    const obs = this.activeObserverToken();
    if (!preview || !obs || preview.distanceFeet <= 0) return;

    const dest = preview.destination;
    this.vtt.tokens.update((list) =>
      list.map((t) => (t.key === obs.key ? { ...t, x: dest.x, z: dest.z } : t)),
    );
    this.usedMovementFeetByToken.update((prev) => ({
      ...prev,
      [obs.key]: (prev[obs.key] ?? 0) + preview.distanceFeet,
    }));
    this.exploredTrailPoints.update((pts) => [
      ...pts,
      { x: dest.x, z: dest.z, radiusFeet: Math.min(45, this.playerSightDistanceFeet()) },
    ]);
  }

  resetTurnMovement(tokenKey: string): void {
    this.usedMovementFeetByToken.update((prev) => ({ ...prev, [tokenKey]: 0 }));
  }

  beginAbilityTargeting(ability: VttTacticalAbilityVm): void {
    if (!this.isAbilityAvailableOnTurn(ability)) return;
    this.measureEnabled.set(false);
    this.pendingAbility.set(ability);
  }

  handleTokenClick(token: VttTokenVm, shiftKey: boolean): void {
    const obs = this.activeObserverToken();
    // If clicking a party member without Shift/Targeting mode and no pending ability, switch active character
    if (
      token.faction === 'party' &&
      !shiftKey &&
      !this.targetSelectionMode() &&
      !this.pendingAbility()
    ) {
      this.vtt.selectedAttackerKey.set(token.key);
      return;
    }

    // Check Line of Sight before allowing a player to target a creature
    if (obs && !this.isTokenInPlayerLoS(token) && this.store.viewerRole() === 'players') {
      return;
    }

    if (shiftKey || this.targetSelectionMode()) {
      this.multiTargetKeys.update((keys) => {
        const exists = keys.includes(token.key);
        if (exists) {
          const next = keys.filter((k) => k !== token.key);
          return next.length > 0 ? next : [token.key];
        }
        return [...keys, token.key];
      });
      this.vtt.selectedTargetKey.set(token.key);
    } else {
      this.multiTargetKeys.set([token.key]);
      this.vtt.selectedTargetKey.set(token.key);
    }

    // If a live ability is awaiting target confirmation, execute it immediately on click
    if (this.pendingAbility()) {
      this.cursorWorldPos.set({ x: token.x, z: token.z });
    }
  }

  confirmPendingAbilityCast(): {
    ability: VttTacticalAbilityVm;
    targets: readonly VttTokenVm[];
  } | null {
    const preview = this.activeRangeAndAoePreview();
    const ability = this.pendingAbility();
    const obs = this.activeObserverToken();
    if (!preview || !ability || !obs) return null;

    // Combine tokens highlighted inside the AoE template + any multi-targeted tokens within range & LoS
    const templateTargets = preview.highlightedTokens;
    const explicitTargets = this.vtt
      .tokens()
      .filter(
        (t) =>
          this.multiTargetKeys().includes(t.key) &&
          distanceInFeet({ x: obs.x, z: obs.z }, { x: t.x, z: t.z }) <= ability.rangeFeet &&
          this.isTokenInPlayerLoS(t),
      );

    const mergedMap = new Map<string, VttTokenVm>();
    templateTargets.forEach((t) => mergedMap.set(t.key, t));
    if (mergedMap.size === 0) {
      explicitTargets.forEach((t) => mergedMap.set(t.key, t));
    }

    const finalTargets = Array.from(mergedMap.values());
    if (finalTargets.length > 0) {
      this.multiTargetKeys.set(finalTargets.map((t) => t.key));
      this.vtt.selectedTargetKey.set(finalTargets[0].key);
    }

    this.pendingAbility.set(null);
    return { ability, targets: finalTargets };
  }

  cancelAllInteractiveModes(): void {
    this.pendingAbility.set(null);
    this.targetSelectionMode.set(false);
    this.measureEnabled.set(false);
  }

  sendChatMessage(text: string, gmWhisperOnly = false): void {
    const clean = text.trim();
    if (!clean) return;
    const isGm = this.store.viewerRole() === 'gm';
    const msg: VttChatMessageVm = {
      id: `chat-${Date.now()}`,
      senderName: isGm ? 'Elias Thorne (DM)' : this.activeObserverToken().name,
      senderRole: isGm ? 'gm' : 'player',
      timestamp: new Date().toTimeString().slice(0, 8),
      text: clean,
      revealedToPlayers: isGm ? !gmWhisperOnly : true,
    };
    this.chatMessages.update((list) => [...list, msg]);
  }

  toggleChatRevealed(id: string): void {
    this.chatMessages.update((list) =>
      list.map((m) => (m.id === id ? { ...m, revealedToPlayers: !m.revealedToPlayers } : m)),
    );
  }

  toggleQuestRevealed(id: string): void {
    this.scopedQuests.update((list) =>
      list.map((q) => (q.id === id ? { ...q, revealedToPlayers: !q.revealedToPlayers } : q)),
    );
  }

  toggleNpcRevealed(id: string): void {
    this.scopedNpcs.update((list) =>
      list.map((n) => (n.id === id ? { ...n, revealedToPlayers: !n.revealedToPlayers } : n)),
    );
  }

  toggleLoreRevealed(id: string): void {
    this.revealedLore.update((list) =>
      list.map((l) => (l.id === id ? { ...l, revealedToPlayers: !l.revealedToPlayers } : l)),
    );
  }

  quickAddNpcToEncounter(
    name: string,
    title: string,
    scope: 'Encounter' | 'Region',
    disposition: 'Friendly' | 'Neutral' | 'Deceptive' | 'Hostile',
    placeOnMap: boolean,
  ): void {
    const cleanName = name.trim() || 'Vistagh Scout';
    const id = `npc-${Date.now().toString().slice(-4)}`;
    const npc: VttScopedNpcVm = {
      id,
      name: cleanName,
      title: title.trim() || 'Session NPC',
      scope,
      disposition,
      locationName: this.vtt.activeLiveEncounter().sceneName,
      summary: `${disposition} ${scope.toLowerCase()} NPC added live during session.`,
      gmSecret: 'Added via Arcane Screen Quick-Add tool.',
      revealedToPlayers: true,
      onBattleMap: placeOnMap,
    };
    this.scopedNpcs.update((prev) => [npc, ...prev]);

    if (placeOnMap) {
      this.vtt.tokens.update((tokens) => [
        ...tokens,
        {
          key: `1:NPC:${id}`,
          name: cleanName,
          roleLabel: `${scope} NPC · ${disposition}`,
          faction: disposition === 'Hostile' ? 'hostile' : 'party',
          initiative: 14,
          currentHp: 36,
          maxHp: 36,
          armorClass: 15,
          x: 0,
          z: 2,
          colorHex: disposition === 'Hostile' ? '#ef5d72' : '#49e892',
          actionUsed: false,
          bonusUsed: false,
          reactionUsed: false,
          movementFeet: 30,
        },
      ]);
    }
  }
}
