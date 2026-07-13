// Expected class-progression report for shadowmancer, asserted by shadowmancer.test.ts.

// Full option pools as claimed by the report.
import type { Report } from '../../../tests/fixtures/classProgression.types.ts';

export const LESSER: string[] = [
	'Abhorrent Speech',
	'Beguiling Influence',
	'Blood Sight',
	'Devoted Acolyte',
	'Eldritch Sense',
	'Gaze of Two Minds',
	'Knowledge from Beyond',
	'My Favored Pet',
	'Voice of the Dark',
	'Whispers of the Grave',
];
export const GREATER: string[] = [
	'Armor of Shadows',
	'Fiendish Boon',
	'Hungering Shadows',
	'One with Shadows',
	'Repelling Blast',
	'Shadow Magus',
	'Shadow Rush',
	'Shadow Spear',
	'Shadow Warp',
	'Swarming Shadows',
	'Vengeful Blast',
];

// The report JSON lives in the scratchpad; inline the values it asserts so the
// test is self-contained and does not depend on a transient path at runtime.
export const report: Report = {
	name: 'Shadowmancer',
	id: 'shadowmancer',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['INT', 'DEX'],
	savingThrows: { adv: 'INT', dis: 'WILL' },
	startingGear: ["Adventurer's Garb", 'Sickle', 'Shovel'],
	caster: true,
	manaFormula: '(max(@dexterity, 0))',
	subclasses: ['Pact Of The Abyssal Depths', 'Pact Of The Red Dragon', 'Reaver'],
	subclassSelectLevel: 1,
	levels: [
		{
			level: 1,
			auto: ['Conduit of Shadow'],
			pools: [],
			subclass: [{ group: 'Reaver', options: ['Bonescythe', 'Hollow One'] }],
			asi: null,
		},
		{
			level: 2,
			auto: ['Master of Darkness', 'Pilfered Power'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['The Pact is Sealed'],
			pools: [{ group: 'Lesser Invocations', options: LESSER }],
			subclass: [
				{ group: 'Pact Of The Abyssal Depths', options: ['Master of Nightfrost'] },
				{ group: 'Pact Of The Red Dragon', options: ['Draconic Crimson Rite'] },
				{ group: 'Reaver', options: ['Martyr Spawn', 'Shadow Exploit'] },
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Gift from the Master'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 5, auto: ['Master of Darkness'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 6,
			auto: ['Gift from the Master', 'Shadowmastery'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: ['Master of Darkness'],
			pools: [],
			subclass: [
				{ group: 'Pact Of The Abyssal Depths', options: ['Shadowfrost'] },
				{ group: 'Pact Of The Red Dragon', options: ["We'll ALL Burn!"] },
				{ group: 'Reaver', options: ['Grim Harrow', 'Reap'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Shadowmastery', 'The Pact is Sealed'],
			pools: [{ group: 'Lesser Invocations', options: LESSER }],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Gift from the Master'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: 'secondary',
		},
		{ level: 10, auto: ['Master of Darkness'], pools: [], subclass: [], asi: null },
		{
			level: 11,
			auto: ['The Pact is Sealed'],
			pools: [{ group: 'Lesser Invocations', options: LESSER }],
			subclass: [
				{ group: 'Pact Of The Abyssal Depths', options: ['Glacial Resilience'] },
				{ group: 'Pact Of The Red Dragon', options: ['Heart of Burning Fire'] },
				{ group: 'Reaver', options: ['My Blood, My Power', 'Otherworldly Might'] },
			],
			asi: null,
		},
		{ level: 12, auto: ['Greedy pact'], pools: [], subclass: [], asi: 'primary' },
		{ level: 13, auto: ['Master of Darkness'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Gift from the Master', 'Shadowmastery'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Pact Of The Abyssal Depths', options: ["Cryomancer's Reprisal"] },
				{ group: 'Pact Of The Red Dragon', options: ['Enveloped by the Master'] },
				{ group: 'Reaver', options: ["I'm the Patron Now!"] },
			],
			asi: null,
		},
		{ level: 16, auto: ['Master of Darkness'], pools: [], subclass: [], asi: 'primary' },
		{ level: 17, auto: ['Dire Shadows'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 18,
			auto: ['Gift from the Master'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: ['Master of Darkness'], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Eldritch Usurper'], pools: [], subclass: [], asi: 'capstone' },
	],
};
