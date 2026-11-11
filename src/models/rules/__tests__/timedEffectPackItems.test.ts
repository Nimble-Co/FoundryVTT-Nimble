import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const CF = 'packs/classFeatures/core';
const RAGE = `${CF}/berserker/berserker-progression/rage.json`;
const DEEP_RAGE = `${CF}/berserker/berserker-progression/deep-rage.json`;
const ENDURING_RAGE = `${CF}/berserker/berserker-progression/enduring-rage.json`;
const TITANS_FURY = `${CF}/berserker/berserker-subclasses/path-of-the-mountainheart/titans-fury.json`;
const SCOUNDREL = `${CF}/the-cheat/the-cheat-subclasses/tools-of-the-scoundrel`;
const HEADS_I_WIN = `${SCOUNDREL}/heads-i-win-tails-you-lose.json`;
const POCKET_SAND = `${SCOUNDREL}/pocket-sand.json`;
const EXPLOIT_WEAKNESS = `${CF}/the-cheat/underhanded-abilities/exploit-weakness.json`;
const DESPAIR_MONSTERS = [
	'packs/monsters/core/cultists/cultist.json',
	'packs/monsters/core/cultists/fanatic.json',
];

const REMOVED_RULE_TYPES = ['toggleEffect', 'modifyToggle'];

const REMOVED_FIELDS: Record<string, string[]> = {
	applyCondition: ['duration'],
	markTarget: ['endsAtEncounterEnd'],
	defendOption: ['attackerCondition', 'attackerConditionEnds'],
};

const EFFECT_ID_FIELD: Record<string, string> = {
	applyCondition: 'effectId',
	markTarget: 'effectId',
	defendOption: 'attackerEffectId',
};

const readItem = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

/** Every item of the packs: the pack documents and the items of the actors. */
function packItems(): { file: string; item: Json }[] {
	const files = globSync('packs/**/*.json').filter((file) => !file.endsWith('ids.json'));
	return files.flatMap((file) => {
		const doc = readItem(file);
		const embedded = Array.isArray(doc.items) ? (doc.items as Json[]) : [];
		return [doc, ...embedded].map((item) => ({ file, item }));
	});
}

/** The rules of a document and of each effect on it. */
function rulesOfItemAndEffects(doc: Json): Json[] {
	const effects = Array.isArray(doc.effects) ? (doc.effects as Json[]) : [];
	return [doc, ...effects].flatMap((holder) =>
		Array.isArray(holder.system?.rules) ? (holder.system.rules as Json[]) : [],
	);
}

function activationNodes(doc: Json): Json[] {
	return flattenEffectsTree(doc.system?.activation?.effects ?? []) as Json[];
}

const event = (name: string, who: string | null = 'holder') =>
	expect.objectContaining({ kind: 'event', event: name, who });

function ruleOf(file: string, type: string): Json {
	const rule = (readItem(file).system.rules as Json[]).find((r) => r.type === type);
	if (!rule) throw new Error(`${file} has no ${type} rule`);
	return rule;
}

/** The effect a rule names, from the rule's own item. */
function namedEffect(file: string, type: string): Json | undefined {
	const item = readItem(file);
	const id = ruleOf(file, type)[EFFECT_ID_FIELD[type]];
	return (item.effects as Json[]).find((effect) => effect._id === id);
}

/** The last step of the root list, and the effect it applies when it is an Apply Effect step. */
function lastStepEffect(file: string): { step: Json; effect: Json | undefined } {
	const item = readItem(file);
	const step = (item.system.activation.effects as Json[]).at(-1) as Json;
	const effect = (item.effects as Json[]).find((each) => each._id === step.effectId);
	return { step, effect };
}

/** The identifier of a pack item, as the item document resolves it. */
function identifierOf(file: string): string {
	const item = readItem(file);
	return item.system.identifier || item.name.slugify({ strict: true });
}

describe('rules that name an item effect, in packs', () => {
	const items = packItems();

	it('reads the packs', () => {
		expect(items.length).toBeGreaterThan(0);
	});

	it('names an effect on its own item with transfer false', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const rule of (item.system?.rules ?? []) as Json[]) {
				const field = EFFECT_ID_FIELD[rule.type];
				const id = field ? rule[field] : '';
				if (!id) continue;
				const effect = ((item.effects ?? []) as Json[]).find((e) => e._id === id);
				if (effect?.transfer !== false) misses.push(`${file} ${rule.type} ${id}`);
			}
		}
		expect(misses).toEqual([]);
	});

	it('has no Toggle Effect or Modify Toggle rule', () => {
		const hits: string[] = [];
		for (const { file, item } of items) {
			for (const rule of rulesOfItemAndEffects(item)) {
				if (REMOVED_RULE_TYPES.includes(rule.type)) hits.push(`${file} ${rule.type}`);
			}
		}
		expect(hits).toEqual([]);
	});

	it('has each Apply Effect step name an effect on its own item with transfer false', () => {
		const misses: string[] = [];
		let steps = 0;
		for (const { file, item } of items) {
			for (const node of activationNodes(item)) {
				if (node.type !== 'applyEffect') continue;
				steps += 1;
				const effect = ((item.effects ?? []) as Json[]).find((e) => e._id === node.effectId);
				if (effect?.transfer !== false) misses.push(`${file} node ${node.id}`);
			}
		}
		expect(steps).toBeGreaterThan(0);
		expect(misses).toEqual([]);
	});

	it('has no removed end field', () => {
		const hits: string[] = [];
		for (const { file, item } of items) {
			for (const rule of rulesOfItemAndEffects(item)) {
				for (const field of REMOVED_FIELDS[rule.type] ?? []) {
					if (field in rule) hits.push(`${file} ${rule.type}.${field}`);
				}
			}
			for (const node of activationNodes(item)) {
				if (node.type === 'applyEffect' && 'duration' in node) hits.push(`${file} node ${node.id}`);
			}
		}
		expect(hits).toEqual([]);
	});
});

describe('timed effects of pack items', () => {
	it('Rage: Raging lasts until you die, drop to 0 HP, combat ends, rest, or an inactive round', () => {
		const { effect } = lastStepEffect(RAGE);
		expect(effect?.name).toBe('Raging');
		expect(effect?.img).toBe(readItem(RAGE).img);
		expect(effect?.transfer).toBe(false);
		expect(effect?.system.lastsUntil).toEqual([
			event('die'),
			event('zeroHp'),
			event('combatEnd', null),
			event('rest'),
			event('inactiveRound'),
		]);
	});

	it('Rage: rolls the Fury Dice, then applies Raging to the one who Rages', () => {
		const item = readItem(RAGE);
		const roots = item.system.activation.effects as Json[];
		expect(roots.map((node) => node.type)).toEqual(['pool', 'pool', 'applyEffect']);
		expect(roots.slice(0, 2).every((node) => node.poolIdentifier === 'fury')).toBe(true);
		expect(roots[2]).toMatchObject({
			type: 'applyEffect',
			effectId: 'S1P4R61pBW5uvg1M',
			recipient: 'self',
			parentNode: null,
		});
		expect((item.system.rules as Json[]).map((rule) => rule.type)).toEqual([
			'dicePool',
			'diceConsumer',
		]);
	});

	it('Rage: Raging tags the creature as raging and empties the Fury Dice when it ends', () => {
		const { effect } = lastStepEffect(RAGE);
		expect(effect?.system.rules).toEqual([
			expect.objectContaining({ type: 'tags', tags: ['self:raging'], disabled: false }),
			expect.objectContaining({ type: 'emptyPoolsAtEnd', pools: ['fury'], disabled: false }),
		]);
		expect(ruleOf(RAGE, 'dicePool').identifier).toBe('fury');
		expect(ruleOf(RAGE, 'diceConsumer').predicate).toEqual({ self: 'raging' });
	});

	it('Heads I Win: lasts until the end of the round, combat ends, you rest, or you die', () => {
		const { effect } = lastStepEffect(HEADS_I_WIN);
		expect(effect?.name).toBe('Heads I Win, Tails You Lose');
		expect(effect?.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'turn', boundary: 'end', span: 'currentRound', clock: null }),
			event('combatEnd', null),
			event('rest'),
			event('die'),
		]);
	});

	it('Heads I Win: gives LVL temp HP, then applies its effect, which tags the user', () => {
		const roots = readItem(HEADS_I_WIN).system.activation.effects as Json[];
		expect(roots).toEqual([
			expect.objectContaining({
				type: 'healing',
				healingType: 'tempHealing',
				formula: '@level',
				recipient: 'self',
			}),
			expect.objectContaining({
				type: 'applyEffect',
				effectId: 'ZDb20ITwPZlXAe7u',
				recipient: 'self',
				parentNode: null,
			}),
		]);
		const { effect } = lastStepEffect(HEADS_I_WIN);
		expect(effect?.system.tempHp).toBeNull();
		expect(effect?.system.rules).toEqual([
			expect.objectContaining({ type: 'tags', tags: ['self:heads-i-win'], disabled: false }),
		]);
	});

	it('Rage resolves to the identifier that the Rage rules of other items name', () => {
		expect(identifierOf(RAGE)).toBe('rage');
		expect(ruleOf(DEEP_RAGE, 'changeEffect').itemIdentifier).toBe('rage');
		expect(ruleOf(ENDURING_RAGE, 'useItemFree').itemIdentifier).toBe('rage');
		expect(ruleOf(TITANS_FURY, 'useItemFree').itemIdentifier).toBe('rage');
	});

	it('Deep Rage: Raging does not end at 0 HP', () => {
		const rule = ruleOf(DEEP_RAGE, 'changeEffect');
		expect(rule).toMatchObject({ removeMoments: ['zeroHp'], addMoments: [], predicate: {} });
		const { effect } = lastStepEffect(RAGE);
		expect(effect?.system.lastsUntil).toContainEqual(event('zeroHp'));
	});

	it('Enduring Rage: Rage for free at the start of each turn, only while Dying', () => {
		expect(ruleOf(ENDURING_RAGE, 'useItemFree')).toMatchObject({
			triggers: ['onTurnStart'],
			predicate: { $and: ['self:dying'] },
			freeOf: ['uses', 'mana'],
			label: 'Enduring Rage',
		});
		expect(ruleOf(ENDURING_RAGE, 'dyingActionLimit').value).toBe('2');
	});

	it("Titan's Fury: Rage for free after a miss or an enemy's crit", () => {
		expect(ruleOf(TITANS_FURY, 'useItemFree')).toMatchObject({
			triggers: ['onCritReceived', 'onMiss'],
			predicate: {},
			freeOf: ['uses', 'mana'],
			label: "Titan's Fury",
		});
	});

	it('gives the rules of the Rage items ids of their own', () => {
		for (const file of [RAGE, DEEP_RAGE, ENDURING_RAGE, TITANS_FURY, HEADS_I_WIN]) {
			const item = readItem(file);
			const ruleIds = rulesOfItemAndEffects(item).map((rule) => rule.id);
			expect(new Set(ruleIds).size).toBe(ruleIds.length);
			const stepIds = activationNodes(item).map((node) => node.id);
			expect(new Set(stepIds).size).toBe(stepIds.length);
		}
		for (const file of [DEEP_RAGE, TITANS_FURY, HEADS_I_WIN]) {
			for (const rule of rulesOfItemAndEffects(readItem(file))) {
				expect(String(rule.id)).toMatch(/^[A-Za-z0-9]{16}$/);
			}
		}
	});

	it('Exploit Weakness: the mark lasts for 1 minute', () => {
		const effect = namedEffect(EXPLOIT_WEAKNESS, 'markTarget');
		expect(effect?.name).toBe('Exploit Weakness');
		expect(effect?.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'time', value: 1, units: 'minutes' }),
		]);
	});

	it('Pocket Sand: the attacker is Blinded until the start of their next turn', () => {
		const effect = namedEffect(POCKET_SAND, 'defendOption');
		expect(effect?.name).toBe('Pocket Sand');
		expect(effect?.statuses).toEqual(['blinded']);
		expect(effect?.system.lastsUntil).toEqual([
			expect.objectContaining({
				kind: 'turn',
				boundary: 'start',
				clock: 'holder',
				span: 'nextTurn',
			}),
		]);
	});

	it.each(DESPAIR_MONSTERS)('%s: Despair lasts until the next attack or combat end', (file) => {
		const despair = (readItem(file).items as Json[])
			.flatMap((item) => (item.effects ?? []) as Json[])
			.filter((effect) => effect.statuses?.includes('despair'));
		expect(despair.length).toBeGreaterThan(0);
		for (const effect of despair) {
			expect(effect.system.lastsUntil).toEqual([event('attack'), event('combatEnd', null)]);
		}
	});
});
