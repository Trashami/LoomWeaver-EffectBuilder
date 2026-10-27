export const EXTENDED_EFFECT_KINDS = [
  'sky_projectile',
  'sky_beam',
  'sky_lightning',
  'chain_lightning',
  'shield',
  'ground',
  'emitter',
  'vortex',
  'portal',
  'orbit',
  'slash',
  'symbol',
  'eruption',
  'distortion',
  'trail',
  'sound',
] as const;

export type ExtendedEffectKind = typeof EXTENDED_EFFECT_KINDS[number];

export const EXTENDED_VARIANTS: Record<
  ExtendedEffectKind,
  readonly { id: string; name: string; description: string }[]
> = {
  sky_projectile: [
    { id: 'fireball', name: 'Sky Fireball / Meteor', description: '3D molten fireball projectile descending from the sky onto the target.' },
    { id: 'comet', name: 'Comet Strike', description: 'Streaming astral comet plunging from the upper atmosphere with coiling wake ribbons.' },
    { id: 'glacier', name: 'Hail / Ice Meteor', description: 'Faceted crystalline frost sphere crashing down from overhead.' },
    { id: 'starfall', name: 'Celestial Starfall', description: 'Blazing radiant star-lance descending from the heavens.' },
    { id: 'void_orb', name: 'Abyssal Falling Orb', description: 'Dark singularity sphere plummeting from a skyward rift.' },
  ],
  sky_beam: [
    { id: 'divine_smite', name: 'Divine Smite Pillar', description: 'Concentrated heavenly beam striking down from the sky onto the target.' },
    { id: 'sacred_flame', name: 'Sacred Flame Ray', description: 'Radiant golden column descending from an overhead celestial aperture.' },
    { id: 'moonbeam', name: 'Moonbeam Shaft', description: 'Silvery lunar beam shining down from the night sky with drifting motes.' },
    { id: 'orbital_lance', name: 'Arcane Sky Lance', description: 'High-energy arcane laser lancing down from above.' },
    { id: 'shadow_pillar', name: 'Umbral Sky Pillar', description: 'Dark void column descending from an overhead eclipse.' },
  ],
  sky_lightning: [
    { id: 'thunderbolt', name: 'Sky Thunderbolt', description: 'Jagged bolt of sky lightning with customizable arcs, branches, core, and outer emitter.' },
    { id: 'forked_tempest', name: 'Forked Storm Strike', description: 'Multi-arc sky lightning splitting into wide secondary branches.' },
    { id: 'chain_sky', name: 'High-Voltage Surge', description: 'Intense flickering electrical discharge with dense ozone spark emitters.' },
    { id: 'divine_wrath', name: 'Wrathful Sky Bolt', description: 'Radiant golden-white storm bolt crashing from the heavens.' },
    { id: 'eldritch_storm', name: 'Eldritch Sky Bolt', description: 'Crackling arcane-violet lightning descending from a storm cloud.' },
  ],
  chain_lightning: [
    { id: 'arc_jump', name: 'Jumping arc', description: 'Branching electrical bolt jumping sequentially across targets 1, 2, and 3.' },
    { id: 'storm_chain', name: 'Storm chain', description: 'Tempest lightning chaining between targets with residual ozone sparks.' },
    { id: 'forked_relay', name: 'Forked relay', description: 'Twin jagged arcs relaying from target to target with secondary forks.' },
    { id: 'overload', name: 'Overload surge', description: 'High-voltage discharge pulsing at each chained node before leaping.' },
    { id: 'eldritch_arc', name: 'Eldritch chain', description: 'Crackling arcane energy jumping between multiple foes.' },
  ],
  shield: [
    { id: 'hex_dome', name: 'Hexagonal dome', description: 'Enclosing spherical barrier with glowing hexagonal facets.' },
    { id: 'aegis_wall', name: 'Directional shield', description: 'Curved forward-facing ward deflecting incoming magic.' },
    { id: 'crystal_shell', name: 'Crystalline shell', description: 'Faceted frost and crystal barrier surrounding the subject.' },
    { id: 'runic_dome', name: 'Runic sanctuary', description: 'Protective hemisphere ringed with rotating warding runes.' },
    { id: 'force_bubble', name: 'Resonant force sphere', description: 'Translucent spherical shell with rippling impact rings.' },
  ],
  ground: [
    { id: 'scorched_earth', name: 'Persistent fire ground', description: 'Lingering embers, ground flame, and scorched soot surface mark.' },
    { id: 'ice_sheet', name: 'Slick ice sheet', description: 'Crystalline ground frost with drifting cold vapor.' },
    { id: 'acid_pool', name: 'Caustic acid pool', description: 'Bubbling corrosive surface with rising toxic fumes.' },
    { id: 'web_snare', name: 'Web / entangle snare', description: 'Interlaced sticky strands and anchoring ground filaments.' },
    { id: 'corrupted_mire', name: 'Shadow / grease mire', description: 'Dark viscous ground zone with swirling tendrils.' },
  ],
  emitter: [
    { id: 'rain_deluge', name: 'Rain deluge', description: 'Angled falling rain streaks with ground splash ripples.' },
    { id: 'snow_flurry', name: 'Snow flurry', description: 'Swirling snowflakes drifting across the battlefield.' },
    { id: 'falling_leaves', name: 'Fey falling leaves', description: 'Spiraling autumn and fey leaves carried on a magical breeze.' },
    { id: 'biolum_spores', name: 'Bioluminescent spores', description: 'Floating fungal spores pulsing with soft light.' },
    { id: 'rising_motes', name: 'Rising arcane motes', description: 'Buoyant light motes drifting upward from the ground.' },
  ],
  vortex: [
    { id: 'arcane_funnel', name: 'Spatial funnel', description: '3D conical spiral pulling motes inward and upward.' },
    { id: 'flame_cyclone', name: 'Firestorm cyclone', description: 'Whirling column of fire and ascending cinders.' },
    { id: 'maelstrom', name: 'Tidal maelstrom', description: 'Swirling whirlpool with foaming spray and inward pull.' },
    { id: 'gravity_well', name: 'Singularity well', description: 'Contracting dark-core vortex bending light inward.' },
    { id: 'astral_spiral', name: 'Astral cyclone', description: 'Twin counter-rotating starlight funnels.' },
  ],
  portal: [
    { id: 'arcane_gate', name: 'Arcane transit gate', description: 'Vertical elliptical doorway with opening, interior swirl, and closing.' },
    { id: 'feywild_ring', name: 'Feywild arch', description: 'Living luminous portal ringed with drifting motes.' },
    { id: 'shadow_rift', name: 'Umbral rift', description: 'Jagged vertical tear into shadow with curling dark wisps.' },
    { id: 'hellfire_maw', name: 'Infernal gateway', description: 'Burning vertical threshold with ember bursts.' },
    { id: 'astral_tear', name: 'Astral aperture', description: 'Star-filled dimensional window with geometric rim.' },
  ],
  orbit: [
    { id: 'spirit_blades', name: 'Orbiting blades', description: 'Glowing spectral weapons spinning around the anchor.' },
    { id: 'earth_stones', name: 'Orbiting boulders', description: 'Floating rock fragments circling at varied heights.' },
    { id: 'star_crown', name: 'Crown of stars', description: 'Seven radiant star-motes orbiting overhead.' },
    { id: 'wisp_lanterns', name: 'Spirit guardians', description: 'Ethereal spirits circling in a protective ring.' },
    { id: 'runic_shards', name: 'Arcane shards', description: 'Spinning crystal prisms orbiting the subject.' },
  ],
  slash: [
    { id: 'crescent_cleave', name: 'Crescent cleave', description: 'Wide horizontal curved weapon sweep with trailing edge glow.' },
    { id: 'cross_slash', name: 'Twin cross slash', description: 'Intersecting X-shaped weapon arcs.' },
    { id: 'overhead_slam', name: 'Overhead cleave', description: 'Vertical downward weapon arc with ground shock.' },
    { id: 'whirlwind_arc', name: 'Whirlwind 360 sweep', description: 'Full circular blade tornado around the wielder.' },
    { id: 'piercing_lunge', name: 'Piercing thrust', description: 'Focused forward thrust with sonic wake rings.' },
  ],
  symbol: [
    { id: 'hunters_crest', name: 'Hunter crest mark', description: 'Predatory floating glyph hovering above the target.' },
    { id: 'hex_brand', name: 'Curse / hex glyph', description: 'Ominous rotating sigil suspended over the victim.' },
    { id: 'divine_halo_glyph', name: 'Sacred brand', description: 'Radiant celestial emblem shining overhead.' },
    { id: 'blood_sigil', name: 'Crimson mark', description: 'Pulsing geometric blood-ward floating in midair.' },
    { id: 'ancient_rune', name: 'Luminary script', description: 'Floating arcane calligraphy orbiting the subject.' },
  ],
  eruption: [
    { id: 'stone_spikes', name: 'Erupting stone spikes', description: 'Jagged rock pillars bursting upward from ground cracks.' },
    { id: 'grasping_roots', name: 'Erupting briar roots', description: 'Gnarled roots and vines breaking through the floor.' },
    { id: 'magma_fissure', name: 'Volcanic fissure', description: 'Glowing ground cracks venting lava and cinders.' },
    { id: 'ice_spires', name: 'Glacial spikes', description: 'Sharp crystalline icicles thrusting out of the ground.' },
    { id: 'eldritch_tendrils', name: 'Void tendrils', description: 'Dark tentacles lashing upward from a ground breach.' },
  ],
  distortion: [
    { id: 'heat_shimmer', name: 'Heat refraction', description: 'Shimmering thermal air wave warping light.' },
    { id: 'psychic_ripple', name: 'Psychic mind wave', description: 'Concentric cerebral distortion rings.' },
    { id: 'gravity_lens', name: 'Gravitational lens', description: 'Spherical spatial warp bending surrounding trajectories.' },
    { id: 'chrono_warp', name: 'Time dilation field', description: 'Stutter-stepped temporal rings and clockwork motes.' },
    { id: 'void_refraction', name: 'Reality fracture', description: 'Prismatic spatial fractures around the target.' },
  ],
  trail: [
    { id: 'silk_ribbon', name: 'Tapered trail ribbon', description: 'Independent flowing shader ribbon following the flight path.' },
    { id: 'ember_wake', name: 'Scorching ember wake', description: 'Glowing trail shedding drifting sparks along the trajectory.' },
    { id: 'spinning_tooth', name: 'Object projectile (Tooth / Blade)', description: 'Spinning physical projectile with wake ribbon.' },
    { id: 'stone_debris', name: 'Flying stone debris', description: 'Scattered rock and earthen fragments flung outward.' },
    { id: 'ice_fragments', name: 'Shattered ice debris', description: 'Tumbling crystalline fragments with frost trails.' },
  ],
  sound: [
    { id: 'arcane_chime', name: 'Arcane resonance chime', description: 'Crystalline harmonic chord with sonic wave rings.' },
    { id: 'fire_roar', name: 'Ignition & flame roar', description: 'Deep combustion whoosh and crackling heat wave.' },
    { id: 'thunder_crack', name: 'Thunderclap boom', description: 'Sharp acoustic shockwave and low rumble.' },
    { id: 'frost_shatter', name: 'Crystalline ice chime', description: 'High-frequency freeze and shatter acoustics.' },
    { id: 'eldritch_hum', name: 'Void & eldritch pulse', description: 'Sub-bass warlock hum and resonant overtones.' },
  ],
};

export interface ExtractedCatalogSpec {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: string;
  variant: string;
  anchor: 'caster' | 'target' | 'path';
  color: string;
  secondaryColor: string;
  size: number;
  duration: number;
  cinematicStyle?: 'beam' | 'cone' | 'column' | 'nova' | 'cube';
  cinematicElement?: 'force' | 'fire' | 'ice' | 'gas' | 'radiant' | 'lightning' | 'acid' | 'shadow';
}

export const EXTRACTED_CORE_PRESET_SPECS: readonly ExtractedCatalogSpec[] = [
  { id: 'ext:sky-projectile', title: 'Sky Ball Projectile (Fireball)', description: '3D ball/meteor projectile descending from the sky with adjustable sky origin and target hit point.', category: 'Extracted core layers', kind: 'sky_projectile', variant: 'fireball', anchor: 'target', color: '#ff5b16', secondaryColor: '#fff1bd', size: 24, duration: 1350 },
  { id: 'ext:sky-beam', title: 'Sky Beam (Divine Smite)', description: 'Heavenly beam descending from the sky with adjustable sky origin, hit offset, width, and wave.', category: 'Extracted core layers', kind: 'sky_beam', variant: 'divine_smite', anchor: 'target', color: '#ffd978', secondaryColor: '#ffffff', size: 22, duration: 1300 },
  { id: 'ext:sky-lightning', title: 'Sky Lightning Strike', description: 'After Effects-style sky lightning with customizable arcs, branches, jaggedness, core color, and outer emitter.', category: 'Extracted core layers', kind: 'sky_lightning', variant: 'thunderbolt', anchor: 'target', color: '#7ab8ff', secondaryColor: '#ffffff', size: 18, duration: 1150 },
  { id: 'ext:projectile', title: 'Projectile', description: 'Independent curved or straight glowing spell projectile.', category: 'Extracted core layers', kind: 'projectile', variant: 'orb', anchor: 'path', color: '#ff7a2e', secondaryColor: '#fff2c2', size: 12, duration: 1100 },
  { id: 'ext:volley', title: 'Projectile Volley', description: 'Staggered multi-projectile barrage with spread and curved paths.', category: 'Extracted core layers', kind: 'projectile', variant: 'swarm', anchor: 'path', color: '#b48cff', secondaryColor: '#f3ebff', size: 9, duration: 1400 },
  { id: 'ext:object-proj', title: 'Object Projectile', description: 'Spinning physical projectile (tooth, dagger, or stone) along the path.', category: 'Extracted core layers', kind: 'trail', variant: 'spinning_tooth', anchor: 'path', color: '#f2e8d5', secondaryColor: '#7be8b5', size: 14, duration: 1100 },
  { id: 'ext:trail', title: 'Trail', description: 'Independent tapered shader ribbon following any projectile path.', category: 'Extracted core layers', kind: 'trail', variant: 'silk_ribbon', anchor: 'path', color: '#5ce6b5', secondaryColor: '#e0fff4', size: 10, duration: 1200 },
  { id: 'ext:beam', title: 'Beam', description: 'Focused cinematic energy beam with adjustable size and duration.', category: 'Extracted core layers', kind: 'beam', variant: 'straight', anchor: 'path', color: '#45f0c1', secondaryColor: '#e8fff8', size: 9, duration: 1000, cinematicStyle: 'beam', cinematicElement: 'force' },
  { id: 'ext:cone-spray', title: 'Cone Spray', description: 'Configurable elemental cone spray without hardcoded fire.', category: 'Extracted core layers', kind: 'cone', variant: 'frost', anchor: 'caster', color: '#78e6ff', secondaryColor: '#ebfcff', size: 65, duration: 1500, cinematicStyle: 'cone', cinematicElement: 'ice' },
  { id: 'ext:energy-col', title: 'Energy Column', description: 'Vertical pillar of radiant or arcane energy (Luminary Pillar / Healing).', category: 'Extracted core layers', kind: 'burst', variant: 'radial', anchor: 'target', color: '#ffe08a', secondaryColor: '#fff9e6', size: 70, duration: 1600, cinematicStyle: 'column', cinematicElement: 'radiant' },
  { id: 'ext:burst', title: 'Burst', description: 'Radial impact nova with expanding energy rays.', category: 'Extracted core layers', kind: 'burst', variant: 'radial', anchor: 'target', color: '#ff6f2c', secondaryColor: '#fff0bd', size: 85, duration: 1200, cinematicStyle: 'nova', cinematicElement: 'fire' },
  { id: 'ext:box-burst', title: 'Box Burst', description: 'Volumetric cube blast (Thunderwave / cubic area preview).', category: 'Extracted core layers', kind: 'burst', variant: 'cone', anchor: 'caster', color: '#84dcff', secondaryColor: '#eefaff', size: 80, duration: 1100, cinematicStyle: 'cube', cinematicElement: 'force' },
  { id: 'ext:shockwave', title: 'Shockwave', description: 'Independent expanding force ring and ground pressure wave.', category: 'Extracted core layers', kind: 'ring', variant: 'shockwave', anchor: 'target', color: '#9de5ff', secondaryColor: '#ffffff', size: 90, duration: 950 },
  { id: 'ext:cast-charge', title: 'Casting Charge', description: 'Caster invocation gathering motes and swirling energy.', category: 'Extracted core layers', kind: 'aura', variant: 'vortex', anchor: 'caster', color: '#62e5ad', secondaryColor: '#e6fff5', size: 48, duration: 850 },
  { id: 'ext:magic-circle', title: 'Magic Circle', description: 'Unified runic and sigil floor circle with rotating geometry.', category: 'Extracted core layers', kind: 'sigil', variant: 'runic', anchor: 'caster', color: '#b794ff', secondaryColor: '#f2ebff', size: 75, duration: 1800 },
  { id: 'ext:swirl-aura', title: 'Swirling Aura', description: '3D volumetric swirling mantle surrounding caster or target.', category: 'Extracted core layers', kind: 'aura', variant: 'orbit', anchor: 'target', color: '#58e8b6', secondaryColor: '#e3fff5', size: 62, duration: 1700 },
  { id: 'ext:smoke-mist', title: 'Smoke / Mist', description: 'Sustained drifting smoke pool and atmospheric mist.', category: 'Extracted core layers', kind: 'cloud', variant: 'fog', anchor: 'target', color: '#7b8b96', secondaryColor: '#cad6de', size: 85, duration: 2200 },
  { id: 'ext:sparks-embers', title: 'Sparks / Embers', description: 'Independent drifting embers and directional spark streaks.', category: 'Extracted core layers', kind: 'sparks', variant: 'embers', anchor: 'target', color: '#ff9636', secondaryColor: '#fff3c4', size: 8, duration: 1400 },
  { id: 'ext:debris', title: 'Debris', description: 'Flying stone, ice, wood, or charred impact fragments.', category: 'Extracted core layers', kind: 'trail', variant: 'stone_debris', anchor: 'target', color: '#9c8671', secondaryColor: '#ff9848', size: 12, duration: 1300 },
  { id: 'ext:surface-mark', title: 'Surface Mark', description: 'Persistent scorch, frost, acid, or rune ground decal.', category: 'Extracted core layers', kind: 'ground', variant: 'scorched_earth', anchor: 'target', color: '#ff5d1c', secondaryColor: '#362d2a', size: 85, duration: 2600 },
];
