// Expected class-progression report for songweaver, asserted by songweaver.test.ts.

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

// Embedded copy of expectations/songweaver.json (source of truth).
export const REPORT: Report = {
	name: 'Songweaver',
	id: 'songweaver',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['WILL', 'INT'],
	savingThrows: {
		adv: 'WILL',
		dis: 'STR',
	},
	startingGear: ["Adventurer's Garb", 'Instrument', 'Dagger', 'Mirror'],
	caster: true,
	manaFormula: '(max(@intelligence, 0) * 3) + @level',
	levels: [
		{
			level: 1,
			auto: ["Songweaver's Inspiration", 'Wind Spellcasting and...'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 2,
			auto: ['Jack of All Trades', 'Mana and Unlock Tier 1 Spells', 'Song of Rest'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Quick Wit', 'Windbag'],
			pools: [],
			subclass: [
				{
					group: 'Herald Of Courage',
					options: ['Inspiring Presence'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Opportunistic Snark'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Lyrical Weaponry', 'Mana and Unlock Tier 1 Spells'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['A People Person'],
			pools: [
				{
					group: 'A People Person',
					options: [
						'Gran Gran (NOT a hag)',
						'Linos, the Everfriendly',
						'Mal, the Malevolent Imp',
						'Stompy',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Mana and Unlock Tier 1 Spells'],
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
					group: 'Herald Of Courage',
					options: ['Unfailing Courage'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Fight Picker'],
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
			auto: ['Lyrical Weaponry'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
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
				{
					group: 'Herald Of Courage',
					options: ['Fire in my Bones'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Chord of Chaos'],
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
			auto: ['Lyrical Weaponry'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
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
				{
					group: 'Herald Of Courage',
					options: ['Chorus of Champions'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Words Like Swords'],
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
			auto: ['Lyrical Weaponry'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
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
			auto: ["I'm So Famous!"],
			pools: [],
			subclass: [],
			asi: 'capstone',
		},
	],
	subclasses: ['Herald Of Courage', 'Herald Of Snark'],
	subclassSelectLevel: 3,
};
