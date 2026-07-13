// Expected class-progression report for shepherd, asserted by shepherd.test.ts.

export interface ReportPool {
	group: string;
	options: string[];
}
export interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: unknown[];
	asi: string | null;
}

// The eight sacred-grace options, per the expectation report.
export const SACRED_GRACE_OPTIONS = [
	'Assist Me, My Friend!',
	'Empowered Companion',
	'Guiding Spirit',
	'Hasty Companion',
	'Illuminate Soul',
	'Light Bearer',
	'Not Beyond MY Reach',
	'Vengeful Spirit',
];

// Embedded copy of scratchpad/expectations/shepherd.json (source of truth).
export const REPORT = {
	name: 'Shepherd',
	id: 'shepherd',
	hitDie: 10,
	startingHp: 17,
	keyAbilities: ['STR', 'WILL'],
	savingThrows: { adv: 'WILL', dis: 'DEX' },
	startingGear: ['Rusty Mail', 'Mace', 'Wooden Buckler', 'Bell'],
	caster: true,
	manaFormula: '(max(@will, 0) * 3) + @level',
	subclasses: ['Luminary Of Malice', 'Luminary Of Mercy'],
	subclassSelectLevel: 3,
	levels: [
		{
			level: 1,
			auto: ['Keeper of Life & Death', 'Searing Light'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 2,
			auto: ['Lifebinding Spirit', 'Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{ level: 3, auto: ['Master of Twilight'], pools: [], subclass: [{}, {}], asi: null },
		{ level: 4, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{
			level: 5,
			auto: ['Sacred Graces'],
			pools: [{ group: 'Sacred Grace', options: SACRED_GRACE_OPTIONS }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Mana and Unlock Tier 1 Spells', 'Master of Twilight'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{ level: 7, auto: [], pools: [], subclass: [{}, {}], asi: null },
		{ level: 8, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{
			level: 9,
			auto: ['Sacred Graces'],
			pools: [{ group: 'Sacred Grace', options: SACRED_GRACE_OPTIONS }],
			subclass: [],
			asi: 'secondary',
		},
		{ level: 10, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: null },
		{ level: 11, auto: ['Master of Twilight'], pools: [], subclass: [{}, {}], asi: null },
		{ level: 12, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{
			level: 13,
			auto: ['Sacred Graces'],
			pools: [{ group: 'Sacred Grace', options: SACRED_GRACE_OPTIONS }],
			subclass: [],
			asi: 'secondary',
		},
		{ level: 14, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: null },
		{ level: 15, auto: [], pools: [], subclass: [{}, {}], asi: null },
		{ level: 16, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{ level: 17, auto: ['Revitalizing Blessing'], pools: [], subclass: [], asi: 'secondary' },
		{ level: 18, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: null },
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Twilight Sage'], pools: [], subclass: [], asi: 'capstone' },
	] as ReportLevel[],
};
