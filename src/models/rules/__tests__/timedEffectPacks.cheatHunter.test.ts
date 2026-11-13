import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	AFTER_RULES_PHASE,
	MULTIPLY_DOWN_CHANGE,
} from '#documents/activeEffect/multiplyDownChange.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const CHEAT = 'packs/classFeatures/core/the-cheat';
const HUNTER = 'packs/classFeatures/core/hunter';
const FILES = {
	imOuttaHere: `${CHEAT}/underhanded-abilities/im-outta-here.json`,
	amidstAllThisCommotion: `${CHEAT}/the-cheat-subclasses/tools-of-the-silent-blade/amidst-all-this-commotion.json`,
	lowBlow: `${CHEAT}/the-cheat-subclasses/tools-of-the-scoundrel/low-blow.json`,
	sunderArmorMedium: `${CHEAT}/underhanded-abilities/sunder-armor-medium.json`,
	escapePlan: `${CHEAT}/the-cheat-subclasses/tools-of-the-scoundrel/escape-plan.json`,
	comeGetSome: `${HUNTER}/thrill-of-the-hunt/come-get-some.json`,
	hailOfArrows: `${HUNTER}/thrill-of-the-hunt/hail-of-arrows.json`,
	primalPredator: `${HUNTER}/hunter-subclasses/keeper-of-the-shadowpath/primal-predator.json`,
	apexPredator: `${HUNTER}/hunter-subclasses/keeper-of-the-shadowpath/apex-predator.json`,
	pinningShot: `${HUNTER}/thrill-of-the-hunt/pinning-shot.json`,
	snareTrap: `${HUNTER}/thrill-of-the-hunt/snare-trap.json`,
	huntersMark: `${HUNTER}/hunter-progression/hunters-mark.json`,
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

const MOVEMENT_MODES = ['walk', 'fly', 'climb', 'swim', 'burrow'];

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

function rulesOfType(rules: Json[], type: string): Json[] {
	return rules.filter((rule) => rule.type === type);
}

function expectAtRoot(item: Json, step: Json): void {
	expect(step.parentNode).toBeNull();
	expect(step.parentContext).toBeNull();
	expect((item.system.activation.effects as Json[]).map((node) => node.id)).toContain(step.id);
}

function expectOnHit(item: Json, step: Json, damageId: string): void {
	expect(step.parentNode).toBe(damageId);
	expect(step.parentContext).toBe('hit');
	const damage = rawNode(item.system.activation.effects as Json[], damageId) as Json;
	expect(damage.type).toBe('damage');
	expect((damage.on.hit as Json[]).map((node) => node.id)).toContain(step.id);
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

const turn = (
	boundary: 'start' | 'end',
	clock: 'holder' | 'source',
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
const TS = turn('start', 'holder', 'nextTurn');
const TEc = turn('end', 'holder', 'currentTurn');
const TSs = turn('start', 'source', 'nextTurn');

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

describe("I'm Outta Here!", () => {
	const item = readItem(FILES.imOuttaHere);
	const effect = effectById(item, 'zsVyKnhDFlxwDX9R');

	it('Invisible lasts until the end of your next turn', () => {
		expect(effect.statuses).toEqual(['invisible']);
		expect(effect.system.lastsUntil).toEqual([TE]);
		expectNineKeys(effect);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Amidst All This Commotion', () => {
	const item = readItem(FILES.amidstAllThisCommotion);
	const effect = effectById(item, 'zBTSkdEvTl3DHKvJ');

	it('Invisible lasts until you attack or the start of your next turn', () => {
		expect(effect.statuses).toEqual(['invisible']);
		expect(effect.system.lastsUntil).toEqual([event('holder', 'attack'), TS]);
		expectNineKeys(effect);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Low Blow', () => {
	const item = readItem(FILES.lowBlow);
	const incapacitated = effectById(item, 'v0YvmeL7XTwk2mYu');
	const taunted = effectById(item, 'VbE63saZhyxxIbjE');
	const saves = nodesOf(item).filter((node) => node.type === 'savingThrow');

	it('has one STR save at the root with DC 10+INT', () => {
		expect(saves).toHaveLength(1);
		const save = saves[0] as Json;
		expect(save.savingThrowType).toBe('strength');
		expect(save.saveType).toBeUndefined();
		expect(save.saveDC).toBe('10+@intelligence');
		expectAtRoot(item, save);
	});

	it('Incapacitated lasts for their next turn and comes on a failed save', () => {
		expect(incapacitated.statuses).toEqual(['incapacitated']);
		expect(incapacitated.system.lastsUntil).toEqual([TE]);
		expectNineKeys(incapacitated);
		const step = stepOf(item, incapacitated._id);
		expect(step.id).toBe('r5ukBBJ3p1I8awLr');
		expect(step.recipient).toBe('targets');
		expectOnFailedSave(item, step, (saves[0] as Json).id);
	});

	it('Taunted lasts until you drop to 0 HP and comes save or fail', () => {
		expect(taunted.statuses).toEqual(['taunted']);
		expect(taunted.system.lastsUntil).toEqual([event('source', 'zeroHp')]);
		expectNineKeys(taunted);
		const step = stepOf(item, taunted._id);
		expect(step.id).toBe('TadcniVBHxG6oYAs');
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});

	it('keeps its cost', () => {
		expect(item.system.activation.cost).toEqual(
			expect.objectContaining({ type: 'none', quantity: 1 }),
		);
	});
});

describe('Sunder Armor (Medium)', () => {
	const item = readItem(FILES.sunderArmorMedium);
	const effect = effectNamed(item, 'Sundered Armor');

	it('lets melee attacks against the target ignore armor until the start of your next turn', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([TSs]);
		expectNineKeys(effect);
		const rules = effect.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				type: 'attackOutcome',
				side: 'attacksAgainstYou',
				attackDelivery: 'melee',
				ignoreArmor: true,
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'none',
				attackSource: 'any',
				thisItemOnly: false,
				chargePoolIdentifier: '',
			}),
		);
	});

	it('applies to the targets at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});

	it('costs 1 action', () => {
		expect(item.system.activation.cost).toEqual(
			expect.objectContaining({ type: 'action', quantity: 1 }),
		);
	});
});

describe('Escape Plan', () => {
	const item = readItem(FILES.escapePlan);
	const effect = effectById(item, 'i5y6fr6yOfrN659s');

	it('Invisible lasts 1 minute or until you attack', () => {
		expect(effect.statuses).toEqual(['invisible']);
		expect(effect.system.lastsUntil).toEqual([time(1, 'minutes'), event('holder', 'attack')]);
		expectNineKeys(effect);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Come Get Some!', () => {
	const item = readItem(FILES.comeGetSome);
	const effect = effectById(item, 'VVT5y8qfBnOYZmHo');

	it('Taunted lasts until the end of their next turn', () => {
		expect(effect.statuses).toEqual(['taunted']);
		expect(effect.system.lastsUntil).toEqual([TE]);
		expectNineKeys(effect);
	});

	it('applies to the targets on a hit', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectOnHit(item, step, 'comeGetSomeDmg00');
	});
});

describe('Hail of Arrows', () => {
	const item = readItem(FILES.hailOfArrows);
	const effect = effectById(item, 'dNLZfEe90lFwHQRD');

	it('is a halved speed, not the Slowed condition', () => {
		expect(effect.name).toBe('Hail of Arrows');
		expect(effect.img).toBe(item.img);
		expect(effect.statuses).toEqual([]);
	});

	it('halves all five movement types after every rule', () => {
		expect(effect.system.changes).toEqual(
			MOVEMENT_MODES.map((mode) => ({
				key: `system.attributes.movement.${mode}`,
				type: MULTIPLY_DOWN_CHANGE,
				value: '0.5',
				phase: AFTER_RULES_PHASE,
				priority: null,
			})),
		);
	});

	it('lasts until the end of their next turn', () => {
		expect(effect.system.lastsUntil).toEqual([TE]);
		expectNineKeys(effect);
	});

	it('applies to the targets on a hit', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		expectOnHit(item, step, 'hailOfArrowsDmg0');
	});
});

describe('Primal Predator', () => {
	const item = readItem(FILES.primalPredator);
	const effect = effectNamed(item, 'Primal Predator');

	it('your weapon attacks ignore armor this turn', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe('Your weapon attacks also ignore cover.');
		expect(effect.system.lastsUntil).toEqual([TEc]);
		expectNineKeys(effect);
		const rules = effect.system.rules as Json[];
		expect(rules).toHaveLength(1);
		expect(rules[0]).toEqual(
			expect.objectContaining({
				type: 'attackOutcome',
				side: 'yourAttacks',
				attackSource: 'weapon',
				attackDelivery: 'any',
				ignoreArmor: true,
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'none',
				thisItemOnly: false,
				chargePoolIdentifier: '',
			}),
		);
	});

	it('applies to you at the root', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});

	it('has a 1/encounter use pool on the item', () => {
		const rules = item.system.rules as Json[];
		const pools = rulesOfType(rules, 'chargePool');
		expect(pools).toEqual([
			expect.objectContaining({
				identifier: 'primal-predator-use',
				scope: 'item',
				max: '1',
				recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '1' }],
			}),
		]);
		expect(rulesOfType(rules, 'chargeConsumer')).toEqual([
			expect.objectContaining({
				poolIdentifier: 'primal-predator-use',
				poolScope: 'item',
				cost: '1',
			}),
		]);
	});
});

describe('Apex Predator', () => {
	it('lets you use Primal Predator twice each encounter', () => {
		const rules = readItem(FILES.apexPredator).system.rules as Json[];
		expect(rules).toContainEqual(
			expect.objectContaining({
				type: 'modifyPool',
				poolType: 'charge',
				poolIdentifier: 'primal-predator-use',
				maxDelta: '1',
			}),
		);
	});
});

describe.each([
	['Pinning Shot', FILES.pinningShot, 'daTg3tG701pkS4Py', 'pinningShotDmg00'],
	['Snare Trap', FILES.snareTrap, 'aubE0PN4zGzA4nwT', null],
])('%s', (_name, file, effectId, damageId) => {
	const item = readItem(file);
	const effect = effectById(item, effectId);

	it('Restrained until they escape (DC 10+WIL), with no other end', () => {
		expect(effect.statuses).toEqual(['restrained']);
		expect(effect.system.escape).toEqual(
			expect.objectContaining({ dc: '10+@will', saves: ['strength', 'dexterity'] }),
		);
		expect(effect.system.escape.noDc ?? false).toBe(false);
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets', () => {
		const step = stepOf(item, effect._id);
		expect(step.recipient).toBe('targets');
		if (damageId) expectOnHit(item, step, damageId);
		else expectAtRoot(item, step);
	});
});

describe("Hunter's Mark", () => {
	const item = readItem(FILES.huntersMark);
	const effect = effectNamed(item, "Hunter's Mark");

	it('the mark lasts 1 day', () => {
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.system.lastsUntil).toEqual([time(1, 'days')]);
		expectNineKeys(effect);
	});

	it('the mark rule gives its marker that effect', () => {
		const mark = (item.system.rules as Json[]).find((rule) => rule.id === 'hunters-mark-toggle');
		expect(mark).toEqual(
			expect.objectContaining({
				type: 'markTarget',
				statusCondition: 'marked',
				effectId: effect._id,
			}),
		);
	});
});
