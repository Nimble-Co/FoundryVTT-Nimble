import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const ICE = 'packs/spells/core/ice';
const LIGHTNING = 'packs/spells/core/lightning';
const FILES = {
	snowblind: `${ICE}/snowblind.json`,
	arcticBlast: `${ICE}/arctic-blast.json`,
	arcticAnnihilation: `${ICE}/arctic-annihilation.json`,
	cryosleep: `${ICE}/cryosleep.json`,
	frostShield: `${ICE}/frost-shield.json`,
	zap: `${LIGHTNING}/zap.json`,
	arcLightning: `${LIGHTNING}/arc-lightning.json`,
	electrocharge: `${LIGHTNING}/electrocharge.json`,
	seethingStorm: `${LIGHTNING}/seething-storm.json`,
	rideTheLightning: `${LIGHTNING}/ride-the-lightning.json`,
};

const MOMENT_KEYS = [
	'boundary',
	'clock',
	'effectName',
	'event',
	'kind',
	'span',
	'units',
	'value',
	'who',
];

const readItem = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

const nodesOf = (item: Json): Json[] =>
	flattenEffectsTree(item.system?.activation?.effects ?? []) as Json[];

function effectById(item: Json, id: string): Json {
	const effect = (item.effects as Json[]).find((each) => each._id === id);
	if (!effect) throw new Error(`${item.name} has no effect ${id}`);
	return effect;
}

function effectNamed(item: Json, name: string): Json {
	const found = (item.effects as Json[]).filter((each) => each.name === name);
	if (found.length !== 1) throw new Error(`${item.name} has ${found.length} effects named ${name}`);
	return found[0] as Json;
}

/** The one Apply Effect step of the item that applies this effect. */
function stepOf(item: Json, effectId: string): Json {
	const steps = nodesOf(item).filter(
		(node) => node.type === 'applyEffect' && node.effectId === effectId,
	);
	if (steps.length !== 1) throw new Error(`${item.name} has ${steps.length} steps for ${effectId}`);
	return steps[0] as Json;
}

/** A node as the pack stores it, with its children. */
function rawNode(nodes: Json[], id: string): Json | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		const children = Object.values((node.on ?? {}) as Record<string, Json[]>).flat();
		const found = rawNode(children, id);
		if (found) return found;
	}
	return undefined;
}

function expectAtRoot(item: Json, step: Json): void {
	expect(step.parentNode).toBeNull();
	expect(step.parentContext).toBeNull();
	expect((item.system.activation.effects as Json[]).map((node) => node.id)).toContain(step.id);
}

function expectOnFailedSave(item: Json, step: Json, saveId: string): void {
	expect(step.parentNode).toBe(saveId);
	expect(step.parentContext).toBe('failedSave');
	const save = rawNode(item.system.activation.effects as Json[], saveId) as Json;
	expect(save.type).toBe('savingThrow');
	expect((save.on.failedSave as Json[]).map((node) => node.id)).toContain(step.id);
}

function expectNineKeys(effect: Json): void {
	for (const moment of effect.system.lastsUntil as Json[]) {
		expect(Object.keys(moment).sort()).toEqual(MOMENT_KEYS);
	}
}

const nextTurn = (boundary: 'start' | 'end', value: number | null = null) =>
	expect.objectContaining({
		kind: 'turn',
		boundary,
		clock: 'holder',
		span: 'nextTurn',
		value,
		units: null,
		who: null,
		event: null,
		effectName: '',
	});

const time = (value: number, units: string) =>
	expect.objectContaining({
		kind: 'time',
		boundary: null,
		clock: null,
		span: null,
		value,
		units,
		who: null,
		event: null,
	});

const event = (who: string, name: string) =>
	expect.objectContaining({
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		units: null,
		who,
		event: name,
		effectName: '',
	});

const CONC = event('source', 'loseConcentration');

describe('Snowblind', () => {
	const item = readItem(FILES.snowblind);
	const effect = effectById(item, 'nSUzAurPwXyGmOeJ');

	it('Blinded lasts until the end of their next turn', () => {
		expect(effect.statuses).toEqual(['blinded']);
		expect(effect.system.lastsUntil).toEqual([nextTurn('end')]);
		expectNineKeys(effect);
	});

	it('applies Blinded to the targets on a hit', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expect(step.parentContext).toBe('hit');
	});
});

describe('Arctic Blast', () => {
	const item = readItem(FILES.arcticBlast);
	const save = 'P2MHYNyCBVrBNjGJ';

	it('Restrained lasts until the end of their next turn, on a failed save', () => {
		const effect = effectById(item, 'lw6Gq5oQtvrk7XUC');
		expect(effect.statuses).toEqual(['restrained']);
		expect(effect.system.lastsUntil).toEqual([nextTurn('end')]);
		expectNineKeys(effect);
		const step = stepOf(item, effect._id);
		expect(step.id).toBe('xU1H46GErvHeHktL');
		expectOnFailedSave(item, step, save);
	});

	it('Incapacitated for 1 turn is a second step on the failed save, for the Hampered', () => {
		const effect = effectNamed(item, 'Incapacitated');
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual(['incapacitated']);
		expect(effect.system.lastsUntil).toEqual([nextTurn('end')]);
		expectNineKeys(effect);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectOnFailedSave(item, step, save);
	});
});

describe('Arctic Annihilation', () => {
	const item = readItem(FILES.arcticAnnihilation);

	it('Incapacitated lasts 1 round, on a failed STR save', () => {
		const effect = effectById(item, 'WrqIyoOXLh0EMdyv');
		expect(effect.statuses).toEqual(['incapacitated']);
		expect(effect.system.lastsUntil).toEqual([time(1, 'rounds')]);
		expectNineKeys(effect);
		expectOnFailedSave(item, stepOf(item, effect._id), 'P493f7jWrJBApGNV');
	});

	it('Encased in Ice is its own step at the root, until the start of their next turn', () => {
		const effect = effectNamed(item, 'Encased in Ice');
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual(['incapacitated']);
		expect(effect.description).toBe('Immune to damage and negative effects.');
		expect(effect.system.lastsUntil).toEqual([nextTurn('start')]);
		expectNineKeys(effect);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});
});

describe('Cryosleep', () => {
	const item = readItem(FILES.cryosleep);
	const effect = effectById(item, '0Bt3V5hxx1EM48jr');

	it('asleep lasts until their 2nd next turn ends, or they take damage', () => {
		expect(effect.statuses).toEqual(['incapacitated']);
		expect(effect.system.lastsUntil).toEqual([nextTurn('end', 2), event('holder', 'takeDamage')]);
		expectNineKeys(effect);
		const step = stepOf(item, effect._id);
		expect(step.id).toBe('cfrn6ZtFHnDOvGd9');
		expectOnFailedSave(item, step, 'kyelg74XDRixvDbX');
	});

	it('Dazed keeps its default Lasts Until', () => {
		expect(effectById(item, 'gb4cmw8OcZhyR3qR').system.lastsUntil).toEqual([]);
	});

	it('an upcast adds 1 area and 1 turn asleep', () => {
		expect(item.system.scaling.mode).toBe('upcast');
		expect(item.system.scaling.deltas).toEqual([
			expect.objectContaining({ operation: 'addAreaSize', value: 1 }),
			expect.objectContaining({
				operation: 'lengthenLastsUntil',
				value: 1,
				targetEffectId: 'cfrn6ZtFHnDOvGd9',
				momentIndex: 0,
			}),
		]);
	});
});

describe('Frost Shield', () => {
	const item = readItem(FILES.frostShield);
	let effect: Json;
	beforeAll(() => {
		effect = effectNamed(item, 'Frost Shield');
	});

	it('lasts until the start of your next turn', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([nextTurn('start')]);
		expectNineKeys(effect);
	});

	it('is a self step at the root that gives the temp HP of the healing step', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expect(step.tempHealingNodeId).toBe('jp65MQRRustJoDbN');
		expectAtRoot(item, step);
		const healing = nodesOf(item).find((node) => node.id === 'jp65MQRRustJoDbN') as Json;
		expect(healing).toMatchObject({ type: 'healing', healingType: 'tempHealing' });
	});

	it('the Defend option has no reminder', () => {
		const rule = (item.system.rules as Json[]).find((each) => each.id === 'XGIXtJzj3BVrqyoq');
		expect(rule).toMatchObject({ type: 'defendOption', reminder: '' });
	});
});

describe.each([
	['Zap', FILES.zap, 'naPljowutGjNJFzf'],
	['Arc Lightning', FILES.arcLightning, '5jVXPSgSbvzTy1ym'],
])('%s', (_name, file, effectId) => {
	const item = readItem(file);
	const effect = effectById(item, effectId);

	it('Charged lasts 1 minute', () => {
		expect(effect.statuses).toEqual(['charged']);
		expect(effect.system.lastsUntil).toEqual([time(1, 'minutes')]);
		expectNineKeys(effect);
	});

	it('goes on you on a miss', () => {
		const step = stepOf(item, effectId);
		expect(step.recipient).toBe('self');
		expect(step.parentContext).toBe('miss');
	});
});

describe('Electrocharge', () => {
	const item = readItem(FILES.electrocharge);
	const effect = effectById(item, 'ODT8SBxBsXv1g9vQ');

	it('is Charged with +1 max action, +5 armor, 2x speed and advantage on DEX saves', () => {
		expect(effect.name).toBe('Electrocharge');
		expect(effect.statuses).toEqual(['charged']);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'armorClass', formula: '5', mode: 'add' }),
			expect.objectContaining({ type: 'maxActionBonus', value: '1' }),
			expect.objectContaining({
				type: 'situationalRollMode',
				value: 1,
				checkType: 'savingThrow',
				saves: ['dexterity'],
				abilities: [],
				skills: [],
			}),
		]);
		expect(effect.system.changes).toEqual(
			['walk', 'fly', 'climb', 'swim', 'burrow'].map((mode) => ({
				key: `system.attributes.movement.${mode}`,
				type: 'multiplyDown',
				value: '2',
				phase: 'afterRules',
				priority: null,
			})),
		);
	});

	it('lasts until you lose Concentration', () => {
		expect(effect.system.lastsUntil).toEqual([CONC]);
		expectNineKeys(effect);
	});

	it('applies to the target at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});
});

describe('Seething Storm', () => {
	const item = readItem(FILES.seethingStorm);
	let effect: Json;
	beforeAll(() => {
		effect = effectNamed(item, 'Seething Storm');
	});

	it('you fly, move for free each turn, and attacks against you have disadvantage', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.system.readsHolder).toBe(true);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'grantMovement',
				mode: 'fly',
				speed: '@attributes.movement.walk',
			}),
			expect.objectContaining({
				type: 'freeMove',
				trigger: 'onTurnStart',
				distance: '@speed',
				recipient: 'self',
				within: 12,
				direction: 'any',
				ignoresDifficultTerrain: false,
				poolIdentifier: '',
				chargePoolIdentifier: '',
				whisper: false,
			}),
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'advantage',
				value: -1,
				whichRoll: 'attacksOnHolder',
				usedUp: false,
				meleeOnly: false,
				rangedOnly: false,
				fromSourceOnly: false,
				damageType: '',
			}),
		]);
	});

	it('lasts until you lose Concentration', () => {
		expect(effect.system.lastsUntil).toEqual([CONC]);
		expectNineKeys(effect);
	});

	it('is a self step at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Ride the Lightning', () => {
	const item = readItem(FILES.rideTheLightning);
	const save = 'sklq8bAt2H8fc8lm';

	it('Deafened is a marker that lasts 1 day', () => {
		const effect = effectNamed(item, 'Deafened');
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe('Deafened for 1 day.');
		expect(effect.system.lastsUntil).toEqual([time(1, 'days')]);
		expectNineKeys(effect);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectOnFailedSave(item, step, save);
	});

	it('Prone stays on the same failed save', () => {
		expectOnFailedSave(item, stepOf(item, '788vgfV6Pg9YOm1M'), save);
	});
});
