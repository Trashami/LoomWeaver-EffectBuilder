import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CampaignDashboardVm } from '../models/dashboard.models';
import {
  AssetCardVm,
  CampaignVm,
  CombatTelemetryVm,
  EntityCardVm,
  GraphEdgeVm,
  LoomCitationVm,
  NavDestination,
  QualityProfile,
  SceneVm,
  SubscriptionTierVm,
  ViewerRole,
} from '../models/loomweaver.models';
import { buildSeedDashboardForCampaign } from './dashboard-seed.data';
import {
  LW_ASSETS,
  LW_GRAPH_EDGES,
  LW_SCENES,
  LW_SUBSCRIPTION_TIERS,
  LW_TELEMETRY,
} from './loomweaver-catalog.data';
import { LW_CAMPAIGNS, LW_ENTITIES, LW_NAVIGATION } from './loomweaver-seed.data';

const ACTIVE_CAMPAIGN_STORAGE_KEY = 'lw_active_campaign_id_v2';
const GENERATIVE_AI_OPT_IN_STORAGE_KEY = 'lw_generative_ai_opt_in_v2';
const HIDE_AI_CONTENT_STORAGE_KEY = 'lw_hide_ai_content_v2';
const EXPERIENCE_MODE_STORAGE_KEY = 'lw_experience_mode_v2';

export type LwExperienceMode = 'guided' | 'advanced';

@Injectable({ providedIn: 'root' })
export class LoomWeaverStoreService {
  private readonly http = inject(HttpClient);

  readonly navigationItems = signal<readonly NavDestination[]>(LW_NAVIGATION);
  readonly campaigns = signal<readonly CampaignVm[]>(LW_CAMPAIGNS);
  readonly activeCampaignId = signal<number>(1);
  readonly viewerRole = signal<ViewerRole>('gm');
  /**
   * Generative AI (The Weave) is strictly Opt-In and OFF (false) by default.
   */
  readonly weaveEnabled = signal<boolean>(false);
  readonly generativeAiEnabled = computed<boolean>(() => this.weaveEnabled());
  readonly hideAiContent = signal<boolean>(true);
  readonly experienceMode = signal<LwExperienceMode>('advanced');
  readonly loomDrawerOpen = signal<boolean>(false);
  readonly loomQuery = signal<string>(
    'What did Kildrid sense beneath the mountain on the road to Cinth?',
  );
  readonly qualityProfile = signal<QualityProfile>('Balanced');
  readonly inspectedEntityKey = signal<string | null>(null);
  readonly backendOnline = signal<boolean>(true);
  readonly quickRollBanner = signal<string>('1d20 Ready');

  readonly campaignDashboard = signal<CampaignDashboardVm>(
    buildSeedDashboardForCampaign(1, 'gm'),
  );

  private readonly rawEntities = signal<readonly EntityCardVm[]>(LW_ENTITIES);
  private readonly rawAssets = signal<readonly AssetCardVm[]>(LW_ASSETS);
  private readonly rawScenes = signal<readonly SceneVm[]>(LW_SCENES);
  private readonly rawEdges = signal<readonly GraphEdgeVm[]>(LW_GRAPH_EDGES);
  readonly telemetry = signal<readonly CombatTelemetryVm[]>(LW_TELEMETRY);
  private readonly rawSubscriptionTiers = signal<readonly SubscriptionTierVm[]>(LW_SUBSCRIPTION_TIERS);

  readonly subscriptionTiers = computed<readonly SubscriptionTierVm[]>(() => {
    const weaveOn = this.weaveEnabled();
    return this.rawSubscriptionTiers().map((tier) => {
      if (weaveOn) return tier;
      return {
        ...tier,
        includesWeave: false,
        summary: tier.summary
          .replace(', The Weave AI draft companion, and Neo4j World Graph', ', and Connected World & Lore Atlas')
          .replace('The Weave AI draft companion', 'Connected World & Lore Studio'),
      };
    });
  });

  constructor() {
    this.restoreGenerativeAiPreference();
    this.restoreSavedCampaignSelection();
    this.verifyPolyglotHealth();
    this.refreshCampaignDashboard();
  }

  readonly activeCampaign = computed<CampaignVm>(() => {
    const id = this.activeCampaignId();
    return this.campaigns().find((c) => c.id === id) ?? this.campaigns()[0];
  });

  readonly visibleNavigation = computed<readonly NavDestination[]>(() => {
    const weaveOn = this.weaveEnabled();
    return this.navigationItems().filter((item) => !item.requiresWeave || weaveOn);
  });

  readonly authorizedEntities = computed<readonly EntityCardVm[]>(() => {
    const isGm = this.viewerRole() === 'gm';
    const weaveOn = this.weaveEnabled();
    return this.rawEntities()
      .filter(
        (e) =>
          (isGm || e.visibility === 'public' || e.visibility === 'players') &&
          (weaveOn || e.canonStatus !== 'draft'),
      )
      .map((e) => {
        if (!weaveOn && e.routeLink.startsWith('/weave')) {
          return {
            ...e,
            routeLink: e.routeLink.replace(/^\/weave/, '/world-lore'),
          };
        }
        return e;
      });
  });

  readonly authorizedScenes = computed<readonly SceneVm[]>(() => {
    const isGm = this.viewerRole() === 'gm';
    return this.rawScenes().filter(
      (s) => isGm || s.visibility === 'public' || s.visibility === 'players',
    );
  });

  readonly authorizedGraphEdges = computed<readonly GraphEdgeVm[]>(() => {
    const isGm = this.viewerRole() === 'gm';
    return this.rawEdges().filter(
      (edge) => isGm || edge.visibility === 'public' || edge.visibility === 'players',
    );
  });

  readonly assets = computed<readonly AssetCardVm[]>(() => this.rawAssets());

  readonly inspectedEntity = computed<EntityCardVm | null>(() => {
    const key = this.inspectedEntityKey();
    if (!key) return null;
    return (
      this.authorizedEntities().find(
        (e) => e.compositeKey === key || e.entityKey === key,
      ) ?? null
    );
  });

  readonly inspectedEntityEdges = computed(() => {
    const entity = this.inspectedEntity();
    if (!entity) return [];
    const entities = this.authorizedEntities();
    const defaultRoute = this.weaveEnabled() ? '/weave' : '/world-lore';
    return this.authorizedGraphEdges()
      .filter(
        (edge) =>
          edge.sourceKey === entity.compositeKey || edge.targetKey === entity.compositeKey,
      )
      .map((edge) => {
        const isOutgoing = edge.sourceKey === entity.compositeKey;
        const peerKey = isOutgoing ? edge.targetKey : edge.sourceKey;
        const peer = entities.find((e) => e.compositeKey === peerKey);
        return {
          relationshipType: edge.relationshipType,
          direction: isOutgoing ? ('outgoing' as const) : ('incoming' as const),
          peerKey,
          peerName: peer?.name ?? peerKey,
          peerType: peer?.entityType ?? 'Entity',
          peerRoute: peer?.routeLink ?? defaultRoute,
        };
      });
  });

  readonly loomCitations = computed<readonly LoomCitationVm[]>(() => {
    const q = this.loomQuery().trim().toLowerCase();
    const pool = this.authorizedEntities();
    const matched = pool.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q),
    );
    const results = matched.length > 0 ? matched.slice(0, 5) : pool.slice(0, 4);
    return results.map((e) => ({
      compositeKey: e.compositeKey,
      title: e.name,
      entityType: e.entityType,
      excerpt: e.summary,
      routeLink: e.routeLink,
      visibility: e.visibility,
    }));
  });

  setCampaign(id: number): void {
    const numericId = Number(id);
    const available = this.campaigns();
    const validated = available.find((c) => c.id === numericId) ?? available[0];
    if (!validated) return;

    this.activeCampaignId.set(validated.id);
    this.inspectedEntityKey.set(null);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_CAMPAIGN_STORAGE_KEY, String(validated.id));
      }
    } catch {}

    this.refreshCampaignDashboard();
  }

  setViewerRole(role: ViewerRole): void {
    this.viewerRole.set(role);
    this.refreshCampaignDashboard();
  }

  setGenerativeAiOptIn(enabled: boolean): void {
    this.weaveEnabled.set(enabled);
    this.campaigns.update((list) =>
      list.map((c) => ({ ...c, weaveEnabled: enabled })),
    );
    if (!enabled) {
      this.hideAiContent.set(true);
      const inspected = this.inspectedEntity();
      if (inspected && inspected.canonStatus === 'draft') {
        this.inspectedEntityKey.set(null);
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(GENERATIVE_AI_OPT_IN_STORAGE_KEY, String(enabled));
      }
    } catch {}
  }

  toggleWeave(): void {
    this.setGenerativeAiOptIn(!this.weaveEnabled());
  }

  setHideAiContent(hide: boolean): void {
    this.hideAiContent.set(hide);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(HIDE_AI_CONTENT_STORAGE_KEY, String(hide));
      }
    } catch {}
  }

  setExperienceMode(mode: LwExperienceMode): void {
    this.experienceMode.set(mode);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(EXPERIENCE_MODE_STORAGE_KEY, mode);
      }
    } catch {}
  }

  refreshCampaignDashboard(): void {
    const campaignId = this.activeCampaignId();
    const role = this.viewerRole();

    // Immediately set role-filtered seed state so no previous campaign or GM secret ever leaks
    this.campaignDashboard.set(buildSeedDashboardForCampaign(campaignId, role));

    this.http
      .get<CampaignDashboardVm>(`/api/v2/campaigns/${campaignId}/dashboard?role=${role}`)
      .subscribe({
        next: (res) => {
          if (res && res.campaignId === this.activeCampaignId()) {
            this.campaignDashboard.set(res);
          }
        },
        error: () => {},
      });
  }

  togglePrepChecklistItem(itemId: string): void {
    if (this.viewerRole() !== 'gm') return;
    const campaignId = this.activeCampaignId();
    const role = this.viewerRole();

    this.campaignDashboard.update((cur) => {
      const updatedList = cur.upcomingSession.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );
      const completedCount = updatedList.filter((i) => i.completed).length;
      const totalCount = updatedList.length;
      const statusLabel =
        completedCount === 0
          ? 'Not Started'
          : completedCount >= totalCount
            ? 'Ready'
            : 'Prep In Progress';

      return {
        ...cur,
        upcomingSession: {
          ...cur.upcomingSession,
          completedPrepCount: completedCount,
          totalPrepCount: totalCount,
          prepStatusLabel: statusLabel,
          checklist: updatedList,
        },
      };
    });

    this.http
      .post<CampaignDashboardVm>(
        `/api/v2/campaigns/${campaignId}/dashboard/prep/${itemId}/toggle?role=${role}`,
        {},
      )
      .subscribe({
        next: (res) => {
          if (res && res.campaignId === this.activeCampaignId()) {
            this.campaignDashboard.set(res);
          }
        },
        error: () => {},
      });
  }

  toggleSessionBeat(beatId: string): void {
    const campaignId = this.activeCampaignId();
    const role = this.viewerRole();

    this.campaignDashboard.update((cur) => ({
      ...cur,
      sessionGuide: {
        ...cur.sessionGuide,
        beats: cur.sessionGuide.beats.map((b) =>
          b.id === beatId ? { ...b, done: !b.done } : b,
        ),
      },
    }));

    this.http
      .post<CampaignDashboardVm>(
        `/api/v2/campaigns/${campaignId}/dashboard/beats/${beatId}/toggle?role=${role}`,
        {},
      )
      .subscribe({
        next: (res) => {
          if (res && res.campaignId === this.activeCampaignId()) {
            this.campaignDashboard.set(res);
          }
        },
        error: () => {},
      });
  }

  acknowledgeDashboardAlert(alertId: string): void {
    const campaignId = this.activeCampaignId();
    const role = this.viewerRole();

    this.campaignDashboard.update((cur) => ({
      ...cur,
      alerts: cur.alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a)),
    }));

    this.http
      .post<CampaignDashboardVm>(
        `/api/v2/campaigns/${campaignId}/dashboard/alerts/${alertId}/acknowledge?role=${role}`,
        {},
      )
      .subscribe({
        next: (res) => {
          if (res && res.campaignId === this.activeCampaignId()) {
            this.campaignDashboard.set(res);
          }
        },
        error: () => {},
      });
  }

  toggleLoomDrawer(open?: boolean): void {
    this.loomDrawerOpen.update((cur) => (open !== undefined ? open : !cur));
  }

  setLoomSearchQuery(query: string): void {
    this.loomQuery.set(query);
  }

  inspectEntity(keyOrComposite: string | null): void {
    this.inspectedEntityKey.set(keyOrComposite);
  }

  registerEntity(entity: EntityCardVm): void {
    this.rawEntities.update((list) => [
      entity,
      ...list.filter((e) => e.compositeKey !== entity.compositeKey),
    ]);
  }

  registerGraphEdge(edge: GraphEdgeVm): void {
    this.rawEdges.update((list) => [edge, ...list]);
  }

  approveDraftEntity(compositeKey: string): void {
    if (this.viewerRole() !== 'gm') return;
    this.rawEntities.update((list) =>
      list.map((e) =>
        e.compositeKey === compositeKey
          ? { ...e, canonStatus: 'approved', visibility: 'players' }
          : e,
      ),
    );
  }

  unlockAsset(assetId: string): void {
    this.rawAssets.update((list) =>
      list.map((a) =>
        a.id === assetId
          ? { ...a, entitlement: 'purchased', priceLabel: 'Owned (Unlocked)' }
          : a,
      ),
    );
  }

  rollGlobalQuickD20(): void {
    this.http
      .post<{ total: number; isNat20: boolean; isNat1: boolean }>(
        `/api/v2/campaigns/${this.activeCampaignId()}/dice/roll`,
        {
          sides: 20,
          count: 1,
          modifier: 0,
          rollMode: 'normal',
          label: 'Core Shell Quick d20',
          skinId: 'skin-obsidian-gold',
        },
      )
      .subscribe({
        next: (res) => {
          const suffix = res.isNat20 ? ' (NAT 20!)' : res.isNat1 ? ' (NAT 1)' : '';
          this.quickRollBanner.set(`d20: ${res.total}${suffix}`);
        },
        error: () => {
          const v = Math.floor(Math.random() * 20) + 1;
          this.quickRollBanner.set(`d20: ${v}${v === 20 ? ' (NAT 20!)' : ''}`);
        },
      });
  }

  private restoreGenerativeAiPreference(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const savedOptIn = localStorage.getItem(GENERATIVE_AI_OPT_IN_STORAGE_KEY);
      const isOptedIn = savedOptIn === 'true';
      this.weaveEnabled.set(isOptedIn);
      this.campaigns.update((list) =>
        list.map((c) => ({ ...c, weaveEnabled: isOptedIn })),
      );

      const savedHide = localStorage.getItem(HIDE_AI_CONTENT_STORAGE_KEY);
      if (savedHide !== null) {
        this.hideAiContent.set(savedHide === 'true');
      } else {
        this.hideAiContent.set(!isOptedIn);
      }

      const savedMode = localStorage.getItem(EXPERIENCE_MODE_STORAGE_KEY);
      if (savedMode === 'guided' || savedMode === 'advanced') {
        this.experienceMode.set(savedMode);
      }
    } catch {}
  }

  private restoreSavedCampaignSelection(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const saved = Number(localStorage.getItem(ACTIVE_CAMPAIGN_STORAGE_KEY));
      const available = this.campaigns();
      const found = available.find((c) => c.id === saved) ?? available[0];
      if (found) {
        this.activeCampaignId.set(found.id);
      }
    } catch {}
  }

  private verifyPolyglotHealth(): void {
    this.http.get<{ status: string }>('/api/v2/health').subscribe({
      next: (res) => {
        this.backendOnline.set(res?.status === 'healthy');
      },
      error: () => {
        this.backendOnline.set(true);
      },
    });
  }
}
