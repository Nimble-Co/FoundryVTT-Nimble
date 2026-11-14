import { describe, expect, it } from 'vitest';
import {
	allSteps,
	effectById,
	effectNamed,
	endOfHoldersNextTurn,
	endOfRound,
	expectLastsUntil,
	expectNewIds,
	expectRootRecipient,
	type Json,
	looseMoment,
	type Moment,
	minutes,
	onEvent,
	readItem,
	stepApplying,
	stepsApplying,
	whileConcentrating,
} from '../../../../tests/fixtures/packContent.js';

const WIND = 'packs/spells/core/wind';
const RADIANT = 'packs/spells/core/radiant';
const SECRET = 'packs/secretSpells/core';

const rules = (effect: Json): Json[] => (effect.system.rules ?? []) as Json[];

/** The fields of each moment's kind, an empty effect name, and the nine keys. */
function expectLooseMoments(effect: Json, moments: Moment[]): void {
	expectLastsUntil(
		effect,
		moments.map((moment) => looseMoment(moment, 'effectName')),
	);
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
		const taunted = effectById(item, 'ZFJzL221oMGamSUP');
		expect(taunted.statuses).toEqual(['taunted']);
		expectLooseMoments(taunted, [endOfHoldersNextTurn]);
		expect(stepApplying(item, taunted._id)).toMatchObject({
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
		expectLooseMoments(barrier, [endOfRound]);
		expect(rules(barrier)).toEqual([rangedDisadvantage]);
		expect(allSteps(item)).toHaveLength(1);
		expectRootRecipient(stepApplying(item, barrier._id), 'self');
		expectNewIds(item);
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
		expectLooseMoments(winds, [whileConcentrating]);
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

		const both = stepsApplying(item, winds._id);
		expect(both).toHaveLength(2);
		expect(both.map((step) => step.recipient).sort()).toEqual(['self', 'targets']);
		for (const step of both) {
			expect(step).toMatchObject({ parentContext: null, parentNode: null });
		}
		expect(allSteps(item)).toHaveLength(2);
		expectNewIds(item);
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
		expectLooseMoments(fly, [whileConcentrating]);
		expect(rules(fly)).toEqual([flyTwelve]);
		expect(allSteps(item)).toHaveLength(1);
		expectRootRecipient(stepApplying(item, fly._id), 'targets');
		expectNewIds(item);
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
		expectLooseMoments(bond, [minutes(1)]);
		expect(rules(bond)).toEqual([]);
		expect(allSteps(item)).toHaveLength(1);
		expectRootRecipient(stepApplying(item, bond._id), 'targets');
		expectNewIds(item);
	});
});

describe('Lesser Windform', () => {
	it('makes the caster Blinded and Invisible while they concentrate', () => {
		const item = readItem(`${SECRET}/wind/lesser-windform.json`);
		const blinded = effectById(item, '0tiSG4IAoOrWO7my');
		const invisible = effectById(item, 'ok7dXYg5WbXHEx9p');
		expect(blinded.statuses).toEqual(['blinded']);
		expect(invisible.statuses).toEqual(['invisible']);
		expectLooseMoments(blinded, [whileConcentrating]);
		expectLooseMoments(invisible, [whileConcentrating]);
		expectRootRecipient(stepApplying(item, blinded._id), 'self');
		expectRootRecipient(stepApplying(item, invisible._id), 'self');
	});
});

describe('Greater Windform', () => {
	it('makes the caster Invisible with a fly speed equal to their speed while they concentrate', () => {
		const item = readItem(`${SECRET}/wind/greater-windform.json`);
		const windform = effectById(item, 'beELyM7GlJ7PlLY7');
		expect(windform.name).toBe('Greater Windform');
		expect(windform.statuses).toEqual(['invisible']);
		expect(windform.description).toBe('Can slip through any space that wind can pass through.');
		expect(windform.system.readsHolder).toBe(true);
		expectLooseMoments(windform, [whileConcentrating]);
		expect(rules(windform)).toEqual([
			expect.objectContaining({
				type: 'grantMovement',
				mode: 'fly',
				speed: '@attributes.movement.walk',
			}),
		]);
		expectRootRecipient(stepApplying(item, windform._id), 'self');
		expectNewIds(item);
	});
});

describe('Cryotomb', () => {
	it('seals the creature that fails the STR save until the caster dies, with no Escape', () => {
		const item = readItem(`${SECRET}/ice/cryotomb.json`);
		const tomb = effectById(item, 'A12bIBmJuK6OOEr3');
		expect(tomb.name).toBe('Cryotomb');
		expect(tomb.statuses).toEqual(['incapacitated']);
		expect(tomb.description).toBe('Sealed in an icy tomb: immune to harm.');
		expectLooseMoments(tomb, [onEvent('source', 'die')]);
		expect(tomb.system.escape.dc).toBe('');
		expect(tomb.system.escape.noDc ?? false).toBe(false);
		expect(tomb.system.escape.skills ?? []).toEqual([]);

		const save = allSteps(item).find((node) => node.id === '9dMZOZo2xDDUrl90');
		expect(save).toMatchObject({ type: 'savingThrow', savingThrowType: 'strength' });
		expect(stepApplying(item, tomb._id)).toMatchObject({
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
		expectLooseMoments(veil, [whileConcentrating]);
		expect(rules(veil)).toEqual([]);

		const save = allSteps(item).find((node) => node.id === 'UwlrMMyPLgwUatZb');
		expect(save).toMatchObject({ type: 'savingThrow', savingThrowType: 'will' });
		expect(save).not.toHaveProperty('saveType');
		expect(stepApplying(item, veil._id)).toMatchObject({
			recipient: 'targets',
			parentContext: 'failedSave',
			parentNode: 'UwlrMMyPLgwUatZb',
		});
		expectNewIds(item);
	});
});
