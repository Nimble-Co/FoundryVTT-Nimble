import { describe, expect, it } from 'vitest';
import {
	AFTER_RULES_PHASE,
	MULTIPLY_DOWN_CHANGE,
} from '#documents/activeEffect/multiplyDownChange.js';
import {
	allSteps,
	effectById,
	effectNamed,
	endOfHoldersNextTurn,
	exactMoment,
	expectAtRoot,
	expectNineKeys,
	type Json,
	MOVEMENT_MODES,
	onEvent,
	readItem,
	rootSteps,
	rounds,
	stepsApplying,
	tempHpGone,
} from '../../../../tests/fixtures/packContent.js';

const COMMANDER = 'packs/classFeatures/core/commander';
const SPELLBLADE = `${COMMANDER}/commander-subclasses/spellblade`;
const FILES = {
	tauntingStrike: `${COMMANDER}/commander-subclasses/champion-of-the-bulwark/taunting-strike.json`,
	crystallineArmor: `${SPELLBLADE}/crystalline-armor.json`,
	holdTheLine: `${COMMANDER}/commanders-order/hold-the-line.json`,
	moveIt: `${COMMANDER}/commanders-order/move-it-move-it.json`,
	borneUponTheWind: `${SPELLBLADE}/borne-upon-the-wind.json`,
	faceMe: `${COMMANDER}/commanders-order/face-me.json`,
	glimmeringDecree: `${SPELLBLADE}/glimmering-decree.json`,
	witheringStrike: `${SPELLBLADE}/withering-strike.json`,
};

function nodesOfType(item: Json, type: string): Json[] {
	return allSteps(item).filter((node) => node.type === type);
}

function expectUnique16(ids: string[]): void {
	for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
	expect(new Set(ids).size).toBe(ids.length);
}

describe('Taunting Strike', () => {
	const item = readItem(FILES.tauntingStrike);
	const effect = effectById(item, '6m6zkcBOqyp6h6bW');

	it('Taunted lasts until the end of their next turn', () => {
		expect(effect.statuses).toEqual(['taunted']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfHoldersNextTurn)]);
		expectNineKeys(effect);
	});

	it('applies to the targets at the root', () => {
		const [step] = stepsApplying(item, effect._id);
		expect(stepsApplying(item, effect._id)).toHaveLength(1);
		expect(step?.recipient).toBe('targets');
		expectAtRoot(item, step as Json);
	});

	it('the note says when to use it, not how long', () => {
		const note = allSteps(item).find((node) => node.id === 'TsTauntNote01x9');
		expect(note?.text).toBe('Use after you hit a creature.');
	});
});

describe('Crystalline Armor', () => {
	const item = readItem(FILES.crystallineArmor);
	const holdTheLine = readItem(FILES.holdTheLine);
	const grant = effectNamed(item, 'Hold the Line!');
	const halved = effectNamed(item, 'Crystalline Armor');

	it('heals to 3x LVL with the note of Hold the Line!', () => {
		const heals = nodesOfType(item, 'healing').filter((node) => node.healingType === 'healing');
		expect(heals).toHaveLength(1);
		expect(heals[0]).toEqual(
			expect.objectContaining({ formula: '3 * @level', targetDisposition: 'friendly' }),
		);
		expect((heals[0] as Json).recipient).toBeUndefined();
		expectAtRoot(item, heals[0] as Json);
		const theirNote = nodesOfType(holdTheLine, 'note')[0] as Json;
		const notes = nodesOfType(item, 'note');
		expect(notes).toHaveLength(1);
		expect((notes[0] as Json).text).toBe(theirNote.text);
		expect((notes[0] as Json).noteType).toBe(theirNote.noteType);
	});

	it('gives that many temp HP, held by the Hold the Line! effect on the targets', () => {
		const temps = nodesOfType(item, 'healing').filter((node) => node.healingType === 'tempHealing');
		expect(temps).toHaveLength(1);
		const temp = temps[0] as Json;
		expect(temp.formula).toBe('3 * @level');
		expect(temp.recipient).toBeUndefined();
		expectAtRoot(item, temp);
		const steps = stepsApplying(item, grant._id);
		expect(steps).toHaveLength(1);
		const step = steps[0] as Json;
		expect(step.recipient).toBe('targets');
		expect(step.tempHealingNodeId).toBe(temp.id);
		expectAtRoot(item, step);
	});

	it('Hold the Line! lasts until its temp HP are gone and answers melee enemies who take them', () => {
		expect(grant.transfer).toBe(false);
		expect(grant.statuses).toEqual([]);
		expect(grant.description).toBe(
			'Enemies who reduce this temp HP in melee have their speed halved until the end of their next turn.',
		);
		expect(grant.system.lastsUntil).toEqual([exactMoment(tempHpGone)]);
		expectNineKeys(grant);
		expect(grant.system.changes).toEqual([]);
		const rules = grant.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				type: 'damageBack',
				trigger: 'tempHpReduced',
				attackDelivery: 'melee',
				notOnAllies: true,
				onlyCrits: false,
				amount: 'none',
				attackerEffectId: halved._id,
			}),
		);
	});

	it('the attacker gets a halved speed on all five movement types until the end of their next turn', () => {
		expect(halved.transfer).toBe(false);
		expect(halved.img).toBe(item.img);
		expect(halved.statuses).toEqual([]);
		expect(halved.system.rules).toEqual([]);
		expect(halved.system.changes).toEqual(
			MOVEMENT_MODES.map((mode) => ({
				key: `system.attributes.movement.${mode}`,
				type: MULTIPLY_DOWN_CHANGE,
				value: '0.5',
				phase: AFTER_RULES_PHASE,
				priority: null,
			})),
		);
		expect(halved.system.lastsUntil).toEqual([exactMoment(endOfHoldersNextTurn)]);
		expectNineKeys(halved);
		expect(stepsApplying(item, halved._id)).toEqual([]);
	});

	it('has a 1/encounter use pool on the item', () => {
		const rules = item.system.rules as Json[];
		expect(rules.filter((rule) => rule.type === 'chargePool')).toEqual([
			expect.objectContaining({
				id: 'crystalline-armor-use-pool',
				identifier: 'crystalline-armor-use',
				scope: 'item',
				max: '1',
				initial: 'max',
				recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '1' }],
			}),
		]);
		expect(rules.filter((rule) => rule.type === 'chargeConsumer')).toEqual([
			expect.objectContaining({
				id: 'crystalline-armor-use-consumer',
				poolIdentifier: 'crystalline-armor-use',
				poolScope: 'item',
				cost: '1',
			}),
		]);
	});

	it('uses new ids', () => {
		expectUnique16([
			...allSteps(item).map((node) => node.id),
			...(item.effects as Json[]).map((each) => each._id),
		]);
		const theirs = new Set(allSteps(holdTheLine).map((node) => node.id));
		for (const node of allSteps(item)) expect(theirs.has(node.id)).toBe(false);
	});
});

describe('Move it! Move it!', () => {
	const item = readItem(FILES.moveIt);
	const effect = effectNamed(item, 'Move it! Move it!');

	it('+3 speed for 1 round', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([exactMoment(rounds(1))]);
		expectNineKeys(effect);
		const rules = effect.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({ type: 'speedBonus', value: '3', movementType: null }),
		);
	});

	it('applies to you and to the targets at the root', () => {
		const steps = stepsApplying(item, effect._id);
		expect(steps.map((step) => step.recipient).sort()).toEqual(['self', 'targets']);
		for (const step of steps) expectAtRoot(item, step);
	});

	it('the note keeps the Initiative advantage only', () => {
		const note = allSteps(item).find((node) => node.id === 'JyS0bPpvH6ttPAoG');
		expect(note?.text).toBe(
			'Roll Initiative with advantage, and give one ally advantage on theirs.',
		);
	});
});

describe('Borne Upon the Wind', () => {
	const item = readItem(FILES.borneUponTheWind);
	const moveIt = readItem(FILES.moveIt);
	const effect = effectNamed(item, 'Borne upon the Wind');

	it('costs what Move it! Move it! costs and has its note', () => {
		expect(item.system.activation.cost).toEqual(moveIt.system.activation.cost);
		const notes = nodesOfType(item, 'note');
		expect(notes).toHaveLength(1);
		expect((notes[0] as Json).text).toBe(
			'Roll Initiative with advantage, and give one ally advantage on theirs.',
		);
		expectAtRoot(item, notes[0] as Json);
	});

	it('+3 speed and a fly speed equal to the holder walk speed for 1 round', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.readsHolder).toBe(true);
		expect(effect.system.lastsUntil).toEqual([exactMoment(rounds(1))]);
		expectNineKeys(effect);
		const rules = effect.system.rules as Json[];
		expect(rules).toHaveLength(2);
		expect(rules).toEqual([
			expect.objectContaining({ type: 'speedBonus', value: '3', movementType: null }),
			expect.objectContaining({
				type: 'grantMovement',
				mode: 'fly',
				speed: '@attributes.movement.walk',
			}),
		]);
	});

	it('applies to you and to the targets at the root', () => {
		const steps = stepsApplying(item, effect._id);
		expect(steps.map((step) => step.recipient).sort()).toEqual(['self', 'targets']);
		for (const step of steps) expectAtRoot(item, step);
	});

	it('you and the ally can move up to your speed for free', () => {
		const moves = nodesOfType(item, 'move');
		expect(moves.map((move) => move.recipient).sort()).toEqual(['self', 'targets']);
		for (const move of moves) {
			expect(move).toEqual(
				expect.objectContaining({ kind: 'free', distance: '@speed', direction: 'any' }),
			);
			expectAtRoot(item, move);
		}
	});
});

describe('Face Me!', () => {
	const item = readItem(FILES.faceMe);
	const effect = effectById(item, 'v1n3D0aPlxUBQGsB');

	it('Taunted lasts until you drop to 0 HP', () => {
		expect(effect.statuses).toEqual(['taunted']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(onEvent('source', 'zeroHp'))]);
		expectNineKeys(effect);
	});

	it('applies to the targets at the root', () => {
		const steps = stepsApplying(item, effect._id);
		expect(steps).toHaveLength(1);
		expect((steps[0] as Json).recipient).toBe('targets');
		expectAtRoot(item, steps[0] as Json);
	});
});

describe('Glimmering Decree', () => {
	const item = readItem(FILES.glimmeringDecree);
	const faceMe = readItem(FILES.faceMe);
	const effect = effectNamed(item, 'Taunted');

	it('is a reaction that costs what Face Me! costs', () => {
		expect(item.system.activation.cost).toEqual(faceMe.system.activation.cost);
		expect(item.system.activation.cost.isReaction).toBe(true);
	});

	it('deals STR d8 radiant damage, ignoring armor, that cannot crit or miss', () => {
		const damages = nodesOfType(item, 'damage');
		expect(damages).toHaveLength(1);
		const damage = damages[0] as Json;
		expect(damage).toEqual(
			expect.objectContaining({
				formula: '(@strength)d8',
				damageType: 'radiant',
				ignoreArmor: true,
				canCrit: false,
				canMiss: false,
			}),
		);
		expectAtRoot(item, damage);
		const raw = rootSteps(item).find((node) => node.id === damage.id) as Json;
		expect(raw.on.hit).toEqual([
			expect.objectContaining({ type: 'damageOutcome', outcome: 'fullDamage' }),
		]);
	});

	it('pulls the target up to 4 spaces toward you', () => {
		const moves = nodesOfType(item, 'move');
		expect(moves).toHaveLength(1);
		const move = moves[0] as Json;
		expect(move).toEqual(
			expect.objectContaining({
				kind: 'forced',
				recipient: 'targets',
				distance: '4',
				direction: 'toward',
				upTo: true,
			}),
		);
		expectAtRoot(item, move);
	});

	it('Taunted lasts until you drop to 0 HP and applies to the targets at the root', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual(['taunted']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(onEvent('source', 'zeroHp'))]);
		expectNineKeys(effect);
		const steps = stepsApplying(item, effect._id);
		expect(steps).toHaveLength(1);
		expect((steps[0] as Json).recipient).toBe('targets');
		expectAtRoot(item, steps[0] as Json);
	});
});

describe('Withering Strike', () => {
	const item = readItem(FILES.witheringStrike);
	const effect = effectNamed(item, 'Considered Undead');

	it('the enemy counts as undead for 1 round', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([exactMoment(rounds(1))]);
		expectNineKeys(effect);
		const rules = effect.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(expect.objectContaining({ type: 'tags', tags: ['target:undead'] }));
	});

	it('applies to the targets at the root, with no damage step', () => {
		const steps = stepsApplying(item, effect._id);
		expect(steps).toHaveLength(1);
		expect((steps[0] as Json).recipient).toBe('targets');
		expectAtRoot(item, steps[0] as Json);
		expect(nodesOfType(item, 'damage')).toEqual([]);
	});
});
