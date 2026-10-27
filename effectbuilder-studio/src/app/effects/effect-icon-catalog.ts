import { EffectDefinition, EffectKind, EffectLayer } from './effect-definition';

export type SpellIconSlug =
  | 'magic-missile'
  | 'fire-bolt'
  | 'ice-shards'
  | 'shadow-swirl'
  | 'holy-light'
  | 'poison-cloud'
  | 'rune-circle'
  | 'healing-aura'
  | 'lightning-arc'
  | 'smoke'
  | 'embers'
  | 'water-splash'
  | 'wind-gust'
  | 'leaf-swirl'
  | 'blood-mist'
  | 'arcane-sigil'
  | 'portal'
  | 'energy-beam'
  | 'acid-splash'
  | 'thunder-burst'
  | 'frost-nova'
  | 'eldritch-blast'
  | 'guiding-bolt'
  | 'spirit-flame';

export const SPELL_ICON_ORDER: readonly SpellIconSlug[] = [
  'magic-missile',
  'fire-bolt',
  'ice-shards',
  'shadow-swirl',
  'holy-light',
  'poison-cloud',
  'rune-circle',
  'healing-aura',
  'lightning-arc',
  'smoke',
  'embers',
  'water-splash',
  'wind-gust',
  'leaf-swirl',
  'blood-mist',
  'arcane-sigil',
  'portal',
  'energy-beam',
  'acid-splash',
  'thunder-burst',
  'frost-nova',
  'eldritch-blast',
  'guiding-bolt',
  'spirit-flame',
];

export function getSpellIconUrl(slug: SpellIconSlug): string {
  return `/effect-icons/${slug}.webp`;
}

export function getSpellIconAtlasIndex(slug: SpellIconSlug): number {
  const idx = SPELL_ICON_ORDER.indexOf(slug);
  return idx >= 0 ? idx : 0;
}

const EXTRACTED_ID_MAP: Record<string, SpellIconSlug> = {
  'extracted:projectile': 'fire-bolt',
  'extracted:projectile_volley': 'magic-missile',
  'extracted:object_projectile': 'ice-shards',
  'extracted:trail': 'guiding-bolt',
  'extracted:beam': 'energy-beam',
  'extracted:cone_spray': 'ice-shards',
  'extracted:energy_column': 'holy-light',
  'extracted:burst': 'thunder-burst',
  'extracted:box_burst': 'eldritch-blast',
  'extracted:shockwave': 'wind-gust',
  'extracted:casting_charge': 'arcane-sigil',
  'extracted:magic_circle': 'rune-circle',
  'extracted:swirling_aura': 'healing-aura',
  'extracted:smoke_mist': 'smoke',
  'extracted:sparks_embers': 'embers',
  'extracted:debris': 'thunder-burst',
  'extracted:surface_mark': 'frost-nova',
};

const KIND_DEFAULT_ICON: Record<EffectKind, SpellIconSlug> = {
  beam: 'energy-beam',
  lightning: 'lightning-arc',
  chain_lightning: 'lightning-arc',
  sky_projectile: 'fire-bolt',
  sky_beam: 'holy-light',
  sky_lightning: 'lightning-arc',
  projectile: 'fire-bolt',
  burst: 'thunder-burst',
  aura: 'healing-aura',
  sparks: 'embers',
  ring: 'frost-nova',
  cone: 'ice-shards',
  wall: 'spirit-flame',
  cloud: 'poison-cloud',
  sigil: 'rune-circle',
  tether: 'energy-beam',
  whip: 'leaf-swirl',
  shield: 'healing-aura',
  ground: 'acid-splash',
  emitter: 'leaf-swirl',
  vortex: 'shadow-swirl',
  portal: 'portal',
  orbit: 'magic-missile',
  slash: 'guiding-bolt',
  symbol: 'arcane-sigil',
  eruption: 'thunder-burst',
  distortion: 'wind-gust',
  trail: 'fire-bolt',
  sound: 'thunder-burst',
};

export function resolveTextIconSlug(text: string): SpellIconSlug | null {
  const s = text.toLowerCase();
  if (s.includes('magic missile') || s.includes('volley') || s.includes('dart') || s.includes('star mote') || s.includes('astral')) return 'magic-missile';
  if (s.includes('eldritch') || s.includes('agonizing') || s.includes('repelling')) return 'eldritch-blast';
  if (s.includes('guiding bolt') || s.includes('solar') || s.includes('starlight') || s.includes('crescent') || s.includes('radiant')) return 'guiding-bolt';
  if (s.includes('holy') || s.includes('sacred') || s.includes('moonbeam') || s.includes('sunbeam') || s.includes('divine') || s.includes('pillar') || s.includes('column') || s.includes('sanctified') || s.includes('consecrated') || s.includes('bell') || s.includes('celestial')) return 'holy-light';
  if (s.includes('heal') || s.includes('vitality') || s.includes('cure') || s.includes('sanctuary') || s.includes('aegis') || s.includes('bulwark') || s.includes('dome') || s.includes('shell')) return 'healing-aura';
  if (s.includes('spirit flame') || s.includes('faerie') || s.includes('soul') || s.includes('wisp') || s.includes('spectral') || s.includes('ghost')) return 'spirit-flame';
  if (s.includes('fire bolt') || s.includes('scorching') || s.includes('fireball') || s.includes('comet') || s.includes('meteor') || s.includes('flame lash') || s.includes('flaming') || s.includes('tornado')) return 'fire-bolt';
  if (s.includes('ember') || s.includes('spark') || s.includes('cinder') || s.includes('burning') || s.includes('hellish') || s.includes('inferno') || s.includes('tar') || s.includes('heat') || s.includes('fire')) return 'embers';
  if (s.includes('frost nova') || s.includes('snowball') || s.includes('freezing') || s.includes('frozen') || s.includes('scorch') || s.includes('surface mark')) return 'frost-nova';
  if (s.includes('ice') || s.includes('Cold') || s.includes('cold') || s.includes('frost') || s.includes('glacier') || s.includes('blizzard') || s.includes('crystal') || s.includes('shard') || s.includes('object projectile')) return 'ice-shards';
  if (s.includes('acid') || s.includes('caustic') || s.includes('vitriolic') || s.includes('corrosive') || s.includes('venom')) return 'acid-splash';
  if (s.includes('poison') || s.includes('toxic') || s.includes('cloudkill') || s.includes('stinking') || s.includes('miasma') || s.includes('gas') || s.includes('plague')) return 'poison-cloud';
  if (s.includes('blood') || s.includes('crimson') || s.includes('vampiric') || s.includes('inflict') || s.includes('necrotic') || s.includes('siphon') || s.includes('drain') || s.includes('bone') || s.includes('curse') || s.includes('hex ') || s.includes('hunter')) return 'blood-mist';
  if (s.includes('smoke') || s.includes('fog') || s.includes('ash') || s.includes('mist')) return 'smoke';
  if (s.includes('water') || s.includes('tidal') || s.includes('rain') || s.includes('geyser') || s.includes('maelstrom') || s.includes('aqua') || s.includes('wave')) return 'water-splash';
  if (s.includes('leaf') || s.includes('leaves') || s.includes('thorn') || s.includes('vine') || s.includes('entangle') || s.includes('nature') || s.includes('root') || s.includes('spore') || s.includes('druid') || s.includes('web')) return 'leaf-swirl';
  if (s.includes('wind') || s.includes('gust') || s.includes('gale') || s.includes('zephyr') || s.includes('cyclone') || s.includes('whirlwind') || s.includes('shockwave') || s.includes('sonic') || s.includes('roar') || s.includes('slipstream')) return 'wind-gust';
  if (s.includes('lightning') || s.includes('witch bolt') || s.includes('shocking') || s.includes('arc_jump') || s.includes('forked') || s.includes('storm') || s.includes('overload')) return 'lightning-arc';
  if (s.includes('thunder') || s.includes('shatter') || s.includes('eruption') || s.includes('debris') || s.includes('spike') || s.includes('fissure') || s.includes('crater') || s.includes('earth') || s.includes('stone') || s.includes('burst')) return 'thunder-burst';
  if (s.includes('portal') || s.includes('gate') || s.includes('rift') || s.includes('door') || s.includes('archway') || s.includes('teleport') || s.includes('banish') || s.includes('summon')) return 'portal';
  if (s.includes('rune') || s.includes('circle') || s.includes('ward') || s.includes('counterspell')) return 'rune-circle';
  if (s.includes('sigil') || s.includes('glyph') || s.includes('symbol') || s.includes('mage hand') || s.includes('casting') || s.includes('charge') || s.includes('ioun') || s.includes('script')) return 'arcane-sigil';
  if (s.includes('shadow') || s.includes('vortex') || s.includes('void') || s.includes('hadar') || s.includes('darkness') || s.includes('gravity') || s.includes('singularity') || s.includes('time') || s.includes('whisper')) return 'shadow-swirl';
  if (s.includes('beam') || s.includes('disintegrate') || s.includes('ray') || s.includes('lance') || s.includes('tether') || s.includes('vorpal')) return 'energy-beam';
  return null;
}

export function resolveLayerIconSlug(
  layer: Pick<EffectLayer, 'kind' | 'variant' | 'color' | 'cinematic' | 'fireMaterial' | 'fireHit' | 'missile' | 'mageHand'>,
  titleHint = ''
): SpellIconSlug {
  if (layer.missile) return 'magic-missile';
  if (layer.mageHand) return 'arcane-sigil';
  if (layer.fireHit) return 'thunder-burst';
  if (layer.fireMaterial) {
    return layer.fireMaterial.role === 'caster'
      ? 'spirit-flame'
      : layer.fireMaterial.role === 'impact'
        ? 'thunder-burst'
        : 'fire-bolt';
  }
  if (layer.cinematic) {
    const el = layer.cinematic.element;
    const st = layer.cinematic.style;
    if (st === 'column') return 'holy-light';
    if (st === 'cube') return 'eldritch-blast';
    if (el === 'ice') return st === 'nova' ? 'frost-nova' : 'ice-shards';
    if (el === 'gas') return 'poison-cloud';
    if (el === 'acid') return 'acid-splash';
    if (el === 'radiant') return st === 'beam' ? 'guiding-bolt' : 'holy-light';
    if (el === 'lightning') return 'lightning-arc';
    if (el === 'shadow') return st === 'beam' ? 'eldritch-blast' : 'shadow-swirl';
    if (el === 'fire') return st === 'beam' ? 'fire-bolt' : st === 'cone' ? 'embers' : 'thunder-burst';
  }

  const combined = `${titleHint} ${layer.kind} ${layer.variant}`;
  const byText = resolveTextIconSlug(combined);
  if (byText) return byText;

  return KIND_DEFAULT_ICON[layer.kind] ?? 'arcane-sigil';
}

export function resolveEffectIconSlug(
  effect: Pick<EffectDefinition, 'id' | 'name' | 'spellName' | 'description' | 'layers'>
): SpellIconSlug {
  if (effect.id && EXTRACTED_ID_MAP[effect.id]) {
    return EXTRACTED_ID_MAP[effect.id];
  }
  const byTitle = resolveTextIconSlug(`${effect.name} ${effect.spellName}`);
  if (byTitle) return byTitle;

  const firstLayer = effect.layers?.[0];
  if (firstLayer) {
    return resolveLayerIconSlug(firstLayer, `${effect.name} ${effect.spellName} ${effect.description}`);
  }

  return resolveTextIconSlug(effect.description || '') ?? 'arcane-sigil';
}

export function resolveEffectIconUrl(
  effect: Pick<EffectDefinition, 'id' | 'name' | 'spellName' | 'description' | 'layers'>
): string {
  return getSpellIconUrl(resolveEffectIconSlug(effect));
}

export function resolveCatalogEntryIconSlug(
  id: string,
  title: string,
  description: string,
  effect: EffectDefinition
): SpellIconSlug {
  if (EXTRACTED_ID_MAP[id]) return EXTRACTED_ID_MAP[id];
  const byHeader = resolveTextIconSlug(`${id} ${title}`);
  if (byHeader) return byHeader;
  const firstLayer = effect.layers?.[0];
  if (firstLayer) {
    return resolveLayerIconSlug(firstLayer, `${title} ${description}`);
  }
  return resolveEffectIconSlug(effect);
}
