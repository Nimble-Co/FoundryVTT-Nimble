import { describe, expect, it } from 'vitest';
import {
	allSteps,
	effectNamed,
	endOfRound,
	expectLastsUntil,
	expectNewIds,
	expectRootRecipient,
	type Json,
	looseMoment,
	type Moment,
	minutes,
	readItem,
	rounds,
	startOfHoldersNextTurn,
	stepApplying,
	tempHpGone,
	whileConcentrating,
} from '../../../../tests/fixtures/packContent.js';

const FIRE = 'packs/spells/core/fire';
const NECROTIC = 'packs/spells/core/necrotic';

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

/** The fields of each moment's kind, an empty effect name, and the nine keys. */
function expectLooseMoments(effect: Json, moments: Moment[]): void {
	expectLastsUntil(
		effect,
		moments.map((moment) => looseMoment(moment, 'effectName')),
	);
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
	expectLooseMoments(barrier, [startOfHoldersNextTurn]);
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

	const step = stepApplying(item, barrier._id);
	expectRootRecipient(step, 'self');
	expect(allSteps(item).filter((node) => node.effectId === smoldering._id)).toEqual([]);

	expect(onlyDelta(item)).toMatchObject({
		operation: 'raiseEffectRule',
		targetEffectId: step.id,
		ruleId: ruleOf(barrier, 'damageBack').id,
		ruleField: 'formula',
		formula: '@key',
	});
	expectNewIds(item);
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
		attackSource: 'weapon',
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
		expectLooseMoments(frightened, [endOfRound]);

		expect(visage.transfer).toBe(false);
		expect(visage.statuses).toEqual([]);
		expectLooseMoments(visage, [endOfRound]);
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
		const all = allSteps(item);
		expect(all.map((node) => node.id)).not.toContain('OafObDpPG61HaLlo');
		expect(all.map((node) => node.id)).not.toContain('6QvkMIw5PbhBn0pO');
		expect(all).toHaveLength(1);
		const step = stepApplying(item, visage._id);
		expectRootRecipient(step, 'self');

		expect(onlyDelta(item)).toMatchObject({
			operation: 'raiseEffectRule',
			targetEffectId: step.id,
			ruleId: ruleOf(visage, 'damageBack').id,
			ruleField: 'formula',
			formula: '2',
		});
		expectNewIds(item);
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
		expectLooseMoments(effect, [whileConcentrating]);
		expectEnchantedWeapon(effect);

		const step = stepApplying(item, effect._id);
		expectRootRecipient(step, 'targets');
		expect(onlyDelta(item)).toMatchObject({
			operation: 'raiseEffectRule',
			targetEffectId: step.id,
			ruleId: ruleOf(effect, 'damageBonus').id,
			ruleField: 'value',
			formula: '@key',
		});
		expectNewIds(item);
	});
});

describe('Fiery Embrace', () => {
	it('enchants the ally and marks the enemies while the caster concentrates', () => {
		const item = readItem(`${FIRE}/fiery-embrace.json`);
		const ally = effectNamed(item, 'Fiery Embrace (ally)');
		const enemy = effectNamed(item, 'Fiery Embrace (enemy)');

		expectLooseMoments(ally, [whileConcentrating]);
		expect(ally.statuses).toEqual([]);
		expectEnchantedWeapon(ally);

		expectLooseMoments(enemy, [whileConcentrating]);
		expect(enemy.statuses).toEqual(['smoldering']);
		expect(enemy.system.rules).toEqual([]);
		expect(enemy.description).toBe(
			'Loses damage resistance. Damage immunity becomes resistance. Only while within Reach 8 of the caster.',
		);

		expectRootRecipient(stepApplying(item, ally._id), 'targets');
		expectRootRecipient(stepApplying(item, enemy._id), 'targets');
		expect(onlyDelta(item)).toMatchObject({ operation: 'addTargets', value: 1 });
		expectNewIds(item);
	});
});

describe('Shadow Trap', () => {
	it('Restrains the creature it hits until it escapes or the caster loses Concentration', () => {
		const item = readItem(`${NECROTIC}/shadow-trap.json`);
		const restrained = effectNamed(item, 'Restrained');
		expect(restrained.img).toBe('icons/svg/net.svg');
		expect(restrained.statuses).toEqual(['restrained']);
		expect(restrained.system.escape).toEqual({ dc: '10+@key', saves: ['strength', 'dexterity'] });
		expectLooseMoments(restrained, [whileConcentrating]);
		expect(restrained.system.rules).toEqual([
			expect.objectContaining({ type: 'escapeDamage', formula: '', damageType: '' }),
		]);

		const step = stepApplying(item, restrained._id);
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
		expectNewIds(item);
	});
});

describe('Withering Touch', () => {
	it('makes the creature it hits count as undead for 1 round', () => {
		const item = readItem(`${NECROTIC}/withering-touch.json`);
		const effect = effectNamed(item, 'Considered Undead');
		expect(effect.description).toBe('This creature counts as undead.');
		expect(effect.statuses).toEqual([]);
		expectLooseMoments(effect, [rounds(1)]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'tags', tags: ['target:undead'] }),
		]);
		expect(stepApplying(item, effect._id)).toMatchObject({
			recipient: 'targets',
			parentContext: 'hit',
			parentNode: 'pJVehDWw1M3Synrn',
		});
		expectNewIds(item);
	});
});

describe('Dragonform', () => {
	it('gives the caster 10xLVL temp HP, fly 12 and LVL armor until those temp HP are gone, at most 10 minutes, then 0 HP', () => {
		const item = readItem(`${FIRE}/dragonform.json`);
		const effect = effectNamed(item, 'Dragonform');
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(item.img);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.tempHp).toBeNull();
		expectLooseMoments(effect, [tempHpGone, minutes(10)]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'grantMovement', mode: 'fly', speed: '12' }),
			expect.objectContaining({ type: 'armorClass', formula: '@level', mode: 'add' }),
			expect.objectContaining({ type: 'zeroHpAtEnd', disabled: false }),
		]);

		const step = stepApplying(item, effect._id);
		expectRootRecipient(step, 'self');
		const healing = allSteps(item).find((node) => node.id === step.tempHealingNodeId);
		expect(healing).toMatchObject({
			type: 'healing',
			healingType: 'tempHealing',
			formula: '10*@level',
			parentContext: null,
			parentNode: null,
		});
		expectNewIds(item);
	});
});
