import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { LoomWeaverStoreService } from '../../../core/services/loomweaver-store.service';
import {
  CREATOR_ANCESTRIES,
  CREATOR_BACKGROUNDS,
  CREATOR_CLASSES,
  CREATOR_EQUIPMENT_DATABASE,
  CREATOR_FEATS,
  CREATOR_SPELL_DATABASE,
  DEFAULT_CAMPAIGN_HISTORY,
  DEFAULT_MENTIONABLE_ENTITIES,
  DEFAULT_MET_ENTITIES,
} from '../models/character-creator-catalog.data';
import {
  CharacterCampaignHistoryEventVm,
  CharacterMetEntityVm,
  CharacterRichNoteVm,
  CharacterSpellVm,
  CreatorAncestryOptionVm,
  CreatorBackgroundOptionVm,
  CreatorClassOptionVm,
  CreatorFeatOptionVm,
  EquipmentLoadoutItemVm,
  LwNoteMentionTagVm,
} from '../models/character-studio.models';

interface CreatorCatalogApiResponse {
  species?: readonly {
    id: string;
    name: string;
    source: string;
    size: string;
    speed: number;
    description: string;
    portraitUrl: string;
  }[];
  subraces?: readonly {
    id: string;
    name: string;
    raceName: string;
    source: string;
    portraitUrl: string;
  }[];
  classes?: readonly {
    id: string;
    name: string;
    source: string;
    hitDie: string;
    primaryAbility: string;
  }[];
  subclasses?: readonly {
    id: string;
    name: string;
    shortName: string;
    className: string;
    source: string;
  }[];
  backgrounds?: readonly {
    id: string;
    name: string;
    source: string;
    skills: string;
    description: string;
  }[];
  feats?: readonly {
    id: string;
    name: string;
    source: string;
    category: string;
    prerequisite: string;
    abilityBonus: string;
    description: string;
  }[];
  items?: readonly {
    id: string;
    name: string;
    category: string;
    rarity: string;
    weightLb: number;
    valueGp: number;
    propertiesJson: string;
    description: string;
  }[];
  spells?: readonly {
    id: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    rangeText: string;
    durationText: string;
    concentration: boolean;
    ritual: boolean;
    classesText: string;
    description: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class CharacterCompendiumCatalogService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(LoomWeaverStoreService);

  readonly ancestries = signal<readonly CreatorAncestryOptionVm[]>(CREATOR_ANCESTRIES);
  readonly classes = signal<readonly CreatorClassOptionVm[]>(CREATOR_CLASSES);
  readonly backgrounds = signal<readonly CreatorBackgroundOptionVm[]>(CREATOR_BACKGROUNDS);
  readonly feats = signal<readonly CreatorFeatOptionVm[]>(CREATOR_FEATS);
  readonly equipmentDatabase = signal<readonly EquipmentLoadoutItemVm[]>(CREATOR_EQUIPMENT_DATABASE);
  readonly spellDatabase = signal<readonly CharacterSpellVm[]>(CREATOR_SPELL_DATABASE);
  readonly metEntities = signal<readonly CharacterMetEntityVm[]>(DEFAULT_MET_ENTITIES);
  readonly campaignHistory = signal<readonly CharacterCampaignHistoryEventVm[]>(DEFAULT_CAMPAIGN_HISTORY);
  readonly mentionableEntities = signal<readonly LwNoteMentionTagVm[]>(DEFAULT_MENTIONABLE_ENTITIES);

  constructor() {
    this.loadCreatorCatalogFromDatabase();
  }

  loadCreatorCatalogFromDatabase(): void {
    this.http.get<CreatorCatalogApiResponse>('/api/v2/characters/creator-catalog').subscribe({
      next: (res) => {
        if (!res) return;
        this.mergeAncestries(res);
        this.mergeClasses(res);
        this.mergeBackgrounds(res);
        this.mergeFeats(res);
        this.mergeItems(res);
        this.mergeSpells(res);
      },
      error: () => {},
    });
  }

  syncNoteToLoom(campaignId: number, note: CharacterRichNoteVm): void {
    if (note.visibility !== 'private') {
      const storeVisibility = note.visibility === 'dm-only' ? ('gm' as const) : ('players' as const);
      const noteCompositeKey = `${campaignId}:Note:${note.id}`;
      this.store.registerEntity({
        compositeKey: noteCompositeKey,
        entityKey: note.id,
        campaignId,
        entityType: 'Lore',
        name: note.title,
        subtitle: `${note.noteType.toUpperCase()} Note · ${note.visibility.toUpperCase()} · by ${note.authorUsername}`,
        visibility: storeVisibility,
        canonStatus: 'approved',
        summary: note.contentText.slice(0, 220),
        routeLink: '/characters',
      });

      if (note.sourceEntityKey) {
        this.store.registerGraphEdge({
          sourceKey: note.sourceEntityKey,
          targetKey: noteCompositeKey,
          relationshipType: 'AUTHORED_NOTE',
          visibility: storeVisibility,
        });
      }

      for (const tag of note.mentionedEntities) {
        this.store.registerGraphEdge({
          sourceKey: noteCompositeKey,
          targetKey: tag.compositeKey,
          relationshipType: 'MENTIONS',
          visibility: storeVisibility,
        });
        if (note.sourceEntityKey) {
          this.store.registerGraphEdge({
            sourceKey: note.sourceEntityKey,
            targetKey: tag.compositeKey,
            relationshipType: 'LINKED_IN_NOTE',
            visibility: storeVisibility,
          });
        }
      }
    }

    this.http
      .post('/api/v2/loom/notes', {
        campaignId,
        title: note.title,
        noteType: note.noteType,
        visibility: note.visibility,
        authorUsername: note.authorUsername,
        contentHtml: note.contentHtml,
        contentText: note.contentText,
        sourceEntityKey: note.sourceEntityKey,
        sourceEntityName: note.sourceEntityName,
        mentionedEntities: note.mentionedEntities,
      })
      .subscribe({ error: () => {} });
  }

  private mergeAncestries(res: CreatorCatalogApiResponse): void {
    if (!res.species?.length) return;
    const existingNames = new Set(CREATOR_ANCESTRIES.map((a) => a.name.toLowerCase()));
    const subraceList = res.subraces ?? [];
    const extras: CreatorAncestryOptionVm[] = [];

    for (const sp of res.species) {
      const cleanName = (sp.name || '').trim();
      if (!cleanName || existingNames.has(cleanName.toLowerCase())) continue;
      existingNames.add(cleanName.toLowerCase());
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const matchedSubs = subraceList
        .filter((sr) => (sr.raceName || '').toLowerCase() === cleanName.toLowerCase())
        .map((sr) => ({
          id: `${slug}-${sr.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: sr.name,
          subtitle: `${cleanName} Lineage (${sr.source || '5e'})`,
          portraitUrl: sr.portraitUrl || sp.portraitUrl || '/assets/5e-tools/races/PHB/Human.webp',
          source: 'PHB' as const,
        }));

      extras.push({
        id: slug,
        name: cleanName,
        tagline: `${sp.size || 'Medium'} Lineage · ${sp.speed || 30} ft Speed`,
        description: (sp.description || `Playable ${cleanName} ancestry from ${sp.source || '5e Compendium'}.`).slice(0, 220),
        source: sp.source?.includes('SRD') ? 'SRD 5.1' : 'PHB',
        portraitUrl: sp.portraitUrl || '/assets/5e-tools/races/PHB/Human.webp',
        galleryPortraits: [sp.portraitUrl || '/assets/5e-tools/races/PHB/Human.webp'],
        speedFeet: sp.speed || 30,
        abilityBonuses: { DEX: 2, WIS: 1 },
        traits: [
          {
            id: `tr-${slug}-1`,
            title: `${cleanName} Heritage`,
            description: (sp.description || `Innate ${cleanName} traits from ${sp.source}.`).slice(0, 140),
            icon: 'shield',
          },
        ],
        subraces: matchedSubs.length
          ? matchedSubs
          : [
              {
                id: `${slug}-standard`,
                name: cleanName,
                subtitle: `${sp.source || '5e'} Standard Lineage`,
                portraitUrl: sp.portraitUrl || '/assets/5e-tools/races/PHB/Human.webp',
                source: 'PHB',
              },
            ],
      });
    }
    this.ancestries.set([...CREATOR_ANCESTRIES, ...extras]);
  }

  private mergeClasses(res: CreatorCatalogApiResponse): void {
    if (!res.subclasses?.length) return;
    const subsByClass = new Map<string, Set<string>>();
    for (const sc of res.subclasses) {
      const cName = (sc.className || '').trim().toLowerCase();
      if (!cName) continue;
      if (!subsByClass.has(cName)) subsByClass.set(cName, new Set());
      subsByClass.get(cName)!.add(sc.name || sc.shortName);
    }

    const updated = CREATOR_CLASSES.map((cls) => {
      const dbSubs = Array.from(subsByClass.get(cls.name.toLowerCase()) ?? []);
      const combined = Array.from(new Set([...(cls.subclasses ?? [cls.subclassDefault]), ...dbSubs]));
      return { ...cls, subclasses: combined };
    });
    this.classes.set(updated);
  }

  private mergeBackgrounds(res: CreatorCatalogApiResponse): void {
    if (!res.backgrounds?.length) return;
    const seen = new Set(CREATOR_BACKGROUNDS.map((b) => b.name.toLowerCase()));
    const extras: CreatorBackgroundOptionVm[] = [];
    for (const bg of res.backgrounds) {
      const clean = (bg.name || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const skills = (bg.skills || 'Insight, Perception')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      extras.push({
        id: slug,
        name: clean,
        tagline: `${bg.source || '5e'} Background`,
        summary: (bg.description || `Trained in ${skills.join(', ')}.`).slice(0, 200),
        source: bg.source || 'PHB',
        skillProficiencies: skills.length ? skills : ['Insight', 'Perception'],
        featureName: `${clean} Feature`,
        defaultQuote: `"Every road leaves its mark on those who walk it."`,
        personality: CREATOR_BACKGROUNDS[0].personality,
      });
    }
    this.backgrounds.set([...CREATOR_BACKGROUNDS, ...extras]);
  }

  private mergeFeats(res: CreatorCatalogApiResponse): void {
    if (!res.feats?.length) return;
    const seen = new Set(CREATOR_FEATS.map((f) => f.name.toLowerCase()));
    const extras: CreatorFeatOptionVm[] = [];
    for (const ft of res.feats) {
      const clean = (ft.name || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      extras.push({
        id: clean,
        name: clean,
        category: ft.category || 'General Feat',
        source: ft.source || 'PHB',
        prerequisite: ft.prerequisite || 'None',
        abilityBonus: ft.abilityBonus || 'See Feat Description',
        summary: (ft.description || `${clean} feat from 5e Compendium.`).slice(0, 200),
      });
    }
    this.feats.set([...CREATOR_FEATS, ...extras]);
  }

  private mergeItems(res: CreatorCatalogApiResponse): void {
    if (!res.items?.length) return;
    const seen = new Set(CREATOR_EQUIPMENT_DATABASE.map((i) => i.name.toLowerCase()));
    const extras: EquipmentLoadoutItemVm[] = [];
    for (const item of res.items) {
      const clean = (item.name || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      const cat = (item.category || '').toLowerCase();
      const slot: EquipmentLoadoutItemVm['slot'] = cat.includes('armor')
        ? 'Armor'
        : cat.includes('weapon') || cat.includes('sword') || cat.includes('bow')
          ? 'Main Hand'
          : cat.includes('shield')
            ? 'Off Hand'
            : cat.includes('focus') || cat.includes('wand') || cat.includes('rod') || cat.includes('staff')
              ? 'Focus'
              : 'Gear';
      extras.push({
        id: `db-${item.id || clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: clean,
        slot,
        summary: `${item.category || 'Adventuring Gear'} · ${item.rarity || 'Common'}`,
        bonusLabel: (item.description || `${item.weightLb || 1} lb · ${item.valueGp || 5} GP`).slice(0, 72),
        acBonus: slot === 'Armor' ? 2 : slot === 'Off Hand' ? 2 : 0,
        attackBonus: slot === 'Main Hand' ? 1 : 0,
        equipped: false,
        entitlement: 'free',
        icon: slot === 'Main Hand' ? 'swords' : slot === 'Armor' ? 'shield' : 'layers',
        weightLb: item.weightLb || 1,
        valueGp: item.valueGp || 5,
        rarity: item.rarity || 'Common',
      });
    }
    this.equipmentDatabase.set([...CREATOR_EQUIPMENT_DATABASE, ...extras]);
  }

  private mergeSpells(res: CreatorCatalogApiResponse): void {
    if (!res.spells?.length) return;
    const seen = new Set(CREATOR_SPELL_DATABASE.map((s) => s.name.toLowerCase()));
    const extras: CharacterSpellVm[] = [];
    for (const sp of res.spells) {
      const clean = (sp.name || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      extras.push({
        id: `sp-${sp.id || clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: clean,
        school: sp.school || 'Evocation',
        icon: sp.level === 0 ? 'wand' : 'zap',
        tone: sp.level >= 3 ? 'crimson' : sp.level >= 1 ? 'gold' : 'emerald',
        actionCost: sp.castingTime || '1 Action',
        level: sp.level ?? 1,
        prepared: sp.level === 0,
        range: sp.rangeText || '60 ft',
        duration: sp.durationText || 'Instantaneous',
        concentration: !!sp.concentration,
        ritual: !!sp.ritual,
        summary: (sp.description || `${clean} (${sp.school})`).slice(0, 180),
      });
    }
    this.spellDatabase.set([...CREATOR_SPELL_DATABASE, ...extras]);
  }
}
