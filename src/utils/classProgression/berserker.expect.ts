// Expected class-progression report for berserker, asserted by berserker.test.ts.

export interface ReportPool {
	group: string;
	options: string[];
}

export interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: ReportPool[];
	asi: string | null;
}

export interface Report {
	name: string;
	id: string;
	hitDie: number;
	startingHp: number;
	keyAbilities: string[];
	savingThrows: { adv: string; dis: string };
	startingGear: string[];
	caster: boolean;
	manaFormula: string;
	subclasses: string[];
	subclassSelectLevel: number;
	levels: ReportLevel[];
}

export function SAVAGE_ARSENAL_OPTIONS(): string[] {
	return [
		'Death Blow',
		'Deathless Rage',
		'Eager for Battle',
		'Into the Fray',
		'Mighty Endurance',
		'MORE BLOOD!',
		'Rampage',
		'Swift Fury',
		'Thunderous Steps',
		'Unstoppable Force',
		'Whirlwind',
		"You're Next!",
	];
}

// Inlined report spec (the report's claim for Berserker).
export const REPORT: Report = {
	name: 'Berserker',
	id: 'berserker',
	hitDie: 12,
	startingHp: 20,
	keyAbilities: ['STR', 'DEX'],
	savingThrows: { adv: 'STR', dis: 'INT' },
	startingGear: ['Battle Axe', 'Rope'],
	caster: false,
	manaFormula: '',
	subclasses: ['Path Of The Mountainheart', 'Path Of The Red Mist'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Rage', 'That all you got?!'], pools: [], subclass: [], asi: null },
		{
			level: 2,
			auto: ['Intensifying Fury', 'One with the Ancients'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Bloodlust'],
			pools: [],
			subclass: [
				{
					group: 'Path Of The Mountainheart',
					options: ['Mountainous Tenacity', "Stone's Resilience"],
				},
				{ group: 'Path Of The Red Mist', options: ['Blood Frenzy', 'Savage Awareness'] },
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Enduring Rage', 'Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 5, auto: ['Rage'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 6,
			auto: ['Intensifying Fury', 'Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Path Of The Mountainheart', options: ['Unbreakable'] },
				{ group: 'Path Of The Red Mist', options: ['Unstoppable Brutality'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 9, auto: ['Intensifying Fury'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 10,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Path Of The Mountainheart', options: ["Titan's Fury"] },
				{ group: 'Path Of The Red Mist', options: ['Opportunistic Frenzy'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Intensifying Fury'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Path Of The Mountainheart', options: ["Mountain's Endurance"] },
				{ group: 'Path Of The Red Mist', options: ['Onslaught'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 17, auto: ['Intensifying Fury'], pools: [], subclass: [], asi: 'secondary' },
		{ level: 18, auto: ['DEEP RAGE'], pools: [], subclass: [], asi: null },
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['BOUNDLESS RAGE'], pools: [], subclass: [], asi: 'capstone' },
	],
};
