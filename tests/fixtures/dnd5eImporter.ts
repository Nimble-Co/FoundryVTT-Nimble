/**
 * Shared test fixtures: representative 5e monster data
 */

import type { Dnd5eActorJson, Dnd5eStatblock } from '../../src/import/dnd5e/types.js';

// ─── Simple Beast: Wolf ──────────────────────────────────────────────────────

export const WOLF_JSON: Dnd5eActorJson = {
	name: 'Wolf',
	type: 'npc',
	system: {
		abilities: {
			str: { value: 12, mod: 1, proficient: 0 },
			dex: { value: 15, mod: 2, proficient: 0 },
			con: { value: 12, mod: 1, proficient: 0 },
			int: { value: 3, mod: -4, proficient: 0 },
			wis: { value: 12, mod: 1, proficient: 0 },
			cha: { value: 6, mod: -2, proficient: 0 },
		},
		attributes: {
			ac: { flat: 13, calc: 'natural' },
			hp: { value: 11, max: 11, formula: '2d8+2' },
			movement: { walk: 40 },
		},
		traits: {
			size: 'med',
			dr: { value: [] },
			di: { value: [] },
			dv: { value: [] },
			ci: { value: [] },
			languages: { value: [] },
		},
		details: {
			cr: 0.25,
			type: { value: 'beast' },
		},
	},
	items: [
		{
			name: 'Bite',
			type: 'weapon',
			system: {
				actionType: 'mwak',
				attackBonus: '0',
				damage: { parts: [['2d4+2', 'piercing']] },
				range: { value: 5, units: 'ft' },
				activation: { type: 'action', cost: 1 },
				description: {
					value:
						'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.',
				},
			},
		},
	],
};

export const WOLF_TEXT = `Wolf
Medium Beast, Unaligned

Armor Class 13 (natural armor)
Hit Points 11 (2d8 + 2)
Speed 40 ft.

STR     DEX     CON     INT     WIS     CHA
12 (+1) 15 (+2) 12 (+1) 3 (-4)  12 (+1) 6 (-2)

Skills Perception +3, Stealth +4
Senses passive Perception 13
Languages —
Challenge 1/4 (50 XP)

Keen Hearing and Smell. The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.

Pack Tactics. The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally isn't incapacitated.

Actions
Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.`;

// ─── Complex Legendary: Adult Red Dragon ─────────────────────────────────────

export const DRAGON_JSON: Dnd5eActorJson = {
	name: 'Adult Red Dragon',
	type: 'npc',
	system: {
		abilities: {
			str: { value: 27, mod: 8, proficient: 0 },
			dex: { value: 10, mod: 0, proficient: 1 },
			con: { value: 25, mod: 7, proficient: 1 },
			int: { value: 16, mod: 3, proficient: 0 },
			wis: { value: 13, mod: 1, proficient: 1 },
			cha: { value: 21, mod: 5, proficient: 1 },
		},
		attributes: {
			ac: { flat: 19, calc: 'natural' },
			hp: { value: 256, max: 256, formula: '19d12+133' },
			movement: { walk: 40, climb: 40, fly: 80 },
			senses: { blindsight: 60, darkvision: 120 },
		},
		traits: {
			size: 'huge',
			dr: { value: [] },
			di: { value: ['fire'] },
			dv: { value: [] },
			ci: { value: [] },
			languages: { value: ['common', 'draconic'] },
		},
		details: {
			cr: 17,
			type: { value: 'dragon' },
		},
	},
	items: [
		{
			name: 'Multiattack',
			type: 'feat',
			system: {
				activation: { type: 'action', cost: 1 },
				description: {
					value:
						'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
				},
			},
		},
		{
			name: 'Bite',
			type: 'weapon',
			system: {
				actionType: 'mwak',
				attackBonus: '0',
				damage: {
					parts: [
						['2d10+8', 'piercing'],
						['2d6', 'fire'],
					],
				},
				range: { value: 10, units: 'ft' },
				activation: { type: 'action', cost: 1 },
				description: {
					value:
						'Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus 7 (2d6) fire damage.',
				},
			},
		},
		{
			name: 'Claw',
			type: 'weapon',
			system: {
				actionType: 'mwak',
				attackBonus: '0',
				damage: { parts: [['2d6+8', 'slashing']] },
				range: { value: 5, units: 'ft' },
				activation: { type: 'action', cost: 1 },
				description: {
					value:
						'Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.',
				},
			},
		},
		{
			name: 'Fire Breath',
			type: 'feat',
			system: {
				actionType: 'save',
				activation: { type: 'action', cost: 1 },
				recharge: { value: 5, charged: true },
				save: { ability: 'dex', dc: 21 },
				damage: { parts: [['18d6', 'fire']] },
				description: {
					value:
						'The dragon exhales fire in a 60-foot cone. Each creature in that area must make a DC 21 Dexterity saving throw, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.',
				},
			},
		},
		{
			name: 'Tail Attack',
			type: 'weapon',
			system: {
				actionType: 'mwak',
				attackBonus: '0',
				damage: { parts: [['2d8+8', 'bludgeoning']] },
				range: { value: 15, units: 'ft' },
				activation: { type: 'legendary', cost: 1 },
				description: {
					value:
						'Melee Weapon Attack: +14 to hit, reach 15 ft., one target. Hit: 17 (2d8 + 8) bludgeoning damage.',
				},
			},
		},
		{
			name: 'Detect',
			type: 'feat',
			system: {
				activation: { type: 'legendary', cost: 1 },
				description: {
					value: 'The dragon makes a Wisdom (Perception) check.',
				},
			},
		},
	],
};

export const DRAGON_TEXT = `Adult Red Dragon
Huge Dragon, Chaotic Evil

Armor Class 19 (natural armor)
Hit Points 256 (19d12 + 133)
Speed 40 ft., climb 40 ft., fly 80 ft.

STR     DEX     CON     INT     WIS     CHA
27 (+8) 10 (+0) 25 (+7) 16 (+3) 13 (+1) 21 (+5)

Saving Throws Dex +6, Con +13, Wis +7, Cha +11
Skills Perception +13, Stealth +6
Damage Immunities fire
Senses blindsight 60 ft., darkvision 120 ft., passive Perception 23
Languages Common, Draconic
Challenge 17 (18,000 XP)

Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.

Actions
Multiattack. The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.

Bite. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus 7 (2d6) fire damage.

Claw. Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.

Fire Breath (Recharge 5-6). The dragon exhales fire in a 60-foot cone. Each creature in that area must make a DC 21 Dexterity saving throw, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.

Legendary Actions
The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.

Detect. The dragon makes a Wisdom (Perception) check.

Tail Attack. Melee Weapon Attack: +14 to hit, reach 15 ft., one target. Hit: 17 (2d8 + 8) bludgeoning damage.`;

// ─── Normalized Statblock: Wolf ──────────────────────────────────────────────

export function createWolfStatblock(): Dnd5eStatblock {
	return {
		name: 'Wolf',
		size: 'medium',
		creatureType: 'beast',
		ac: 13,
		acSource: 'natural armor',
		hp: 11,
		hitDice: '2d8+2',
		movement: { walk: 40 },
		abilities: {
			str: { score: 12, mod: 1 },
			dex: { score: 15, mod: 2 },
			con: { score: 12, mod: 1 },
			int: { score: 3, mod: -4 },
			wis: { score: 12, mod: 1 },
			cha: { score: 6, mod: -2 },
		},
		saveProficiencies: [],
		damageResistances: [],
		damageImmunities: [],
		damageVulnerabilities: [],
		conditionImmunities: [],
		senses: ['passive Perception 13'],
		languages: [],
		cr: 0.25,
		xp: 50,
		traits: [
			{
				name: 'Keen Hearing and Smell',
				description:
					'The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
			},
			{
				name: 'Pack Tactics',
				description:
					"The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally isn't incapacitated.",
			},
		],
		actions: [
			{
				name: 'Bite',
				description:
					'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage.',
				parsed: {
					type: 'melee',
					toHit: 4,
					reach: 5,
					targets: 'one target',
					damage: [{ formula: '2d4+2', damageType: 'piercing' }],
				},
			},
		],
		sourceRaw: 'test',
	};
}
