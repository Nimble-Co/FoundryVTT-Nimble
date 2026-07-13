// Expected class-progression report for zephyr, asserted by zephyr.test.ts.

import type { Report, ReportPool } from '../../../tests/fixtures/classProgression.types.ts';

export function MARTIAL_ARTS_ABILITY_OPTIONS(): string[] {
	return [
		'Airshift',
		'Blur',
		'Bodily Discipline',
		'Enduring Soul',
		'I Jump On His Back!',
		'Kinetic Barrage',
		'Mighty Soul',
		'Quickstrike',
		'Use Momentum',
		'Vital Rejuvenation',
		'Windstrider',
	];
}

export function MARTIAL_ARTS_POOL(): ReportPool {
	return { group: 'Martial Arts Ability', options: MARTIAL_ARTS_ABILITY_OPTIONS() };
}

// Inlined report spec (the report's claim for Zephyr).
export const REPORT: Report = {
	name: 'Zephyr',
	id: 'zephyr',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['STR', 'DEX'],
	savingThrows: { adv: 'DEX', dis: 'INT' },
	startingGear: ['Staff', 'Traveling Robes & Sandals'],
	caster: false,
	manaFormula: '',
	subclasses: ['Way Of Flame', 'Way Of Pain'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Iron Defense', 'Swift Fists'], pools: [], subclass: [], asi: null },
		{ level: 2, auto: ['Burst of Speed', 'Swift Feet'], pools: [], subclass: [], asi: null },
		{
			level: 3,
			auto: ['Ethereal Projection', 'Kinetic Momentum'],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Exploding Soul'] },
				{ group: 'Way Of Pain', options: ['Bring the Pain'] },
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Martial Arts Ability', 'Unyielding Resolve'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 5, auto: ['Reverberating Strikes'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 6,
			auto: ['Infuse Strength', 'Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Blazing Speed'] },
				{ group: 'Way Of Pain', options: ['Share My Pain'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 9, auto: ['Swift Feet'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 10,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Chain Reaction'] },
				{ group: 'Way Of Pain', options: ['Pain Sharpens the Mind'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Iron Defense'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Burning Soul'] },
				{ group: 'Way Of Pain', options: ['Echoed Agony'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 17, auto: [], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 18,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Windborne'], pools: [], subclass: [], asi: 'capstone' },
	],
};
