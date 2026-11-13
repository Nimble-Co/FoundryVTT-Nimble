import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const CF = 'packs/classFeatures/core';
const FILES = {
	blindingAura: `${CF}/oathsworn/sacred-decree/blinding-aura.json`,
	faceMe: `${CF}/oathsworn/oathsworn-subclasses/oath-of-refuge/face-me-foul-creature.json`,
	rhapsody: `${CF}/songweaver/lyrical-weaponry/rhapsody-of-the-normal.json`,
	songOfDomination: `${CF}/songweaver/lyrical-weaponry/song-of-domination.json`,
	fightPicker: `${CF}/songweaver/songweaver-subclasses/herald-of-snark/fight-picker.json`,
	oneWithShadows: `${CF}/shadowmancer/greater-invocations/one-with-shadows.json`,
	glacialResilience: `${CF}/shadowmancer/shadowmancer-subclasses/pact-of-the-abyssal-depths/glacial-resilience.json`,
	illuminateSoul: `${CF}/shepherd/sacred-graces/illuminate-soul.json`,
	assistMe: `${CF}/shepherd/sacred-graces/assist-me-my-friend.json`,
	beastshift: `${CF}/stormshifter/stormshifter-progression/beastshift.json`,
	beastOfNightmares: `${CF}/stormshifter/direbeast-form/beast-of-nightmares.json`,
	primordialForce: `${CF}/stormshifter/stormshifter-subclasses/circle-of-sky-and-storm/primordial-force.json`,
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

const rootNodes = (item: Json): Json[] => item.system.activation.effects as Json[];

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

function rulesOfType(rules: Json[], type: string): Json[] {
	return rules.filter((rule) => rule.type === type);
}

function expectAtRoot(item: Json, step: Json): void {
	expect(step.parentNode).toBeNull();
	expect(step.parentContext).toBeNull();
	expect(rootNodes(item).map((node) => node.id)).toContain(step.id);
}

function expectOnFailedSave(item: Json, step: Json, saveId: string): void {
	expect(step.parentNode).toBe(saveId);
	expect(step.parentContext).toBe('failedSave');
	const save = rootNodes(item).find((node) => node.id === saveId) as Json;
	expect(save.type).toBe('savingThrow');
	expect((save.on.failedSave as Json[]).map((node) => node.id)).toContain(step.id);
}

/** An effect that only the Apply Effect step gives: not on the owner, nine keys per moment. */
function expectTimedEffect(effect: Json): void {
	expect(effect.transfer).toBe(false);
	expect(effect.type).toBe('nimble');
	for (const moment of effect.system.lastsUntil as Json[]) {
		expect(Object.keys(moment).sort()).toEqual(MOMENT_KEYS);
	}
}

/** A pool of 1 use on the item with its consumer, as Hold the Line! has. */
function expectUsePool(item: Json, identifier: string, triggers: string[]): void {
	const rules = item.system.rules as Json[];
	expect(rulesOfType(rules, 'chargePool')).toEqual([
		expect.objectContaining({
			identifier,
			scope: 'item',
			max: '1',
			recoveries: triggers.map((trigger) => ({ trigger, mode: 'refresh', value: '1' })),
		}),
	]);
	expect(rulesOfType(rules, 'chargeConsumer')).toEqual([
		expect.objectContaining({ poolIdentifier: identifier, poolScope: 'item', cost: '1' }),
	]);
}

const turn = (
	boundary: 'start' | 'end',
	clock: 'holder' | 'any',
	span: 'nextTurn' | 'currentTurn',
) =>
	expect.objectContaining({
		kind: 'turn',
		boundary,
		clock,
		span,
		value: null,
		units: null,
		who: null,
		event: null,
		effectName: '',
	});

const TE = turn('end', 'holder', 'nextTurn');
const TEc = turn('end', 'holder', 'currentTurn');
const TANY = turn('end', 'any', 'currentTurn');

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
		effectName: '',
	});

const event = (who: string, name: string) =>
	expect.objectContaining({
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who,
		event: name,
		effectName: '',
	});

describe('Blinding Aura', () => {
	const item = readItem(FILES.blindingAura);
	const effect = effectNamed(item, 'Blinded');

	it('Blinded lasts until the end of their next turn', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual(['blinded']);
		expect(effect.system.lastsUntil).toEqual([TE]);
	});

	it('applies to the targets at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});

	it('is 1/Safe Rest', () => {
		expectUsePool(item, 'blinding-aura-use', ['safeRest']);
	});
});

describe('Face Me, Foul Creature!', () => {
	const item = readItem(FILES.faceMe);
	const effect = effectNamed(item, 'Taunted');

	it('Taunted lasts until the end of their next turn', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual(['taunted']);
		expect(effect.system.lastsUntil).toEqual([TE]);
	});

	it('is a Defend window tick that also goes with an Interpose and gives the attacker Taunted', () => {
		const rules = rulesOfType(item.system.rules as Json[], 'defendOption');
		expect(rules).toEqual([
			expect.objectContaining({
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				alsoInterpose: true,
				attackerEffectId: effect._id,
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				chargePoolIdentifier: '',
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			}),
		]);
	});

	it('has no step of its own', () => {
		expect(rootNodes(item)).toEqual([]);
	});
});

describe('Rhapsody of the Normal', () => {
	const item = readItem(FILES.rhapsody);
	const effect = effectNamed(item, 'Rhapsody of the Normal');

	it('is a marker with the villager text until the end of their next turn', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toContain('untrained average villager');
		expect(effect.description).toContain('attack once for 1d4 damage and move up to 6 spaces');
		expect(effect.system.lastsUntil).toEqual([TE]);
	});

	it('applies to the targets at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});

	it("spends a Songweaver's Inspiration charge", () => {
		const rules = item.system.rules as Json[];
		expect(rulesOfType(rules, 'chargeConsumer')).toEqual([
			expect.objectContaining({
				poolIdentifier: 'songweavers-inspiration',
				poolScope: 'item',
				cost: '1',
			}),
		]);
		expect(rulesOfType(rules, 'chargePool')).toEqual([]);
	});
});

describe('Song of Domination', () => {
	const item = readItem(FILES.songOfDomination);
	const effect = effectNamed(item, 'Song of Domination');
	const saves = nodesOf(item).filter((node) => node.type === 'savingThrow');

	it('costs 2 actions', () => {
		expect(item.system.activation.cost).toEqual(
			expect.objectContaining({ type: 'action', quantity: 2, isReaction: false }),
		);
	});

	it('has one WIL save at the root with the hero DC', () => {
		expect(saves).toHaveLength(1);
		const save = saves[0] as Json;
		expect(save.savingThrowType).toBe('will');
		expect(save.saveType).toBeUndefined();
		expect(save.saveDC).toBe('');
		expectAtRoot(item, save);
	});

	it('the no-move marker lasts until the end of their next turn and comes on a failed save', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe('Cannot move on its next turn.');
		expect(effect.system.lastsUntil).toEqual([TE]);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectOnFailedSave(item, step, (saves[0] as Json).id);
	});

	it('is 1/encounter', () => {
		expectUsePool(item, 'song-of-domination-use', ['encounterStart']);
	});
});

describe('Fight Picker', () => {
	const item = readItem(FILES.fightPicker);
	const effect = effectNamed(item, 'Fight Picker');

	it("the ally's taunt is a marker until the end of this creature's turn", () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe(
			"Taunted by the ally the Songweaver chose, until the end of this creature's turn.",
		);
		expect(effect.system.lastsUntil).toEqual([TEc]);
	});

	it('applies to the targets at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});

	it('is 1/turn', () => {
		expectUsePool(item, 'fight-picker-use', ['onAnyTurnStart', 'encounterEnd']);
	});
});

describe('One with Shadows', () => {
	const item = readItem(FILES.oneWithShadows);
	const effect = effectNamed(item, 'Invisible');

	it('costs 1 action', () => {
		expect(item.system.activation.cost).toEqual(
			expect.objectContaining({ type: 'action', quantity: 1, isReaction: false }),
		);
	});

	it('Invisible lasts until you move or attack', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual(['invisible']);
		expect(effect.system.lastsUntil).toEqual([event('holder', 'move'), event('holder', 'attack')]);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Glacial Resilience', () => {
	const item = readItem(FILES.glacialResilience);
	const effect = effectNamed(item, 'Glacial Resilience');
	const roots = rootNodes(item);

	it('is a reaction when you are attacked or would gain a condition', () => {
		expect(item.system.activation.cost).toEqual({
			details: 'whenever you are attacked or would gain a condition',
			quantity: 1,
			type: 'action',
			isReaction: true,
		});
	});

	it('ends all negative conditions on you', () => {
		expect(roots).toContainEqual(
			expect.objectContaining({
				type: 'endConditions',
				recipient: 'self',
				which: 'negative',
				conditions: [],
				parentContext: null,
				parentNode: null,
			}),
		);
	});

	it('gives you 10xLVL temp HP that the effect takes back at the end of your next turn', () => {
		const healing = roots.filter((node) => node.type === 'healing');
		expect(healing).toEqual([
			expect.objectContaining({
				healingType: 'tempHealing',
				formula: '10*@level',
				recipient: 'self',
				parentContext: null,
				parentNode: null,
			}),
		]);
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([TE]);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expect(step.tempHealingNodeId).toBe((healing[0] as Json).id);
		expectAtRoot(item, step);
	});

	it('is 1/Safe Rest', () => {
		expectUsePool(item, 'glacial-resilience-use', ['safeRest']);
	});
});

describe('Illuminate Soul', () => {
	const item = readItem(FILES.illuminateSoul);

	it.each([
		['Illuminate Soul (advantage)', 1],
		['Illuminate Soul (disadvantage)', -1],
	])('%s: attacks against them for 1 round, a step for the targets at the root', (name, value) => {
		const effect = effectNamed(item, name);
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([time(1, 'rounds')]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'advantage',
				value,
				whichRoll: 'attacksOnHolder',
				usedUp: false,
			}),
		]);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});

	it('can be used WIL times per Safe Rest', () => {
		const rules = item.system.rules as Json[];
		expect(rulesOfType(rules, 'chargePool')).toEqual([
			expect.objectContaining({
				identifier: 'illuminate-soul',
				max: 'max(@will, 0)',
				recoveries: [expect.objectContaining({ trigger: 'safeRest', mode: 'refresh' })],
			}),
		]);
		const pool = rulesOfType(rules, 'chargePool')[0] as Json;
		expect(rulesOfType(rules, 'chargeConsumer')).toEqual([
			expect.objectContaining({
				poolIdentifier: 'illuminate-soul',
				poolScope: pool.scope,
				cost: '1',
			}),
		]);
	});
});

describe('Assist Me, My Friend!', () => {
	const item = readItem(FILES.assistMe);

	it("offers the Lifebinding Spirit's damage on a melee attack, unticked", () => {
		expect(item.system.rules).toEqual([
			expect.objectContaining({
				type: 'conditionalBonus',
				advantage: 0,
				damageOfItem: 'lifebinding-spirit',
				startsChosen: false,
				delivery: 'melee',
				source: 'any',
				doubleFor: [],
				targetCondition: {},
				damageBonus: '',
				damageType: '',
			}),
		]);
	});
});

describe('Beastshift', () => {
	const item = readItem(FILES.beastshift);
	const effect = effectNamed(item, 'Beastshift');

	it('the form is a marker until you drop to 0 HP or cast a spell', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe(
			'You are a harmless beast (squirrel, pigeon, etc.) and can speak with animals.',
		);
		expect(effect.system.lastsUntil).toEqual([
			event('holder', 'zeroHp'),
			event('holder', 'castSpell'),
		]);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});

	it('keeps its DEX charges', () => {
		const rules = item.system.rules as Json[];
		expect(rulesOfType(rules, 'chargePool')).toEqual([
			expect.objectContaining({ identifier: 'beastshift', max: 'max(@dexterity, 0)' }),
		]);
		expect(rulesOfType(rules, 'chargeConsumer')).toEqual([
			expect.objectContaining({ poolIdentifier: 'beastshift', cost: '1' }),
		]);
	});
});

describe('Beast of Nightmares', () => {
	const item = readItem(FILES.beastOfNightmares);
	const effect = effectNamed(item, 'Silent But Deadly');

	it('is a marker until you attack, drop to 0 HP or cast a spell', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe(
			'Attackers cannot target you until you become conspicuous (for example, seen transforming or attacking).',
		);
		expect(effect.system.lastsUntil).toEqual([
			event('holder', 'attack'),
			event('holder', 'zeroHp'),
			event('holder', 'castSpell'),
		]);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Primordial Force', () => {
	const item = readItem(FILES.primordialForce);
	const effect = effectNamed(item, 'Primordial Force: Wind');
	const roots = rootNodes(item);

	it('is used for free when you spend 2 or more mana on a spell', () => {
		expect(item.system.rules).toEqual([
			expect.objectContaining({
				type: 'useItemFree',
				itemIdentifier: 'primordial-force',
				triggers: ['onSpellCast'],
				manaAtLeast: 2,
				freeOf: ['uses', 'mana'],
			}),
		]);
	});

	it('Ice: you gain WIL temp HP', () => {
		expect(roots).toContainEqual(
			expect.objectContaining({
				type: 'healing',
				healingType: 'tempHealing',
				formula: '@will',
				recipient: 'self',
			}),
		);
	});

	it('Lightning: WIL extra damage with no type that cannot crit or miss', () => {
		const damage = roots.filter((node) => node.type === 'damage');
		expect(damage).toEqual([
			expect.objectContaining({
				formula: '@will',
				damageType: '',
				canCrit: false,
				canMiss: false,
			}),
		]);
		expect((damage[0] as Json).on.hit).toEqual([
			expect.objectContaining({ type: 'damageOutcome', outcome: 'fullDamage' }),
		]);
	});

	it('Radiant: heals a target WIL HP', () => {
		const heals = roots.filter((node) => node.type === 'healing' && node.healingType === 'healing');
		expect(heals).toEqual([expect.objectContaining({ formula: '@will' })]);
		expect((heals[0] as Json).recipient).toBeUndefined();
	});

	it('Wind: a fly speed for the turn, applied to you only on a click', () => {
		expectTimedEffect(effect);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([TANY]);
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'grantMovement',
				mode: 'fly',
				speed: '@attributes.movement.walk',
			}),
		]);
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expect(step.waitsForClick).toBe(true);
		expectAtRoot(item, step);
	});

	it('Wind: you move up to 6 spaces for free', () => {
		expect(roots).toContainEqual(
			expect.objectContaining({
				type: 'move',
				kind: 'free',
				recipient: 'self',
				distance: '6',
				upTo: true,
				direction: 'any',
				parentContext: null,
				parentNode: null,
			}),
		);
	});
});
