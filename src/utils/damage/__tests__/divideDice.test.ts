import { describe, expect, it } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { divideDice as divideEffects } from '../divideDice.js';
import { evenDiceShares } from '../evenDiceShares.js';
import { firstDiceOf, withDiceCountsWorkedOut } from '../firstDiceOf.js';

interface Node {
	id: string;
	type: string;
	formula?: string;
	damageType?: string;
	forTarget?: string;
	sharesAttackRoll?: boolean;
	dividesWithDice?: boolean;
	canCrit?: boolean;
	canMiss?: boolean;
	parentNode: string | null;
	parentContext: string | null;
	on?: Record<string, Node[]>;
}

const fullOn = (parent: string): Node => ({
	id: `${parent}Full`,
	type: 'damageOutcome',
	parentNode: parent,
	parentContext: 'hit',
});

function scythe(): Node[] {
	return [
		{
			id: 'slash',
			type: 'damage',
			damageType: 'slashing',
			formula: '3d12',
			canCrit: true,
			canMiss: true,
			parentNode: null,
			parentContext: null,
			on: { hit: [fullOn('slash')] },
		},
		{
			id: 'necrotic',
			type: 'damage',
			damageType: 'necrotic',
			formula: '3 * @dexterity',
			dividesWithDice: true,
			parentNode: null,
			parentContext: null,
			on: { hit: [fullOn('necrotic')] },
		},
		{
			id: 'fire',
			type: 'damage',
			damageType: 'fire',
			formula: '1d4',
			parentNode: null,
			parentContext: null,
			on: { hit: [fullOn('fire')] },
		},
	];
}

function divideDice(nodes: Node[], shares: typeof SHARES, rollFormula?: string) {
	const result = divideEffects(nodes as unknown as EffectNode[], shares, rollFormula);
	return { ...result, effects: result.effects as unknown as Node[] };
}

const SHARES = [
	{ targetUuid: 'Token.goblin', dice: 2 },
	{ targetUuid: 'Token.kobold', dice: 1 },
];

describe('firstDiceOf', () => {
	it('reads the first dice of a formula', () => {
		expect(firstDiceOf('3d12 + 2', {})).toMatchObject({ count: 3, faces: 12 });
		expect(firstDiceOf('d6', {})).toMatchObject({ count: 1, faces: 6 });
		expect(firstDiceOf('4 + 1d8', {})).toMatchObject({ count: 1, faces: 8 });
	});

	it('works out a dice count in parentheses', () => {
		const roll = Roll as unknown as Record<string, unknown>;
		const saved = { replace: roll.replaceFormulaData, safeEval: roll.safeEval };
		roll.replaceFormulaData = (formula: string, data: Record<string, number>) =>
			formula.replace(/@(\w+)/g, (_match, key: string) => String(data[key] ?? 0));
		roll.safeEval = (expression: string) =>
			Function('floor', `"use strict"; return (${expression});`)(Math.floor);
		try {
			expect(firstDiceOf('(2 + floor(@level / 5))d12', { level: 11 })).toMatchObject({
				count: 4,
				faces: 12,
			});
		} finally {
			roll.replaceFormulaData = saved.replace;
			roll.safeEval = saved.safeEval;
		}
	});

	it('is null for a formula with no dice', () => {
		expect(firstDiceOf('3 + @dexterity', {})).toBeNull();
	});
});

describe('evenDiceShares', () => {
	it('spreads the dice over the targets in order, the first ones getting what is left over', () => {
		expect(evenDiceShares(5, ['a', 'b'])).toEqual([
			{ targetUuid: 'a', dice: 3 },
			{ targetUuid: 'b', dice: 2 },
		]);
		expect(evenDiceShares(2, ['a', 'b', 'c'])).toEqual([
			{ targetUuid: 'a', dice: 1 },
			{ targetUuid: 'b', dice: 1 },
			{ targetUuid: 'c', dice: 0 },
		]);
	});
});

describe('divideDice', () => {
	it('gives the first target its dice of the attack roll, and the flat damage', () => {
		const { effects, rollFormula } = divideDice(scythe(), SHARES, '3d12 + 2');

		expect(rollFormula).toBe('2d12 + 2');
		expect(effects[0]).toMatchObject({ formula: '2d12', forTarget: 'Token.goblin' });
		const fire = effects.find((node) => node.id === 'fire');
		expect(fire).toMatchObject({ formula: '1d4', forTarget: 'Token.goblin' });
	});

	it('gives each other target its dice of the attack as its own damage', () => {
		const { effects } = divideDice(scythe(), SHARES, '3d12');

		const kobold = effects.filter((node) => node.forTarget === 'Token.kobold');
		expect(kobold.map((node) => [node.damageType, node.formula])).toEqual([
			['slashing', '1d12'],
			['necrotic', 'floor((3 * @dexterity) * 1 / 3)'],
		]);
		expect(kobold[0]).toMatchObject({ sharesAttackRoll: true, canCrit: false, canMiss: false });
	});

	it('divides the damage for each die the same way', () => {
		const { effects } = divideDice(scythe(), SHARES, '3d12');

		const necrotic = effects.find((node) => node.id === 'necrotic');
		expect(necrotic).toMatchObject({
			formula: 'floor((3 * @dexterity) * 2 / 3)',
			forTarget: 'Token.goblin',
		});
	});

	it('keeps every node id unique and every child pointing at its parent', () => {
		const { effects } = divideDice(scythe(), SHARES, '3d12');

		const nodes = effects.flatMap((node) => [node, ...Object.values(node.on ?? {}).flat()]);
		const ids = nodes.map((node) => node.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const node of effects as Node[]) {
			for (const child of Object.values(node.on ?? {}).flat()) {
				expect(child.parentNode).toBe(node.id);
			}
		}
	});

	it('leaves out a target with no dice', () => {
		const { effects } = divideDice(
			scythe(),
			[...SHARES, { targetUuid: 'Token.orc', dice: 0 }],
			'3d12',
		);

		expect(effects.some((node) => node.forTarget === 'Token.orc')).toBe(false);
	});
});

describe('withDiceCountsWorkedOut', () => {
	it('writes a count in parentheses as its number', () => {
		expect(withDiceCountsWorkedOut('(2 + floor(@level / 5))d12 + 3', { level: 10 })).toBe(
			'4d12 + 3',
		);
	});
});
