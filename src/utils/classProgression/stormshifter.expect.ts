// Expected class-progression report for stormshifter, asserted by stormshifter.test.ts.

import type { Report } from '../../../tests/fixtures/classProgression.types.ts';

export function CHIMERIC_BOON_OPTIONS(): string[] {
	return [
		'Beast of the Sea',
		'Climber',
		'Earthwalker',
		'Fleet Footed',
		'Keen Senses',
		'Leader of the Pack',
		'Phasebeast',
		'Prehensile Tail',
		'Winged',
	];
}

// Inlined report spec (the report's claim for Stormshifter).
export const REPORT: Report = {
	name: 'Stormshifter',
	id: 'stormshifter',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['DEX', 'WILL'],
	savingThrows: { adv: 'WILL', dis: 'STR' },
	startingGear: ['Cheap Hides', 'Staff', 'Strange Plant'],
	caster: true,
	manaFormula: '(max(@will, 0) * 3) + @level',
	subclasses: ['Circle Of Fang And Claw', 'Circle Of Sky And Storm'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Beastshift', 'Master of Storms'], pools: [], subclass: [], asi: null },
		{
			level: 2,
			auto: ['Direbeast Form', 'Mana and Unlock Tier 1 Spells'],
			pools: [{ group: 'Direbeast Form', options: ['Fearsome Beast'] }],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Direbeast Form'],
			pools: [{ group: 'Direbeast Form', options: ['Beast of the Pack'] }],
			subclass: [
				{
					group: 'Circle Of Fang And Claw',
					options: ['Friend of Beasts', 'Swiftshift', 'Windborne Protector'],
				},
				{
					group: 'Circle Of Sky And Storm',
					options: ['Attuned to Nature', 'Creature of the Fey', 'Deepening Study'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Mana and Unlock Tier 1 Spells', 'Stormcaller'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Direbeast Form'],
			pools: [{ group: 'Direbeast Form', options: ['Beast of Nightmares'] }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Expert Shifter', 'Mana and Unlock Tier 1 Spells'],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: ['Stormcaller'],
			pools: [],
			subclass: [
				{ group: 'Circle Of Fang And Claw', options: ['Storm Wake', 'Unleash the Beast'] },
				{ group: 'Circle Of Sky And Storm', options: ['Raging Tempest'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Mana and Unlock Tier 1 Spells', 'Stormborn (1)'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Expert Shifter'],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 10,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Circle Of Fang And Claw', options: ['Master of Forms', 'Venomous Gaze'] },
				{ group: 'Circle Of Sky And Storm', options: ['Primordial Force'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Expert Shifter', 'Mana and Unlock Tier 1 Spells'],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Stormborn (2)'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Circle Of Fang And Claw', options: ['Master of Forms (2)'] },
				{ group: 'Circle Of Sky And Storm', options: ['Master of Storm'] },
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
			auto: [],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
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
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Archdruid'], pools: [], subclass: [], asi: 'capstone' },
	],
};
