import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const WIND = 'packs/spells/core/wind';
const RADIANT = 'packs/spells/core/radiant';
const SECRET = 'packs/secretSpells/core';

const MOMENT_KEYS = [
	'kind',
	'boundary',
	'clock',
	'span',
	'value',
	'units',
	'who',
	'event',
	'effectName',
];

const readItem = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

const steps = (item: Json): Json[] =>
	flattenEffectsTree(item.system?.activation?.effects ?? []) as Json[];

function effectNamed(item: Json, name: string): Json {
	const effect = ((item.effects ?? []) as Json[]).find((each) => each.name === name);
	if (!effect) throw new Error(`${item.name} has no effect ${name}`);
	return effect;
}

function effectWithId(item: Json, id: string): Json {
	const effect = ((item.effects ?? []) as Json[]).find((each) => each._id === id);
	if (!effect) throw new Error(`${item.name} has no effect ${id}`);
	return effect;
}

const stepsFor = (item: Json, effectId: string): Json[] =>
	steps(item).filter((node) => node.type === 'applyEffect' && node.effectId === effectId);

function stepFor(item: Json, effectId: string): Json {
	const found = stepsFor(item, effectId);
	expect(found).toHaveLength(1);
	return found[0] as Json;
}

const rules = (effect: Json): Json[] => (effect.system.rules ?? []) as Json[];

const endOfNextTurn = expect.objectContaining({
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
});
const endOfRound = expect.objectContaining({
	kind: 'turn',
	boundary: 'end',
	clock: null,
	span: 'currentRound',
});
const loseConcentration = expect.objectContaining({
	kind: 'event',
	who: 'source',
	event: 'loseConcentration',
});
const oneMinute = expect.objectContaining({ kind: 'time', value: 1, units: 'minutes' });
const casterDies = expect.objectContaining({ kind: 'event', who: 'source', event: 'die' });

function expectMoments(effect: Json, moments: unknown[]): void {
	expect(effect.system.lastsUntil).toEqual(moments);
	for (const moment of effect.system.lastsUntil as Json[]) {
		expect(Object.keys(moment).sort()).toEqual([...MOMENT_KEYS].sort());
		expect(moment.effectName).toBe('');
	}
}

function expectRoot(step: Json, recipient: string): void {
	expect(step).toMatchObject({ recipient, parentContext: null, parentNode: null });
}

function expectIds(item: Json): void {
	const ids = [
		...((item.effects ?? []) as Json[]).map((effect) => effect._id),
		...steps(item).map((node) => node.id),
	];
	const ruleIds = ((item.effects ?? []) as Json[]).flatMap((effect) =>
		rules(effect).map((rule) => rule.id),
	);
	for (const id of [...ids, ...ruleIds]) expect(String(id)).toMatch(/^[A-Za-z0-9]{16}$/);
	expect(new Set(ids).size).toBe(ids.length);
	expect(new Set(ruleIds).size).toBe(ruleIds.length);
}

/** A new effect of the spell: no status, not on the caster's own sheet, the spell's image. */
function expectSpellEffect(item: Json, effect: Json): void {
	expect(effect.transfer).toBe(false);
	expect(effect.img).toBe(item.img);
	expect(effect.statuses).toEqual([]);
}

const rangedDisadvantage = expect.objectContaining({
	type: 'heldRoll',
	heldKind: 'advantage',
	value: -1,
	whichRoll: 'attacksOnHolder',
	usedUp: false,
	meleeOnly: false,
	rangedOnly: true,
});
const flyTwelve = expect.objectContaining({ type: 'grantMovement', mode: 'fly', speed: '12' });

describe('Vicious Mockery', () => {
	it('Taunts the creature it hits during its next turn', () => {
		const item = readItem(`${WIND}/vicious-mockery.json`);
		const taunted = effectWithId(item, 'ZFJzL221oMGamSUP');
		expect(taunted.statuses).toEqual(['taunted']);
		expectMoments(taunted, [endOfNextTurn]);
		expect(stepFor(item, taunted._id)).toMatchObject({
			recipient: 'targets',
			parentContext: 'hit',
			parentNode: '6pEXpZ8znbQP6LiP',
		});
	});
});

describe('Barrier of Wind', () => {
	const file = `${WIND}/barrier-of-wind.json`;

	it('gives later ranged attacks on the caster disadvantage this round', () => {
		const item = readItem(file);
		const barrier = effectNamed(item, 'Barrier of Wind');
		expectSpellEffect(item, barrier);
		expectMoments(barrier, [endOfRound]);
		expect(rules(barrier)).toEqual([rangedDisadvantage]);
		expect(steps(item)).toHaveLength(1);
		expectRoot(stepFor(item, barrier._id), 'self');
		expectIds(item);
	});

	it('keeps the reroll for the attack that triggers it, and its Defend option has no reminder line', () => {
		const item = readItem(file);
		const ruleTypes = (item.system.rules as Json[]).map((rule) => rule.type);
		expect(ruleTypes).toEqual(['reroll', 'defendOption']);
		const defend = (item.system.rules as Json[]).find((rule) => rule.id === 'I2iE4FiQFEoTvUlj');
		expect(defend).toMatchObject({
			type: 'defendOption',
			reminder: '',
			useReroll: true,
			useItem: true,
			upcastArmor: 3,
		});
	});
});

describe('Boisterous Winds', () => {
	it('gives the caster and the allies fly 12, ranged disadvantage and a free move while the caster concentrates', () => {
		const item = readItem(`${WIND}/boisterous-winds.json`);
		const winds = effectNamed(item, 'Boisterous Winds');
		expectSpellEffect(item, winds);
		expectMoments(winds, [loseConcentration]);
		expect(rules(winds)).toEqual([
			flyTwelve,
			rangedDisadvantage,
			expect.objectContaining({
				type: 'freeMove',
				trigger: 'onTurnStart',
				distance: '@speed',
				recipient: 'self',
				direction: 'any',
				ignoresDifficultTerrain: false,
				poolIdentifier: '',
				chargePoolIdentifier: '',
				whisper: false,
			}),
		]);

		const both = stepsFor(item, winds._id);
		expect(both).toHaveLength(2);
		expect(both.map((step) => step.recipient).sort()).toEqual(['self', 'targets']);
		for (const step of both) {
			expect(step).toMatchObject({ parentContext: null, parentNode: null });
		}
		expect(steps(item)).toHaveLength(2);
		expectIds(item);
	});

	it('keeps its two upcast choices', () => {
		const item = readItem(`${WIND}/boisterous-winds.json`);
		expect(item.system.scaling.mode).toBe('upcastChoice');
		expect(item.system.scaling.choices).toEqual([
			{
				label: '+1 minute',
				deltas: [expect.objectContaining({ operation: 'addDuration', value: 1 })],
			},
			{
				label: '+2 targets',
				deltas: [expect.objectContaining({ operation: 'addTargets', value: 2 })],
			},
		]);
	});
});

describe('Fly', () => {
	it('gives the target fly 12 while the caster concentrates', () => {
		const item = readItem(`${WIND}/fly.json`);
		const fly = effectNamed(item, 'Fly');
		expectSpellEffect(item, fly);
		expectMoments(fly, [loseConcentration]);
		expect(rules(fly)).toEqual([flyTwelve]);
		expect(steps(item)).toHaveLength(1);
		expectRoot(stepFor(item, fly._id), 'targets');
		expectIds(item);
	});
});

describe('Warding Bond', () => {
	it('marks the ward for 1 minute', () => {
		const item = readItem(`${RADIANT}/warding-bond.json`);
		const bond = effectNamed(item, 'Warding Bond');
		expectSpellEffect(item, bond);
		expect(bond.description).toBe(
			'Takes half damage from attacks. The caster is attacked for the other half.',
		);
		expectMoments(bond, [oneMinute]);
		expect(rules(bond)).toEqual([]);
		expect(steps(item)).toHaveLength(1);
		expectRoot(stepFor(item, bond._id), 'targets');
		expectIds(item);
	});
});

describe('Lesser Windform', () => {
	it('makes the caster Blinded and Invisible while they concentrate', () => {
		const item = readItem(`${SECRET}/wind/lesser-windform.json`);
		const blinded = effectWithId(item, '0tiSG4IAoOrWO7my');
		const invisible = effectWithId(item, 'ok7dXYg5WbXHEx9p');
		expect(blinded.statuses).toEqual(['blinded']);
		expect(invisible.statuses).toEqual(['invisible']);
		expectMoments(blinded, [loseConcentration]);
		expectMoments(invisible, [loseConcentration]);
		expectRoot(stepFor(item, blinded._id), 'self');
		expectRoot(stepFor(item, invisible._id), 'self');
	});
});

describe('Greater Windform', () => {
	it('makes the caster Invisible with a fly speed equal to their speed while they concentrate', () => {
		const item = readItem(`${SECRET}/wind/greater-windform.json`);
		const windform = effectWithId(item, 'beELyM7GlJ7PlLY7');
		expect(windform.name).toBe('Greater Windform');
		expect(windform.statuses).toEqual(['invisible']);
		expect(windform.description).toBe('Can slip through any space that wind can pass through.');
		expect(windform.system.readsHolder).toBe(true);
		expectMoments(windform, [loseConcentration]);
		expect(rules(windform)).toEqual([
			expect.objectContaining({
				type: 'grantMovement',
				mode: 'fly',
				speed: '@attributes.movement.walk',
			}),
		]);
		expectRoot(stepFor(item, windform._id), 'self');
		expectIds(item);
	});
});

describe('Cryotomb', () => {
	it('seals the creature that fails the STR save until the caster dies, with no Escape', () => {
		const item = readItem(`${SECRET}/ice/cryotomb.json`);
		const tomb = effectWithId(item, 'A12bIBmJuK6OOEr3');
		expect(tomb.name).toBe('Cryotomb');
		expect(tomb.statuses).toEqual(['incapacitated']);
		expect(tomb.description).toBe('Sealed in an icy tomb: immune to harm.');
		expectMoments(tomb, [casterDies]);
		expect(tomb.system.escape.dc).toBe('');
		expect(tomb.system.escape.noDc ?? false).toBe(false);
		expect(tomb.system.escape.skills ?? []).toEqual([]);

		const save = steps(item).find((node) => node.id === '9dMZOZo2xDDUrl90');
		expect(save).toMatchObject({ type: 'savingThrow', savingThrowType: 'strength' });
		expect(stepFor(item, tomb._id)).toMatchObject({
			recipient: 'targets',
			parentContext: 'failedSave',
			parentNode: '9dMZOZo2xDDUrl90',
		});
	});
});

describe('Memory Veil', () => {
	it('veils the memories of each creature that fails the WIL save while the caster concentrates', () => {
		const item = readItem(`${SECRET}/necrotic/memory-veil.json`);
		const veil = effectNamed(item, 'Memory Veil');
		expectSpellEffect(item, veil);
		expect(veil.description).toBe('Memories of the event are concealed or changed.');
		expectMoments(veil, [loseConcentration]);
		expect(rules(veil)).toEqual([]);

		const save = steps(item).find((node) => node.id === 'UwlrMMyPLgwUatZb');
		expect(save).toMatchObject({ type: 'savingThrow', savingThrowType: 'will' });
		expect(save).not.toHaveProperty('saveType');
		expect(stepFor(item, veil._id)).toMatchObject({
			recipient: 'targets',
			parentContext: 'failedSave',
			parentNode: 'UwlrMMyPLgwUatZb',
		});
		expectIds(item);
	});
});
