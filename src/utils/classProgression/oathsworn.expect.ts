// Expected class-progression report for oathsworn, asserted by oathsworn.test.ts.

export interface ReportPool {
	group: string;
	options: string[];
}
export interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: { group: string; options: string[] }[];
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

// Embedded copy of expectations/oathsworn.json (source of truth).
export const REPORT: Report = {
	name: 'Oathsworn',
	id: 'oathsworn',
	hitDie: 10,
	startingHp: 17,
	keyAbilities: ['STR', 'WILL'],
	savingThrows: {
		adv: 'STR',
		dis: 'DEX',
	},
	startingGear: ['Mace', 'Rusty Mail', 'Wooden Buckler', 'Manacles'],
	caster: true,
	manaFormula: 'max(@will, 0) + @level',
	levels: [
		{
			level: 1,
			auto: ['Lay on Hands', 'Radiant Judgement'],
			pools: [],
			subclass: [
				{
					group: 'Oathbreaker',
					options: ['Aura of Suffering'],
				},
			],
			asi: null,
		},
		{
			level: 2,
			auto: ['Mana and Radiant Spellcasting', 'Paragon of Virtue', 'Zealot'],
			pools: [],
			subclass: [
				{
					group: 'Oathbreaker',
					options: ['Dark Benediction', 'Paragon of Power'],
				},
			],
			asi: null,
		},
		{
			level: 3,
			auto: ['Radiant Judgement', 'Sacred Decree'],
			pools: [
				{
					group: 'Sacred Decree',
					options: [
						'Blinding Aura',
						'Courage!',
						'Explosive Judgment',
						'Improved Aura',
						'Radiant Aura',
						'Reliable Justice',
						'Shining Mandate',
						'Stand Fast, Friends!',
						'Unstoppable Protector',
						'Well Armored',
					],
				},
			],
			subclass: [
				{
					group: 'Oath Of Refuge',
					options: ['Aura of Refuge'],
				},
				{
					group: 'Oath Of Vengeance',
					options: ['Aura of Zeal'],
				},
				{
					group: 'Oathbreaker',
					options: ['Bring Me Your Pain', 'We All Suffer'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Mana and Radiant Spellcasting', 'My Life, for My Friends'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Radiant Judgement'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Mana and Radiant Spellcasting', 'Sacred Decree'],
			pools: [
				{
					group: 'Sacred Decree',
					options: [
						'Blinding Aura',
						'Courage!',
						'Explosive Judgment',
						'Improved Aura',
						'Radiant Aura',
						'Reliable Justice',
						'Shining Mandate',
						'Stand Fast, Friends!',
						'Unstoppable Protector',
						'Well Armored',
					],
				},
			],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: ['Master of Radiance'],
			pools: [],
			subclass: [
				{
					group: 'Oath Of Refuge',
					options: ['Face Me, Foul Creature!'],
				},
				{
					group: 'Oath Of Vengeance',
					options: ['Avenger'],
				},
				{
					group: 'Oathbreaker',
					options: ['Torment'],
				},
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Mana and Radiant Spellcasting', 'Radiant Judgement'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Sacred Decree'],
			pools: [
				{
					group: 'Sacred Decree',
					options: [
						'Blinding Aura',
						'Courage!',
						'Explosive Judgment',
						'Improved Aura',
						'Radiant Aura',
						'Reliable Justice',
						'Shining Mandate',
						'Stand Fast, Friends!',
						'Unstoppable Protector',
						'Well Armored',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 10,
			auto: ['Mana and Radiant Spellcasting', 'Radiant Judgement'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: ['Master of Radiance'],
			pools: [],
			subclass: [
				{
					group: 'Oath Of Refuge',
					options: ['Glorious Reprieve'],
				},
				{
					group: 'Oath Of Vengeance',
					options: ['Unerring Judgment'],
				},
				{
					group: 'Oathbreaker',
					options: ['Exploit'],
				},
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Sacred Decree'],
			pools: [
				{
					group: 'Sacred Decree',
					options: [
						'Blinding Aura',
						'Courage!',
						'Explosive Judgment',
						'Improved Aura',
						'Radiant Aura',
						'Reliable Justice',
						'Shining Mandate',
						'Stand Fast, Friends!',
						'Unstoppable Protector',
						'Well Armored',
					],
				},
			],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 13,
			auto: ['Mana and Radiant Spellcasting'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 14,
			auto: ['Radiant Judgement', 'Sacred Decree'],
			pools: [
				{
					group: 'Sacred Decree',
					options: [
						'Blinding Aura',
						'Courage!',
						'Explosive Judgment',
						'Improved Aura',
						'Radiant Aura',
						'Reliable Justice',
						'Shining Mandate',
						'Stand Fast, Friends!',
						'Unstoppable Protector',
						'Well Armored',
					],
				},
			],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{
					group: 'Oath Of Refuge',
					options: ['Divine Grace'],
				},
				{
					group: 'Oath Of Vengeance',
					options: ['Maximum Judgment'],
				},
				{
					group: 'Oathbreaker',
					options: ['Bloody Terror'],
				},
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Sacred Decree'],
			pools: [
				{
					group: 'Sacred Decree',
					options: [
						'Blinding Aura',
						'Courage!',
						'Explosive Judgment',
						'Improved Aura',
						'Radiant Aura',
						'Reliable Justice',
						'Shining Mandate',
						'Stand Fast, Friends!',
						'Unstoppable Protector',
						'Well Armored',
					],
				},
			],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 17,
			auto: ['Mana and Radiant Spellcasting'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 18,
			auto: ['Unending Judgment'],
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
			auto: ['Glorious Paragon'],
			pools: [],
			subclass: [],
			asi: 'capstone',
		},
	],
	subclasses: ['Oath Of Refuge', 'Oath Of Vengeance', 'Oathbreaker'],
	subclassSelectLevel: 1,
};
