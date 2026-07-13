// Expected class-progression report for the-cheat, asserted by the-cheat.test.ts.

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

/** The full Underhanded Abilities option list, offered when first unlocked (L4). */
export function UNDERHANDED_ABILITIES_OPTIONS(): string[] {
	return [
		'"Creative" Accounting',
		'Exploit Weakness',
		'Feinting Attack',
		"How'd YOU get here?!",
		"I'm Outta Here!",
		'Misdirection',
		'Steal Tempo',
		'Sunder Armor (Heavy)',
		'Sunder Armor (Medium)',
		'Trickshot',
	];
}

export function UNDERHANDED_POOL(): ReportPool {
	return { group: 'Underhanded Abilities', options: UNDERHANDED_ABILITIES_OPTIONS() };
}

// Inlined report spec (the report's claim for The Cheat).
export const REPORT: Report = {
	name: 'The Cheat',
	id: 'the-cheat',
	hitDie: 6,
	startingHp: 10,
	keyAbilities: ['DEX', 'INT'],
	savingThrows: { adv: 'DEX', dis: 'WILL' },
	startingGear: ['Dagger', 'Sling', 'Cheap Hides', 'Chalk'],
	caster: false,
	manaFormula: '',
	subclasses: ['Tools Of The Scoundrel', 'Tools Of The Silent Blade'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Sneak Attack', 'Vicious Opportunist'], pools: [], subclass: [], asi: null },
		{ level: 2, auto: ['Cheat!'], pools: [], subclass: [], asi: null },
		{
			level: 3,
			auto: ['Sneak Attack', "Thieves' Cant"],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Low Blow', 'Sweet Talk'] },
				{
					group: 'Tools Of The Silent Blade',
					options: ['Amidst All This Commotion', 'Leave No Trace'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Quick Read', 'Twist the Blade (1)'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ["THAT'S Not What Happened!", 'Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: ['Sneak Attack'],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Pocket Sand'] },
				{ group: 'Tools Of The Silent Blade', options: ['Cunning Strike'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 9, auto: ['Sneak Attack'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 10,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: ['Sneak Attack'],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Escape Plan'] },
				{ group: 'Tools Of The Silent Blade', options: ['Professional Skulker'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Twist the Blade (2)'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: ['Sneak Attack'],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Heads I Win, Tails You Lose'] },
				{ group: 'Tools Of The Silent Blade', options: ['KILL'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 17, auto: ['Sneak Attack'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 18,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Supreme Execution'], pools: [], subclass: [], asi: 'capstone' },
	],
};
