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

// Distinct numbers on each side, so a test cannot pass by reading the wrong actor.
const source = makeActor('large', 4, 3);
const recipient = makeActor('medium', 7, -1);

describe('resolveMoveDistance', () => {
	it('resolves @speed to the recipient walk speed', () => {
		expect(resolveMoveDistance({ distance: '@speed', distanceBySize: {} }, source, recipient)).toBe(
			7,
		);
	});

	it('floors arithmetic on the formula', () => {
		expect(
			resolveMoveDistance({ distance: '@speed / 4', distanceBySize: {} }, source, recipient),
		).toBe(1);
	});

	it("reads ability modifiers from the feature user's roll data", () => {
		expect(
			resolveMoveDistance(
				{ distance: '@abilities.strength.mod', distanceBySize: {} },
				source,
				recipient,
			),
		).toBe(3);
	});

	it('prefers the size override for the recipient size', () => {
		const node = {
			distance: '@abilities.strength.mod',
			distanceBySize: { small: '@abilities.strength.mod * 2' },
		};
		expect(resolveMoveDistance(node, source, makeActor('small', 7, -1))).toBe(6);
		expect(resolveMoveDistance(node, source, makeActor('large', 7, -1))).toBe(3);
	});

	it('never offers an unreadable or negative distance', () => {
		expect(
			resolveMoveDistance({ distance: 'nonsense', distanceBySize: {} }, source, recipient),
		).toBe(0);
		expect(resolveMoveDistance({ distance: '', distanceBySize: {} }, source, recipient)).toBe(0);
		expect(
			resolveMoveDistance(
				{ distance: '@abilities.strength.mod - 5', distanceBySize: {} },
				source,
				recipient,
			),
		).toBe(0);
	});
});
