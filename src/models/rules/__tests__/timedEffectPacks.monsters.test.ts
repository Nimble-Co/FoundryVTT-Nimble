import { describe, expect, it } from 'vitest';
import {
	actorItem,
	allSteps,
	combatEnds,
	effectById,
	effectEnds,
	effectNamed,
	endOfHoldersCurrentTurn,
	endOfNextHerosTurn,
	endOfRound,
	escapeDc,
	exactMoment,
	expectAtRoot,
	expectNineKeys,
	GRAPPLED_IMG,
	grappleEnds,
	holderTakesDamage,
	type Json,
	minutes,
	NO_DC_ESCAPE,
	onEvent,
	rawStepById,
	readActor,
	stepApplying,
} from '../../../../tests/fixtures/packContent.js';

const M = 'packs/monsters/core';

const monsterFile = (file: string): string => `${M}/${file}.json`;

const itemOf = (file: string, name: string): Json => actorItem(monsterFile(file), name);

/** The step sits in this branch of this node, and in no other branch. */
function expectUnder(item: Json, step: Json, parentId: string, branch: string): void {
	expect(step.parentNode).toBe(parentId);
	expect(step.parentContext).toBe(branch);
	const parent = rawStepById(item, parentId) as Json;
	for (const [context, children] of Object.entries((parent.on ?? {}) as Record<string, Json[]>)) {
		const ids = children.map((node) => node.id);
		if (context === branch) expect(ids).toContain(step.id);
		else expect(ids).not.toContain(step.id);
	}
}

const NO_ESCAPE = escapeDc('');

function expectNoHampered(item: Json): void {
	for (const effect of (item.effects ?? []) as Json[]) {
		expect(effect.statuses).not.toContain('hampered');
	}
	const ids = new Set(((item.effects ?? []) as Json[]).map((effect) => effect._id));
	for (const node of allSteps(item)) {
		if (node.type === 'applyEffect') expect(ids.has(node.effectId)).toBe(true);
	}
}

describe('Kobold Trapper: [Trap] - HIDDEN NET!', () => {
	const item = itemOf('kobolds/kobold-trapper', '[Trap] - HIDDEN NET!');
	const effect = effectById(item, 'EySYv4G54ZK1393a');

	it('Restrained until they escape (DC 10)', () => {
		expect(effect.statuses).toEqual(['restrained']);
		expect(effect.system.escape).toEqual(escapeDc('10'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets at the root', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});
});

describe.each([
	['Snakeman', 'snakemen/snakeman', 'Slash.', 'ZK1rF3alqTOwO3t9'],
	['Cobra Captain', 'snakemen/cobra-captain', 'Slash (2×).', 'fxsF2KOot7K6Y4ca'],
	['Giant Cobra', 'snakemen/giant-cobra', 'Crush.', 'wKgNy9NrBh9WIEEi'],
])('%s: Coiling Strike on %s', (_monster, file, name, damageId) => {
	const item = itemOf(file, name as string);
	const effect = effectNamed(item, 'Grappled');

	it('Grappled (escape DC 10), with the Grappled ends', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(GRAPPLED_IMG);
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('10'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a crit only', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, damageId as string, 'criticalHit');
	});
});

describe('Snakeman Minion: Strike.', () => {
	const item = itemOf('snakemen/snakeman-minion', 'Strike.');
	const effect = effectById(item, '6iZ8g1ZlAA8D2P2y');

	it('Grappled (escape DC 10)', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('10'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a crit', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'Cih6Cm8XoauLM2HA', 'criticalHit');
	});
});

describe.each([
	['Tiny Mimic', 'mimics/tiny-mimic', 'Pseudopod.', 'T0DYBFyZj8HzFexQ', '9', 'ZjiweZeONMLBciCh'],
	['Small Mimic', 'mimics/small-mimic', 'Pseudopod.', 'Jp3bA6Of60rImEXX', '11', '30UpXWSdJcQqdQPq'],
	[
		'Medium Mimic',
		'mimics/medium-mimic',
		'Pseudopod.',
		'7PFIBmfqxLRnz7NG',
		'13',
		'yIczxXrDo2v8CNpw',
	],
	['Worg', 'hill-and-field/worg', 'Rip Apart (2×).', 'NlIn2gECpMWRDF4p', '10', 'WIitUxydTMHoKk4X'],
	['Griffon', 'hill-and-field/griffon', 'Talons.', 'YW1TAKBWtE4y6ANb', '14', 'yNHg453ndmOkP02x'],
	['Roc', 'hill-and-field/roc', 'Pluck Up.', '7Rk7ZWLedSLz55PW', '18', 'lT9K4RUsltSX5Gf6'],
	['Glabrezu', 'horrors/glabrezu', 'Doomclaw (2×).', 'trrgMKwGO1eSC0tb', '17', 'M6hnSUAyIO8XbKoo'],
	['Cloaker', 'underground/cloaker', 'Wrap.', '2W86UGj5fgoMLDbA', '16', '1Jocofp3EKqEhzKR'],
	['Wax Golem', 'underground/wax-golem', 'Wax Grip.', 'wMHxhDaoabX7yZDY', '10', 'waxGripDamage001'],
])('%s: %s', (_monster, file, name, effectId, dc, damageId) => {
	const item = itemOf(file, name);
	const effect = effectById(item, effectId);

	it(`Grappled (escape DC ${dc}), with the Grappled ends`, () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc(dc));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a hit', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, damageId, 'hit');
	});

	it('has no Hampered effect or step', () => {
		expectNoHampered(item);
		expect((item.effects as Json[]).map((each) => each._id)).toEqual([effectId]);
	});
});

describe.each([
	['Bulette', 'hill-and-field/bulette', 'Leap & Bite.', 'YbmVrQRSTsoPnTjJ', 'eQA79Plmpu3LiriV'],
	['Zombie', 'undead/zombie', 'Crunch.', '7UFQnfAVsMUPtXI3', 'Z8MKXP8lRs0E1lK9'],
])('%s: %s', (_monster, file, name, effectId, damageId) => {
	const item = itemOf(file, name);
	const effect = effectById(item, effectId);

	it('Grappled with an escape that has no DC', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(NO_DC_ESCAPE);
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a hit', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, damageId, 'hit');
	});
});

describe('Bulette: Burst Forth!', () => {
	const item = itemOf('hill-and-field/bulette', 'Burst Forth!');
	const roots = item.system.activation.effects as Json[];
	const save = roots[0] as Json;
	const effect = effectNamed(item, 'Grappled');

	it('has one DC 14 DEX save at the root', () => {
		expect(roots).toHaveLength(1);
		expect(save.type).toBe('savingThrow');
		expect(save.savingThrowType).toBe('dexterity');
		expect(save.saveType).toBeUndefined();
		expect(save.saveDC).toBe('14');
		expectAtRoot(item, save);
	});

	it('deals 1d12+20 with no damage type, half on a save', () => {
		const shared = save.sharedRolls as Json[];
		expect(shared).toHaveLength(1);
		const damage = shared[0] as Json;
		expect(damage).toEqual(
			expect.objectContaining({
				type: 'damage',
				formula: '1d12+20',
				damageType: '',
				parentContext: 'sharedRolls',
				parentNode: save.id,
			}),
		);
		expect(damage.on.failedSave).toEqual([
			expect.objectContaining({
				type: 'damageOutcome',
				outcome: 'fullDamage',
				parentContext: 'failedSave',
				parentNode: damage.id,
			}),
		]);
		expect(damage.on.passedSave).toEqual([
			expect.objectContaining({
				type: 'damageOutcome',
				outcome: 'halfDamage',
				parentContext: 'passedSave',
				parentNode: damage.id,
			}),
		]);
	});

	it('Grappled (escape DC 14), with the Grappled ends', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(GRAPPLED_IMG);
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('14'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies Grappled to the targets on a failed save', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, save.id, 'failedSave');
	});
});

describe.each([
	[
		'Briarbane Tangler',
		'briarbanes/briarbane-tangler',
		'Tangle (2×).',
		'Y7SjDinsGSokrOa2',
		'REQaIJl93Z70ZhPx',
	],
	[
		'Giant Venus Flytrap',
		'briarbanes/giant-venus-flytrap',
		'Tangle (2x).',
		'gW8I6VKZv4O4cXya',
		'flytrapTangleDmg1',
	],
])('%s: %s', (_monster, file, name, effectId, damageId) => {
	const item = itemOf(file, name);
	const effect = effectById(item, effectId);

	it('Grappled (escape DC 12), or until fire or slashing damage', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('12'));
		expect(effect.system.lastsUntil).toEqual([
			...grappleEnds.map(exactMoment),
			exactMoment(holderTakesDamage('fire', 'slashing')),
		]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to the targets on a hit, with no Hampered effect or step', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, damageId, 'hit');
		expectNoHampered(item);
		expect((item.effects as Json[]).map((each) => each._id)).toEqual([effectId]);
	});
});

describe('Fanatic: Whispers of Madness.', () => {
	const item = itemOf('cultists/fanatic', 'Whispers of Madness.');
	const effect = effectById(item, 'AR6seICcuscRLWqW');

	it('Grappled with no escape button, ends with the Grappled ends or radiant damage', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(NO_ESCAPE);
		expect(effect.system.lastsUntil).toEqual([
			...grappleEnds.map(exactMoment),
			exactMoment(holderTakesDamage('radiant')),
		]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to the targets on a failed STR save', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'I4FAutwqUV25q4Qs', 'failedSave');
		const save = rawStepById(item, 'I4FAutwqUV25q4Qs') as Json;
		expect(save.savingThrowType).toBe('strength');
		expect(save.saveType).toBeUndefined();
	});
});

describe.each([
	['Fanatic', 'cultists/fanatic'],
	['Cultist', 'cultists/cultist'],
])('%s: Fanatical Zeal.', (_monster, file) => {
	it('crits also inflict Despair', () => {
		const item = itemOf(file, 'Fanatical Zeal.');
		const rules = item.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				type: 'applyCondition',
				condition: 'despair',
				trigger: 'onCrit',
				label: 'Fanatical Zeal: Despair on crit',
			}),
		);
		expect(String(rules[0]?.id)).toMatch(/^[A-Za-z0-9]{16}$/);
	});
});

describe.each([
	[
		'Giant Spider',
		'underground/giant-spider',
		'1Y3BB4THhK04NKze',
		'T9LWdmKADzv0aJSl',
		'icons/svg/net.svg',
	],
	[
		'Nestweaver',
		'underground/nestweaver',
		'eJqNvlBMI0ZpzuFx',
		'onbSGIp1YeUKh8my',
		'icons/svg/net.svg',
	],
])('%s: Shoot Web.', (_monster, file, effectId, damageId, img) => {
	const item = itemOf(file, 'Shoot Web.');
	const effect = effectById(item, effectId);

	it('Restrained (escape DC 12), or until slashing or fire damage', () => {
		expect(effect.name).toBe('Restrained');
		expect(effect.img).toBe(img);
		expect(effect.statuses).toEqual(['restrained']);
		expect(effect.system.escape).toEqual(escapeDc('12'));
		expect(effect.system.lastsUntil).toEqual([exactMoment(holderTakesDamage('slashing', 'fire'))]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to the targets on a hit, with no Hampered effect or step', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, damageId, 'hit');
		expectNoHampered(item);
		expect((item.effects as Json[]).map((each) => each._id)).toEqual([effectId]);
	});
});

describe('Ettercap: Web Garrote.', () => {
	const item = itemOf('underground/ettercap', 'Web Garrote.');
	const grappled = effectById(item, 'V4xINB5KiKg3sXGs');
	const silenced = effectById(item, 'ZIa4q9UX46e8UG8X');

	it('Grappled (escape DC 13), with the Grappled ends', () => {
		expect(grappled.statuses).toEqual(['grappled']);
		expect(grappled.system.escape).toEqual(escapeDc('13'));
		expect(grappled.system.lastsUntil).toEqual([]);
	});

	it('Silenced until the target escapes the Grappled', () => {
		expect(silenced.statuses).toEqual(['silenced']);
		expect(silenced.system.escape).toEqual(NO_ESCAPE);
		expect(silenced.system.lastsUntil).toEqual([exactMoment(effectEnds('Grappled'))]);
		expectNineKeys(silenced);
	});

	it('applies both to the targets on a hit, with no Hampered effect or step', () => {
		for (const effect of [grappled, silenced]) {
			const step = stepApplying(item, effect._id);
			expect(step.recipient).toBe('targets');
			expectUnder(item, step, '3c21wnL6rWn5YikO', 'hit');
		}
		expectNoHampered(item);
		expect((item.effects as Json[]).map((each) => each._id)).toEqual([
			'V4xINB5KiKg3sXGs',
			'ZIa4q9UX46e8UG8X',
		]);
	});
});

describe('Briarbane Acidpod: Grab.', () => {
	const item = itemOf('briarbanes/briarbane-acidpod', 'Grab.');
	const effect = effectById(item, 'bm0syBy0M81cxxBc');

	it('has a DC 12 DEX save with only the new save type field', () => {
		const save = rawStepById(item, 'Eq4wmPFjrkCrjSso') as Json;
		expect(save.savingThrowType).toBe('dexterity');
		expect(save.saveType).toBeUndefined();
		expect(save.saveDC).toBe('12');
	});

	it('Grappled with an escape that has no DC', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(NO_DC_ESCAPE);
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a failed save, with no Hampered effect or step', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'Eq4wmPFjrkCrjSso', 'failedSave');
		expectNoHampered(item);
		expect((item.effects as Json[]).map((each) => each._id)).toEqual([effect._id]);
	});
});

describe('Briarbane Treant: Slam.', () => {
	const item = itemOf('briarbanes/briarbane-treant', 'Slam.');

	it('knocks Prone on a hit, with no Hampered effect or step', () => {
		expectNoHampered(item);
		expect((item.effects as Json[]).map((each) => each._id)).toEqual(['mE4s6QLBaUV13bPy']);
		const step = stepApplying(item, 'mE4s6QLBaUV13bPy');
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'JimMPPXV3TWIqq1y', 'hit');
	});
});

describe('Basilisk: Stone Gaze.', () => {
	const item = itemOf('forest-denizens/basilisk', 'Stone Gaze.');
	const dazed = effectById(item, 'ZpvDniNo2gCf7N30');
	const petrified = effectNamed(item, 'Petrified');

	it('Dazed lasts 10 minutes and stacks to Petrified at 3', () => {
		expect(dazed.statuses).toEqual(['dazed']);
		expect(dazed.system.lastsUntil).toEqual([exactMoment(minutes(10))]);
		expectNineKeys(dazed);
		expect(dazed.system.stacks).toEqual({
			on: true,
			count: 1,
			at: 3,
			effectId: petrified._id,
		});
	});

	it('Petrified is its own effect with no step and no end', () => {
		expect(petrified.transfer).toBe(false);
		expect(petrified.img).toBe('systems/nimble/assets/icons/petrified.svg');
		expect(petrified.statuses).toEqual(['petrified']);
		expect(petrified.system.lastsUntil).toEqual([]);
		expect(String(petrified._id)).toMatch(/^[A-Za-z0-9]{16}$/);
		const steps = allSteps(item).filter((node) => node.effectId === petrified._id);
		expect(steps).toEqual([]);
	});

	it('applies Dazed to the targets at the root, with no Hampered effect or step', () => {
		const step = stepApplying(item, dazed._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
		expectNoHampered(item);
		expect(allSteps(item).map((node) => node.id)).toEqual(['uYpDvr5EZunKsGIU']);
	});

	it('keeps Flesh to Stone as text', () => {
		const flesh = itemOf('forest-denizens/basilisk', 'Flesh to Stone.');
		expect(flesh.effects).toEqual([]);
		expect(flesh.system.rules).toEqual([]);
	});
});

describe('Gray Ooze: Acidic Touch (2×).', () => {
	const item = itemOf('oozes/gray-ooze', 'Acidic Touch (2×).');

	it('deals its damage and applies no Blinded', () => {
		expect(item.effects).toEqual([]);
		expect(allSteps(item).map((node) => node.type)).toEqual(['damage', 'damageOutcome']);
	});
});

describe('Umber Hulk: Confounding Pheromones.', () => {
	const item = itemOf('underground/umber-hulk', 'Confounding Pheromones.');
	const confused = effectById(item, 'q5AOtsApLNEP2oHY');
	const counter = effectNamed(item, 'Confounding Pheromones.');
	const SAVE = '8oSIyG74A90ERntm';

	it('has a DC 15 WIL save at the root', () => {
		const save = rawStepById(item, SAVE) as Json;
		expect(save.savingThrowType).toBe('will');
		expect(save.saveType).toBeUndefined();
		expect(save.saveDC).toBe('15');
		expectAtRoot(item, save);
	});

	it('Confused lasts this turn', () => {
		expect(confused.statuses).toEqual(['confused']);
		expect(confused.system.lastsUntil).toEqual([exactMoment(endOfHoldersCurrentTurn)]);
		expectNineKeys(confused);
	});

	it('the failure count stacks, gives advantage 1 per stack on this save, and ends with combat', () => {
		expect(counter.transfer).toBe(false);
		expect(counter.statuses).toEqual([]);
		expect(counter.description).toBe('Advantage 1 on this save for each failure this combat.');
		expect(counter.system.stacks).toEqual({ on: true, count: 1, at: null, effectId: '' });
		expect(counter.system.lastsUntil).toEqual([exactMoment(combatEnds())]);
		expectNineKeys(counter);
		const rules = counter.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				type: 'situationalRollMode',
				value: 1,
				perStack: true,
				checkType: 'savingThrow',
				saves: ['will'],
				abilities: [],
				skills: [],
				label: 'Confounding Pheromones',
				predicate: { $and: ['save:from:confounding-pheromones'] },
			}),
		);
	});

	it('both go on each creature that fails, by themselves', () => {
		for (const effect of [confused, counter]) {
			const step = stepApplying(item, effect._id);
			expect(step.recipient).toBe('savers');
			expectUnder(item, step, SAVE, 'failedSave');
		}
		expect(stepApplying(item, confused._id).id).toBe('3GCn8oRY2zLRA9RS');
	});
});

describe('Duskprowler: Illusory Aura.', () => {
	const item = itemOf('forest-denizens/duskprowler', 'Illusory Aura.');
	const effect = effectNamed(item, 'Illusory Aura suppressed');

	it('a marker until the end of the next hero turn', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe('Attacks against the Duskprowler do not have Disadvantage 2.');
		expect(effect.system.rules).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfNextHerosTurn)]);
		expectNineKeys(effect);
	});

	it('applies to the Duskprowler at the root', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Druid: Beastshift.', () => {
	const item = itemOf('forest-denizens/druid', 'Beastshift.');
	const effect = effectNamed(item, 'Beastshift');

	it('+4 speed and Medium armor this round', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'speedBonus', value: '4' }),
		]);
		expect(effect.system.changes).toEqual([
			{
				key: 'system.attributes.armor',
				type: 'override',
				value: 'medium',
				phase: 'initial',
				priority: null,
			},
		]);
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfRound)]);
		expectNineKeys(effect);
	});

	it('applies to the Druid at the root, beside its attack', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
		expect(allSteps(item).map((node) => node.id)).toEqual(
			expect.arrayContaining(['uUjd30LadRcCzqeV', 'AmwVAK4KOM4ZgSKL']),
		);
	});
});

describe('Bandit Assassin: Sneak.', () => {
	const item = itemOf('bandits/bandit-assassin', 'Sneak.');
	const effect = effectNamed(item, 'Invisible');

	it('Invisible until they attack', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe('icons/svg/invisible.svg');
		expect(effect.statuses).toEqual(['invisible']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(onEvent('holder', 'attack'))]);
		expectNineKeys(effect);
	});

	it('applies to the assassin at the root', () => {
		const step = stepApplying(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Spiny Fiend: Spines.', () => {
	it('melee attackers take 3 damage with no type, ignoring armor', () => {
		const item = itemOf('horrors/spiny-fiend', 'Spines.');
		const rules = item.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				type: 'damageBack',
				trigger: 'attacked',
				attackDelivery: 'melee',
				answeredAttack: false,
				amount: 'formula',
				formula: '3',
				damageType: '',
				ignoreArmor: true,
				attackerEffectId: '',
			}),
		);
	});
});

describe('monsters, in packs', () => {
	it('have no effect with the Hampered status', () => {
		const hits: string[] = [];
		for (const file of [
			'underground/nestweaver',
			'underground/giant-spider',
			'underground/ettercap',
			'underground/cloaker',
			'horrors/glabrezu',
			'forest-denizens/basilisk',
			'briarbanes/briarbane-treant',
			'briarbanes/briarbane-tangler',
			'briarbanes/briarbane-acidpod',
		]) {
			for (const item of readActor(monsterFile(file)).items as Json[]) {
				for (const effect of (item.effects ?? []) as Json[]) {
					if (effect.statuses?.includes('hampered')) hits.push(`${file} ${item.name}`);
				}
			}
		}
		expect(hits).toEqual([]);
	});
});
