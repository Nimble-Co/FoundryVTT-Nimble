// Expected class-progression report for mage, asserted by mage.test.ts.

// Embedded copy of expectations/mage.json (source of truth).
import type { Report } from '../../../tests/fixtures/classProgression.types.ts';

export const REPORT: Report = {
	name: 'Mage',
	id: 'mage',
	hitDie: 6,
	startingHp: 10,
	keyAbilities: ['INT', 'WILL'],
	savingThrows: {
		adv: 'INT',
		dis: 'STR',
	},
	startingGear: ["Adventurer's Garb", 'Staff', 'Soap'],
	caster: true,
	manaFormula: '(max(@intelligence, 0) * 3) + @level',
	levels: [
		{
			level: 1,
			auto: ['Elemental Spellcasting'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 2,
			auto: ['Mana and Unlock Tier 1 Spells', 'Talented Researcher'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Elemental Mastery'],
			pools: [],
			subclass: [
				{
					group: 'Invoker Of Chaos',
					options: ['Force of Chaos'],
				},
				{
					group: 'Invoker Of Control',
					options: ['Deny Fate', 'Force of Will'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Mana and Unlock Tier 1 Spells', 'Spell Shaper'],
			pools: [
				{
					group: 'Spellshaper',
					options: [
						'Dimensional Compression',
						'Echo Casting',
						'Elemental Destruction',
						'Elemental Transmutation',
						'Extra-Dimensional Vision',
						'Methodical Spellweaver',
						'Precise Casting',
						'Stretch Time',
					],
				},
			],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Elemental Surge'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Elemental Mastery', 'Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: [],
			pools: [],
			subclass: [
				{
					group: 'Invoker Of Chaos',
					options: ['Chaos Lash', 'Tempest Mage'],
				},
				{
					group: 'Invoker Of Control',
					options: ['At Any Cost', 'Nullify'],
				},
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Spell Shaper'],
			pools: [
				{
					group: 'Spellshaper',
					options: [
						'Dimensional Compression',
						'Echo Casting',
						'Elemental Destruction',
						'Elemental Transmutation',
						'Extra-Dimensional Vision',
						'Methodical Spellweaver',
						'Precise Casting',
						'Stretch Time',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 10,
			auto: ['Elemental Surge', 'Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{
					group: 'Invoker Of Chaos',
					options: ['Thrive in Chaos'],
				},
				{
					group: 'Invoker Of Control',
					options: ['Steel Will'],
				},
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 13,
			auto: ['Spell Shaper'],
			pools: [
				{
					group: 'Spellshaper',
					options: [
						'Dimensional Compression',
						'Echo Casting',
						'Elemental Destruction',
						'Elemental Transmutation',
						'Extra-Dimensional Vision',
						'Methodical Spellweaver',
						'Precise Casting',
						'Stretch Time',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 14,
			auto: ['Elemental Mastery', 'Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{
					group: 'Invoker Of Chaos',
					options: ['Master of Chaos'],
				},
				{
					group: 'Invoker Of Control',
					options: ['Supreme Control'],
				},
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 17,
			auto: ['Elemental Surge'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 18,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 19,
			auto: [],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 20,
			auto: ['Archmage'],
			pools: [],
			subclass: [],
			asi: 'capstone',
		},
	],
	subclasses: [
		'Invoker Of Chaos',
		'Invoker Of Control',
		'Invoker Of Flame',
		'Invoker Of Frost',
		'Invoker Of Surges',
	],
	subclassSelectLevel: 3,
};
