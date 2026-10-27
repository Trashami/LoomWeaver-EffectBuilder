import {
  AbilityScoreVm,
  CharacterFeatureCardVm,
  CharacterSheetVm,
  CharacterSkillVm,
  CharacterSpellVm,
  EquipmentLoadoutItemVm,
  SavingThrowVm,
} from '../models/character-studio.models';
import {
  CampaignAdjustedRuleVm,
  CharacterSheetActionRowVm,
  STANDARD_COMBAT_ACTIONS,
} from './character-sheet-interactive.service';
export function buildCharacterSheetActionRows(
  sheet: CharacterSheetVm,
  spellMod: number,
  spellDc: number,
): CharacterSheetActionRowVm[] {
  const strMod = sheet.abilities.find((a) => a.code === 'STR')?.modifier ?? 1;
  const dexMod = sheet.abilities.find((a) => a.code === 'DEX')?.modifier ?? 2;
  const weaponMod = Math.max(strMod, dexMod);
  const atkBonus = weaponMod + sheet.proficiencyBonus;
  const spellAtkBonus = spellMod + sheet.proficiencyBonus;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const rows: CharacterSheetActionRowVm[] = [];
  const equippedWeapons = sheet.equipment.filter(
    (e) => e.equipped && (e.slot.toLowerCase().includes('hand') || e.slot.toLowerCase().includes('focus')),
  );
  for (const w of equippedWeapons) {
    const isRanged = w.name.toLowerCase().includes('bow') || w.name.toLowerCase().includes('sling') || w.name.toLowerCase().includes('pistol');
    const diceSides = w.name.toLowerCase().includes('greatsword') || w.name.toLowerCase().includes('warhammer') ? 10 : 8;
    rows.push({
      id: `act-wpn-${w.id}`,
      name: w.name,
      subtitle: `${w.slot} Weapon Attack`,
      filterCategory: 'ATTACK',
      actionSlotCost: 'action',
      rangeLabel: isRanged ? '80/320 ft.' : '5 ft. Reach',
      hitOrDcLabel: fmt(atkBonus),
      attackBonus: atkBonus,
      damageFormula: `1d${diceSides}${fmt(weaponMod)}`,
      damageDiceCount: 1,
      damageDiceSides: diceSides,
      damageBonus: weaponMod,
      damageType: isRanged ? 'Piercing' : 'Slashing / Force',
      notes: w.summary,
      description: `Make a weapon attack with ${w.name}. Rolls 1d20 ${fmt(atkBonus)} to hit and 1d${diceSides} ${fmt(weaponMod)} damage on a landed strike.`,
      campaignRuleNote: `Shadow of the Mountain Rule: Landed strikes with ${w.name} trigger Weapon Mastery and log live telemetry to the active Encounter.`,
    });
  }
  rows.push(
    {
      id: 'act-cantrip-strike',
      name: 'Fire Bolt / Arcane Lance',
      subtitle: 'Evocation Cantrip Attack',
      filterCategory: 'ATTACK',
      actionSlotCost: 'action',
      rangeLabel: '120 ft.',
      hitOrDcLabel: fmt(spellAtkBonus),
      attackBonus: spellAtkBonus,
      damageFormula: '2d10',
      damageDiceCount: 2,
      damageDiceSides: 10,
      damageBonus: 0,
      damageType: 'Fire / Force',
      notes: 'V/S · Scales at Lv.5 (2d10)',
      description: 'Hurl a mote of arcane fire or Anelith force at a creature or object within 120 feet.',
      campaignRuleNote: 'Campaign Rule: Ignites flammable Cinth oil barrels and illuminates 10 ft of VTT dynamic fog of war for 1 round.',
    },
    {
      id: 'act-unarmed',
      name: 'Unarmed Strike',
      subtitle: 'Melee Weapon Attack',
      filterCategory: 'ATTACK',
      actionSlotCost: 'action',
      rangeLabel: '5 ft. Reach',
      hitOrDcLabel: fmt(strMod + sheet.proficiencyBonus),
      attackBonus: strMod + sheet.proficiencyBonus,
      damageFormula: `1d4${fmt(strMod)}`,
      damageDiceCount: 1,
      damageDiceSides: 4,
      damageBonus: strMod,
      damageType: 'Bludgeoning',
      notes: 'Strike, Grapple, or Shove',
      description: `A punch, kick, or forceful strike. Deals damage or initiates Grapple/Shove (DC ${8 + strMod + sheet.proficiencyBonus}).`,
      campaignRuleNote: '2024 & Campaign Rule: Unarmed Strike may deal Bludgeoning damage OR force a STR/DEX save against Grapple or Shove.',
    },
    {
      id: 'act-bonus-misty-step',
      name: 'Misty Step / Fey-Step',
      subtitle: '2nd-Level Bonus Action Teleport',
      filterCategory: 'BONUS ACTION',
      actionSlotCost: 'bonus',
      rangeLabel: '30 ft. Self',
      hitOrDcLabel: 'AUTO',
      attackBonus: spellAtkBonus,
      damageFormula: '30 ft.',
      damageDiceCount: 1,
      damageDiceSides: 20,
      damageBonus: spellMod,
      damageType: 'Teleport',
      notes: 'Bonus Action · No OA',
      description: 'Briefly surrounded by silvery Anelith mist, teleport up to 30 feet to an unoccupied space that you can see.',
      campaignRuleNote: 'Campaign Rule: Does not provoke Opportunity Attacks and bypasses Cinth vampire grapples.',
      limitedUseId: 'lu-fey-step',
      limitedUseMax: 2,
      resetOn: 'Short Rest',
    },
    {
      id: 'act-bonus-second-wind',
      name: 'Tactical Surge / Healing Draught',
      subtitle: 'Bonus Action Recovery',
      filterCategory: 'BONUS ACTION',
      actionSlotCost: 'bonus',
      rangeLabel: 'Self (5 ft.)',
      hitOrDcLabel: fmt(sheet.proficiencyBonus),
      attackBonus: sheet.proficiencyBonus,
      damageFormula: `2d4+${sheet.proficiencyBonus}`,
      damageDiceCount: 2,
      damageDiceSides: 4,
      damageBonus: sheet.proficiencyBonus,
      damageType: 'Healing',
      notes: 'Bonus Action · Restores HP',
      description: 'Draw on reserve stamina or consume a Cinth alchemical draught as a Bonus Action to restore 2d4 + Proficiency Bonus HP.',
      campaignRuleNote: 'Shadow of the Mountain House Rule: Drinking a potion Yourself is a Bonus Action; administering to a downed ally is 1 Action.',
      limitedUseId: 'lu-tactical-surge',
      limitedUseMax: 2,
      resetOn: 'Short Rest',
    },
    {
      id: 'act-react-shield',
      name: 'Shield / Arcane Deflection',
      subtitle: '1st-Level Abjuration Reaction',
      filterCategory: 'REACTION',
      actionSlotCost: 'reaction',
      rangeLabel: 'Self',
      hitOrDcLabel: '+5 AC',
      attackBonus: spellAtkBonus,
      damageFormula: '+5 AC',
      damageDiceCount: 1,
      damageDiceSides: 20,
      damageBonus: 5,
      damageType: 'Abjuration Ward',
      notes: '1 Reaction when hit',
      description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.',
      campaignRuleNote: 'Campaign Telemetry: When triggered against an enemy strike, records an Interrupted Attack or Reduced Damage event in live encounter analytics.',
      spellSlotLevel: 1,
    },
    {
      id: 'act-react-opportunity',
      name: 'Opportunity Attack',
      subtitle: 'Combat Reaction Strike',
      filterCategory: 'REACTION',
      actionSlotCost: 'reaction',
      rangeLabel: '5 ft. Reach',
      hitOrDcLabel: fmt(atkBonus),
      attackBonus: atkBonus,
      damageFormula: `1d8${fmt(weaponMod)}`,
      damageDiceCount: 1,
      damageDiceSides: 8,
      damageBonus: weaponMod,
      damageType: 'Slashing',
      notes: 'Triggered when hostile leaves reach',
      description: 'Make one melee attack as a Reaction when a hostile creature that you can see moves out of your reach.',
      campaignRuleNote: 'Warcaster feat allows casting a 1-Action single-target spell in place of a melee weapon Opportunity Attack.',
    },
    {
      id: 'act-lu-arcane-recovery',
      name: 'Arcane / Anelith Recovery',
      subtitle: 'Class Feature · Limited Use',
      filterCategory: 'LIMITED USE',
      actionSlotCost: 'action',
      rangeLabel: 'Self',
      hitOrDcLabel: `DC ${spellDc}`,
      attackBonus: spellAtkBonus,
      damageFormula: `1d20+${spellMod}`,
      damageDiceCount: 1,
      damageDiceSides: 20,
      damageBonus: spellMod,
      damageType: 'Slot Recovery',
      notes: 'Once per day on Short Rest',
      description: 'Recover expended spell slots with a combined level equal to or less than half your character level (rounded up).',
      campaignRuleNote: 'Near a Luminary or Anelith leyline node, also grants +1d4 temporary HP per slot level recovered.',
      limitedUseId: 'lu-anelith-recovery',
      limitedUseMax: 1,
      resetOn: 'Long Rest',
    },
  );
  return rows;
}
export function buildAbilityRuleVm(ab: AbilityScoreVm): CampaignAdjustedRuleVm {
  const modStr = ab.modifier >= 0 ? `+${ab.modifier}` : `${ab.modifier}`;
  return {
    id: `rule-ab-${ab.code}`,
    categoryLabel: 'Ability Score & Check',
    title: `${ab.label} (${ab.code})`,
    subtitle: `Base Score ${ab.score} · Modifier ${modStr}`,
    castingOrActionTime: 'Ability Check (1d20)',
    rangeOrArea: 'Self',
    componentsOrSlot: `Score ${ab.score}`,
    durationLabel: 'Instantaneous',
    sourceLabel: 'PHB 2024 / Campaign Core',
    damageOrBonusBadge: `${modStr} Check`,
    standardRuleText: `An Ability Check tests your character's innate talent and training in ${ab.label}. Roll 1d20 and add your ${ab.code} modifier (${modStr}).`,
    campaignAdjustedRuleTitle: 'Shadow of the Mountain Campaign Rule',
    campaignAdjustedRuleText: 'Natural 20 on an Ability Check during a Live Session unlocks bonus lore citations in The Loom and records a Critical Success in campaign telemetry.',
    campaignClauseFormula: `WHEN Check(${ab.code}) = 1d20 ${modStr} >= TargetDC THEN Succeed()`,
    tags: [ab.code, `Score ${ab.score}`, 'Ability Check'],
    rollConfig: { category: 'ability', actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: ab.modifier },
  };
}
export function buildSaveRuleVm(sv: SavingThrowVm): CampaignAdjustedRuleVm {
  const modStr = sv.bonus >= 0 ? `+${sv.bonus}` : `${sv.bonus}`;
  return {
    id: `rule-save-${sv.code}`,
    categoryLabel: 'Saving Throw',
    title: `${sv.label} Saving Throw`,
    subtitle: sv.proficient ? 'Proficient Save' : 'Standard Save',
    castingOrActionTime: 'Free / Triggered',
    rangeOrArea: 'Self',
    componentsOrSlot: sv.proficient ? 'Proficiency Included' : 'Raw Ability Mod',
    durationLabel: 'Instantaneous',
    sourceLabel: 'PHB 2024 / Action Studio',
    damageOrBonusBadge: `${modStr} Save`,
    standardRuleText: `A Saving Throw represents an attempt to resist a spell, a trap, a poison, a disease, or a similar threat. Roll 1d20 ${modStr} against the effect's Save DC.`,
    campaignAdjustedRuleTitle: 'Adjusted Campaign Rule (Anelith Ward)',
    campaignAdjustedRuleText: 'In Shadow of the Mountain, rolling a Natural 20 on a Saving Throw against a damaging AoE reduces all incoming damage to 0 and logs a Mitigated Damage event.',
    campaignClauseFormula: `WHEN Save(${sv.code}) = 1d20 ${modStr} >= SpellSaveDC THEN ResistEffect()`,
    tags: [`${sv.code} Save`, sv.proficient ? 'Proficient' : 'Unproficient', 'Defense'],
    rollConfig: { category: 'save', actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: sv.bonus },
  };
}
export function buildSkillRuleVm(sk: CharacterSkillVm): CampaignAdjustedRuleVm {
  const modStr = sk.bonus >= 0 ? `+${sk.bonus}` : `${sk.bonus}`;
  return {
    id: `rule-skill-${sk.id}`,
    categoryLabel: `Skill Check (${sk.abilityCode})`,
    title: sk.label,
    subtitle: `${sk.abilityCode} Skill · Passive ${10 + sk.bonus}`,
    castingOrActionTime: '1 Action (Study / Search / Influence)',
    rangeOrArea: 'Self / 30 ft.',
    componentsOrSlot: sk.proficient ? 'Proficient (+Prof Bonus)' : 'Unproficient',
    durationLabel: 'Instantaneous',
    sourceLabel: 'PHB 2024 / Campaign Lore Rules',
    damageOrBonusBadge: `${modStr} Bonus`,
    standardRuleText: `Make a ${sk.abilityCode} (${sk.label}) check by rolling 1d20 ${modStr}. Passive ${sk.label} score is ${10 + sk.bonus}.`,
    campaignAdjustedRuleTitle: 'Campaign Adjustment (Shadow of the Mountain)',
    campaignAdjustedRuleText:
      sk.label === 'History' || sk.label === 'Arcana' || sk.label === 'Perception'
        ? 'Kildrid Stone-Sense & Edhellain lineage grant automatic Advantage when inspecting dwarven runes, Priors Chokrah ledgers, or subterranean stonework.'
        : `During active combat encounters, using ${sk.label} via Study, Search, or Influence consumes 1 Action unless granted as a Bonus Action by class features.`,
    campaignClauseFormula: `ROLL 1d20 ${modStr} (Passive: ${10 + sk.bonus})`,
    tags: [sk.abilityCode, sk.proficient ? 'Proficient' : 'Standard', `Passive ${10 + sk.bonus}`],
    rollConfig: { category: 'skill', actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: sk.bonus },
  };
}
export function buildActionRowRuleVm(row: CharacterSheetActionRowVm): CampaignAdjustedRuleVm {
  return {
    id: row.id,
    categoryLabel: row.subtitle,
    title: row.name,
    subtitle: `${row.filterCategory} · ${row.rangeLabel}`,
    castingOrActionTime: row.actionSlotCost === 'bonus' ? '1 Bonus Action' : row.actionSlotCost === 'reaction' ? '1 Reaction' : '1 Action',
    rangeOrArea: row.rangeLabel,
    componentsOrSlot: row.limitedUseMax ? `Limited Use (${row.limitedUseMax}/${row.resetOn})` : row.spellSlotLevel ? `Lv.${row.spellSlotLevel} Slot` : 'At-Will',
    durationLabel: 'Instantaneous',
    sourceLabel: 'Action Studio Campaign Catalog',
    damageOrBonusBadge: `${row.hitOrDcLabel} | ${row.damageFormula} ${row.damageType}`,
    standardRuleText: row.description,
    campaignAdjustedRuleTitle: 'Adjusted Rule for This Campaign',
    campaignAdjustedRuleText: row.campaignRuleNote,
    campaignClauseFormula: `CONSUMES(${row.actionSlotCost.toUpperCase()}) -> ROLL(1d20 + ${row.attackBonus}) -> DMG(${row.damageFormula} ${row.damageType})`,
    tags: [row.filterCategory, row.damageType, row.rangeLabel],
    rollConfig: {
      category: row.filterCategory === 'ATTACK' ? 'attack' : 'feature',
      actionSlotCost: row.actionSlotCost,
      diceSides: 20,
      diceCount: 1,
      modifier: row.attackBonus,
      damageDiceCount: row.damageDiceCount,
      damageDiceSides: row.damageDiceSides,
      damageBonus: row.damageBonus,
      damageType: row.damageType,
      spellSlotLevel: row.spellSlotLevel,
      limitedUseId: row.limitedUseId,
    },
  };
}
export function buildSpellRuleVm(sp: CharacterSpellVm, spellAtkBonus: number, spellDc: number): CampaignAdjustedRuleVm {
  const isCantrip = (sp.level ?? 0) === 0;
  const costStr = (sp.actionCost ?? '1 Action').toLowerCase();
  const cost: 'action' | 'bonus' | 'reaction' = costStr.includes('bonus') ? 'bonus' : costStr.includes('reaction') ? 'reaction' : 'action';
  const rng = sp.range ?? '60 ft.';
  return {
    id: `rule-spell-${sp.id}`,
    categoryLabel: isCantrip ? `${sp.school} Cantrip` : `Level ${sp.level} ${sp.school} Spell`,
    title: sp.name,
    subtitle: `${sp.actionCost} · ${rng}`,
    castingOrActionTime: sp.actionCost,
    rangeOrArea: rng,
    componentsOrSlot: isCantrip ? 'At-Will (0 Slot)' : `Consumes 1 Level ${sp.level} Spell Slot`,
    durationLabel: sp.concentration ? 'Concentration, up to 1 min' : (sp.duration ?? 'Instantaneous'),
    sourceLabel: '5e Compendium & Action Studio',
    damageOrBonusBadge: `Hit +${spellAtkBonus} / DC ${spellDc}`,
    standardRuleText: `${sp.summary} (${sp.school}). Requires ${sp.actionCost} within ${rng}. Spell Attack Bonus +${spellAtkBonus}, Spell Save DC ${spellDc}.`,
    campaignAdjustedRuleTitle: 'Campaign Spellcasting & Slot Rule',
    campaignAdjustedRuleText: isCantrip
      ? `Cantrips scale automatically with character level and consume ${cost === 'bonus' ? '1 Bonus Action' : '1 Action'} without expending a spell slot.`
      : `Casting ${sp.name} automatically expends ${cost === 'bonus' ? '1 Bonus Action' : cost === 'reaction' ? '1 Reaction' : '1 Action'} and 1 Level ${sp.level} Spell Slot. Preparing/replacing leveled spells requires Long Rest meditation.`,
    campaignClauseFormula: `CAST(${sp.name}) -> CONSUME(${cost.toUpperCase()}${isCantrip ? '' : `, SLOT_LV_${sp.level}`}) -> ROLL(1d20 + ${spellAtkBonus})`,
    tags: [sp.school, isCantrip ? 'Cantrip' : `Level ${sp.level}`, sp.concentration ? 'Concentration' : 'Instant'],
    rollConfig: {
      category: 'spell-attack',
      actionSlotCost: cost,
      diceSides: 20,
      diceCount: 1,
      modifier: spellAtkBonus,
      damageDiceCount: isCantrip ? 2 : (sp.level ?? 1) + 1,
      damageDiceSides: 8,
      damageBonus: 0,
      damageType: 'Arcane / Force',
      spellSlotLevel: isCantrip ? undefined : (sp.level ?? 1),
    },
  };
}
export function buildCombatActionRuleVm(ca: (typeof STANDARD_COMBAT_ACTIONS)[number], mod: number): CampaignAdjustedRuleVm {
  return {
    id: ca.id,
    categoryLabel: 'Action in Combat',
    title: ca.name,
    subtitle: `Consumes 1 ${ca.cost === 'bonus' ? 'Bonus Action' : ca.cost === 'reaction' ? 'Reaction' : 'Action'}`,
    castingOrActionTime: `1 ${ca.cost === 'bonus' ? 'Bonus Action' : ca.cost === 'reaction' ? 'Reaction' : 'Action'}`,
    rangeOrArea: 'Combat Space',
    componentsOrSlot: ca.cost.toUpperCase(),
    durationLabel: '1 Turn',
    sourceLabel: 'PHB 2024 Combat Rules',
    damageOrBonusBadge: `1 ${ca.cost}`,
    standardRuleText: ca.summary,
    campaignAdjustedRuleTitle: 'Adjusted Rule for This Campaign',
    campaignAdjustedRuleText: ca.campaignAdjustment,
    campaignClauseFormula: `ACTION_ECONOMY.CONSUME(${ca.cost.toUpperCase()})`,
    tags: ['Combat Action', ca.cost.toUpperCase(), 'VTT Synced'],
    rollConfig: { category: 'combat-action', actionSlotCost: ca.cost, diceSides: 20, diceCount: 1, modifier: mod },
  };
}
export function buildFeatureOrItemRuleVm(
  item: CharacterFeatureCardVm | EquipmentLoadoutItemVm,
  kind: 'feature' | 'item',
  mod: number,
): CampaignAdjustedRuleVm {
  const isFeat = kind === 'feature';
  const f = item as CharacterFeatureCardVm;
  const e = item as EquipmentLoadoutItemVm;
  return {
    id: `rule-${kind}-${item.id}`,
    categoryLabel: isFeat ? f.category.toUpperCase() : `Equipment (${e.slot})`,
    title: isFeat ? f.title : e.name,
    subtitle: isFeat ? f.category.toUpperCase() : e.equipped ? 'Equipped on Character' : 'Stowed in Backpack',
    castingOrActionTime: '1 Action / Passive',
    rangeOrArea: 'Self / Reach',
    componentsOrSlot: isFeat ? 'Class / Ancestry Trait' : `${e.weightLb ?? 2} lbs · ${e.rarity ?? 'Common'}`,
    durationLabel: 'Continuous / Instant',
    sourceLabel: 'Shadow of the Mountain Compendium',
    damageOrBonusBadge: isFeat ? 'Trait Check' : e.slot,
    standardRuleText: isFeat ? f.summary : e.summary,
    campaignAdjustedRuleTitle: 'Campaign Integration & Lore Rule',
    campaignAdjustedRuleText: isFeat
      ? 'This trait integrates directly with VTT lighting, saving throws, and The Loom knowledge citations.'
      : `Items equipped in ${e.slot} automatically update Armor Class, attack rows, and encumbrance across Character Sheet and Edit Character.`,
    tags: isFeat ? [f.category, 'Trait'] : [e.slot, e.rarity ?? 'Standard', e.equipped ? 'Equipped' : 'Backpack'],
    rollConfig: { category: 'feature', actionSlotCost: 'none', diceSides: 20, diceCount: 1, modifier: mod },
  };
}
