import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The shared Roll mock has no formula helpers; give it the two this helper uses.
const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const original = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

function lookup(data: Record<string, unknown>, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>((cursor, key) => (cursor as Record<string, unknown>)?.[key], data);
}

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula, data) =>
		formula.replace(/@([\w.]+)/g, (_match, path: string) => String(lookup(data, path) ?? 0));
	RollGlobal.safeEval = (expression) => {
		if (!/^[\d\s+\-*/().]+$/.test(expression)) throw new Error(`unsafe: ${expression}`);
		return Function(`"use strict"; return (${expression});`)() as number;
	};
});

afterAll(() => {
	RollGlobal.replaceFormulaData = original.replace;
	RollGlobal.safeEval = original.safeEval;
});

import { resolveMoveDistance } from './resolveMoveDistance.js';

function makeActor(size = 'medium', walk = 6, str = 3) {
	return {
		getRollData: () => ({ abilities: { strength: { mod: str } } }),
		system: { attributes: { movement: { walk }, sizeCategory: size } },
	};
}

describe('resolveMoveDistance', () => {
	it('resolves @speed to the recipient walk speed', () => {
		expect(resolveMoveDistance({ distance: '@speed', distanceBySize: {} }, makeActor())).toBe(6);
	});

	it('floors arithmetic on the formula', () => {
		expect(resolveMoveDistance({ distance: '@speed / 4', distanceBySize: {} }, makeActor())).toBe(
			1,
		);
	});

	it('reads ability modifiers from the recipient roll data', () => {
		expect(
			resolveMoveDistance({ distance: '@abilities.strength.mod', distanceBySize: {} }, makeActor()),
		).toBe(3);
	});

	it('prefers the size override for the recipient size', () => {
		const node = {
			distance: '@abilities.strength.mod',
			distanceBySize: { small: '@abilities.strength.mod * 2' },
		};
		expect(resolveMoveDistance(node, makeActor('small'))).toBe(6);
		expect(resolveMoveDistance(node, makeActor('large'))).toBe(3);
	});

	it('never offers an unreadable distance', () => {
		expect(resolveMoveDistance({ distance: 'nonsense', distanceBySize: {} }, makeActor())).toBe(0);
		expect(resolveMoveDistance({ distance: '', distanceBySize: {} }, makeActor())).toBe(0);
	});
});
