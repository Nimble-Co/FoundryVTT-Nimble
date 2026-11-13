import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const FIRE = 'packs/spells/core/fire';
const NECROTIC = 'packs/spells/core/necrotic';

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

function stepFor(item: Json, effectId: string): Json {
	const found = steps(item).filter(
		(node) => node.type === 'applyEffect' && node.effectId === effectId,
	);
	expect(found).toHaveLength(1);
	return found[0] as Json;
}

function ruleOf(effect: Json, type: string): Json {
	const rule = ((effect.system.rules ?? []) as Json[]).find((each) => each.type === type);
	if (!rule) throw new Error(`${effect.name} has no ${type} rule`);
	return rule;
}

/** The only upcast delta of the item. */
function onlyDelta(item: Json): Json {
	expect(item.system.scaling?.mode).toBe('upcast');
	expect(item.system.scaling.deltas).toHaveLength(1);
	return item.system.scaling.deltas[0] as Json;
}

const startOfNextTurn = expect.objectContaining({
	kind: 'turn',
	boundary: 'start',
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
const oneRound = expect.objectContaining({ kind: 'time', value: 1, units: 'rounds' });
const tempHpGone = expect.objectContaining({ kind: 'event', who: 'holder', event: 'tempHpGone' });

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
		((effect.system.rules ?? []) as Json[]).map((rule) => rule.id),
	);
	for (const id of [...ids, ...ruleIds]) expect(String(id)).toMatch(/^[A-Za-z0-9]{16}$/);
	expect(new Set(ids).size).toBe(ids.length);
	expect(new Set(ruleIds).size).toBe(ruleIds.length);
}

/** Melee attackers take damage and gain the attacker effect while the holder has it. */
function expectAttackerTakes(
	rule: Json,
	fields: { formula: string; answeredAttack: boolean; ignoreArmor: boolean; effectId: string },
): void {
	expect(rule).toMatchObject({
		trigger: 'attacked',
		attackDelivery: 'melee',
		onlyCrits: false,
		answeredAttack: fields.answeredAttack,
		amount: 'formula',
		formula: fields.formula,
		damageType: '',
		ignoreArmor: fields.ignoreArmor,
		woundDoubles: false,
		attackerEffectId: fields.effectId,
	});
}

/** Flame Barrier and Living Inferno: the barrier on the caster, Smoldering on the attacker. */
function expectFlameBarrier(file: string, answeredAttack: boolean): void {
	const item = readItem(file);
	const barrier = effectNamed(item, 'Flame Barrier');
	const smoldering = effectNamed(item, 'Smoldering');

	expect(barrier.transfer).toBe(false);
	expect(barrier.img).toBe(item.img);
	expect(barrier.statuses).toEqual([]);
	expectMoments(barrier, [startOfNextTurn]);
	expect((barrier.system.rules as Json[]).map((rule) => rule.type)).toEqual(['damageBack']);
	expectAttackerTakes(ruleOf(barrier, 'damageBack'), {
		formula: '@key',
		answeredAttack,
		ignoreArmor: true,
		effectId: smoldering._id,
	});

	expect(smoldering.transfer).toBe(false);
	expect(smoldering.statuses).toEqual(['smoldering']);
	expect(smoldering.system.lastsUntil).toEqual([]);

	const step = stepFor(item, barrier._id);
	expectRoot(step, 'self');
	expect(steps(item).filter((node) => node.effectId === smoldering._id)).toEqual([]);

	expect(onlyDelta(item)).toMatchObject({
		operation: 'raiseEffectRule',
		targetEffectId: step.id,
		ruleId: ruleOf(barrier, 'damageBack').id,
		ruleField: 'formula',
		formula: '@key',
	});
	expectIds(item);
}

/** Enchant Weapon and Fiery Embrace's ally: +KEY weapon damage and Smoldering on a crit. */
function expectEnchantedWeapon(effect: Json): void {
	expect((effect.system.rules as Json[]).map((rule) => rule.type)).toEqual([
		'damageBonus',
		'applyCondition',
	]);
	expect(ruleOf(effect, 'damageBonus')).toMatchObject({
		value: '@key',
		damageType: '',
		delivery: 'any',
		source: 'weapon',
		itemIdentifier: '',
	});
	expect(ruleOf(effect, 'applyCondition')).toMatchObject({
		condition: 'smoldering',
		trigger: 'onCrit',
		effectId: '',
	});
}

describe('Flame Barrier', () => {
	it('gives the caster a barrier until the start of their next turn', () => {
		expectFlameBarrier(`${FIRE}/flame-barrier.json`, true);
	});

	it('has no reminder line on its Defend option', () => {
		const item = readItem(`${FIRE}/flame-barrier.json`);
		const defend = (item.system.rules as Json[]).find((rule) => rule.id === 'fxPm2H5vTCF1CSl3');
		expect(defend).toMatchObject({ type: 'defendOption', reminder: '' });
	});
});

describe('Living Inferno', () => {
	it('gives the caster Flame Barrier until the start of their next turn', () => {
		expectFlameBarrier(`${FIRE}/living-inferno.json`, false);
	});
});

describe('Dread Visage', () => {
	const file = `${NECROTIC}/dread-visage.json`;

	it('deals 1d12 to each melee attacker this round, who is Frightened this round', () => {
		const item = readItem(file);
		const visage = effectNamed(item, 'Dread Visage');
		const frightened = effectNamed(item, 'Frightened');

		expect(frightened._id).toBe('HKrFk8DTg4qJdTrU');
		expect(frightened.statuses).toEqual(['frightened']);
		expectMoments(frightened, [endOfRound]);

		expect(visage.transfer).toBe(false);
		expect(visage.statuses).toEqual([]);
		expectMoments(visage, [endOfRound]);
		expect((visage.system.rules as Json[]).map((rule) => rule.type)).toEqual(['damageBack']);
		expectAttackerTakes(ruleOf(visage, 'damageBack'), {
			formula: '1d12',
			answeredAttack: true,
			ignoreArmor: false,
			effectId: 'HKrFk8DTg4qJdTrU',
		});
	});

	it('has only the self step, and upcasts +2 damage', () => {
		const item = readItem(file);
		const visage = effectNamed(item, 'Dread Visage');
		const all = steps(item);
		expect(all.map((node) => node.id)).not.toContain('OafObDpPG61HaLlo');
		expect(all.map((node) => node.id)).not.toContain('6QvkMIw5PbhBn0pO');
		expect(all).toHaveLength(1);
		const step = stepFor(item, visage._id);
		expectRoot(step, 'self');

		expect(onlyDelta(item)).toMatchObject({
			operation: 'raiseEffectRule',
			targetEffectId: step.id,
			ruleId: ruleOf(visage, 'damageBack').id,
			ruleField: 'formula',
			formula: '2',
		});
		expectIds(item);
	});

	it('keeps +2 armor per upcast on its Defend option, with no reminder line', () => {
		const item = readItem(file);
		const defend = (item.system.rules as Json[]).find((rule) => rule.id === 'Gcv5akLtl98FABuV');
		expect(defend).toMatchObject({ type: 'defendOption', reminder: '', upcastArmor: 2 });
	});
});

describe('Enchant Weapon', () => {
	it('enchants the target while the caster concentrates, +KEY per upcast', () => {
		const item = readItem(`${FIRE}/enchant-weapon.json`);
		const effect = effectNamed(item, 'Enchant Weapon');
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expectMoments(effect, [loseConcentration]);
		expectEnchantedWeapon(effect);

		const step = stepFor(item, effect._id);
		expectRoot(step, 'targets');
		expect(onlyDelta(item)).toMatchObject({
			operation: 'raiseEffectRule',
			targetEffectId: step.id,
			ruleId: ruleOf(effect, 'damageBonus').id,
			ruleField: 'value',
			formula: '@key',
		});
		expectIds(item);
	});
});

describe('Fiery Embrace', () => {
	it('enchants the ally and marks the enemies while the caster concentrates', () => {
		const item = readItem(`${FIRE}/fiery-embrace.json`);
		const ally = effectNamed(item, 'Fiery Embrace (ally)');
		const enemy = effectNamed(item, 'Fiery Embrace (enemy)');

		expectMoments(ally, [loseConcentration]);
		expect(ally.statuses).toEqual([]);
		expectEnchantedWeapon(ally);

		expectMoments(enemy, [loseConcentration]);
		expect(enemy.statuses).toEqual(['smoldering']);
		expect(enemy.system.rules).toEqual([]);
		expect(enemy.description).toBe(
			'Loses damage resistance. Damage immunity becomes resistance. Only while within Reach 8 of the caster.',
		);

		expectRoot(stepFor(item, ally._id), 'targets');
		expectRoot(stepFor(item, enemy._id), 'targets');
		expect(onlyDelta(item)).toMatchObject({ operation: 'addTargets', value: 1 });
		expectIds(item);
	});
});

describe('Shadow Trap', () => {
	it('Restrains the creature it hits until it escapes or the caster loses Concentration', () => {
		const item = readItem(`${NECROTIC}/shadow-trap.json`);
		const restrained = effectNamed(item, 'Restrained');
		expect(restrained.img).toBe('icons/svg/net.svg');
		expect(restrained.statuses).toEqual(['restrained']);
		expect(restrained.system.escape).toEqual({ dc: '10+@key', saves: ['strength', 'dexterity'] });
		expectMoments(restrained, [loseConcentration]);
		expect(restrained.system.rules).toEqual([
			expect.objectContaining({ type: 'escapeDamage', formula: '', damageType: '' }),
		]);

		const step = stepFor(item, restrained._id);
		expect(step).toMatchObject({
			recipient: 'targets',
			parentContext: 'hit',
			parentNode: 'tMyTaEsCtivi63VN',
		});
		expect(onlyDelta(item)).toMatchObject({
			operation: 'raiseEffectRule',
			targetEffectId: step.id,
			ruleId: ruleOf(restrained, 'escapeDamage').id,
			ruleField: 'formula',
			formula: '1d12',
		});
		expectIds(item);
	});
});

describe('Withering Touch', () => {
	it('makes the creature it hits count as undead for 1 round', () => {
		const item = readItem(`${NECROTIC}/withering-touch.json`);
		const effect = effectNamed(item, 'Considered Undead');
		expect(effect.description).toBe('This creature counts as undead.');
		expect(effect.statuses).toEqual([]);
		expectMoments(effect, [oneRound]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'tags', tags: ['target:undead'] }),
		]);
		expect(stepFor(item, effect._id)).toMatchObject({
			recipient: 'targets',
			parentContext: 'hit',
			parentNode: 'pJVehDWw1M3Synrn',
		});
		expectIds(item);
	});
});

describe('Dragonform', () => {
	it('gives the caster 10xLVL temp HP, fly 12 and LVL armor until those temp HP are gone, at most 10 minutes', () => {
		const item = readItem(`${FIRE}/dragonform.json`);
		const effect = effectNamed(item, 'Dragonform');
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(item.img);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.tempHp).toBeNull();
		expectMoments(effect, [
			tempHpGone,
			expect.objectContaining({ kind: 'time', value: 10, units: 'minutes' }),
		]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'grantMovement', mode: 'fly', speed: '12' }),
			expect.objectContaining({ type: 'armorClass', formula: '@level', mode: 'add' }),
		]);

		const step = stepFor(item, effect._id);
		expectRoot(step, 'self');
		const healing = steps(item).find((node) => node.id === step.tempHealingNodeId);
		expect(healing).toMatchObject({
			type: 'healing',
			healingType: 'tempHealing',
			formula: '10*@level',
			parentContext: null,
			parentNode: null,
		});
		expectIds(item);
	});
});
