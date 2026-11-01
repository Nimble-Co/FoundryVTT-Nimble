import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { addToSaveDC, resolveSaveNodeDC } from '../saveNodeDC.ts';

// The shared Roll mock has no formula helpers. As in Foundry, a missing term stays in the formula.
const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const original = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula, data) =>
		formula.replace(/@(\w+)/g, (match, term: string) => String(data[term] ?? match));
	RollGlobal.safeEval = (expression) => {
		if (!/^[\d\s+\-*/().]+$/.test(expression)) throw new Error(`unsafe: ${expression}`);
		return Function(`"use strict"; return (${expression});`)() as number;
	};
});

afterAll(() => {
	RollGlobal.replaceFormulaData = original.replace;
	RollGlobal.safeEval = original.safeEval;
});

const hero = (key: number) => ({ type: 'character', getRollData: () => ({ key, level: 4 }) });
const monster = { type: 'npc', getRollData: () => ({ level: 4 }) };

describe('resolveSaveNodeDC', () => {
	it('gives a hero 10+KEY when the field is empty', () => {
		expect(resolveSaveNodeDC(undefined, hero(3))).toBe(13);
		expect(resolveSaveNodeDC('', hero(3))).toBe(13);
		expect(resolveSaveNodeDC('  ', hero(-1))).toBe(9);
	});

	it('gives a hero with no key stat no DC', () => {
		const warn = vi.spyOn(console, 'warn');

		expect(resolveSaveNodeDC('', hero(Number.NEGATIVE_INFINITY))).toBeNull();
		expect(warn).not.toHaveBeenCalled();

		warn.mockRestore();
	});

	it('gives a monster no DC when the field is empty', () => {
		expect(resolveSaveNodeDC(undefined, monster)).toBeNull();
	});

	it('reads a written DC as a number or a stored string', () => {
		expect(resolveSaveNodeDC(16, monster)).toBe(16);
		expect(resolveSaveNodeDC('16', monster)).toBe(16);
		expect(resolveSaveNodeDC('16', hero(3))).toBe(16);
	});

	it('resolves a formula against the item user', () => {
		expect(resolveSaveNodeDC('12+@key', hero(3))).toBe(15);
		expect(resolveSaveNodeDC('8+@level', monster)).toBe(12);
	});

	it('rounds a formula down', () => {
		expect(resolveSaveNodeDC('10+@level/3', monster)).toBe(11);
	});

	it('resolves a written number when the item user is gone', () => {
		expect(resolveSaveNodeDC('14', null)).toBe(14);
		expect(resolveSaveNodeDC('', null)).toBeNull();
	});

	it('gives no DC for a formula it cannot work out', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(resolveSaveNodeDC('10+@key', monster)).toBeNull();
		expect(resolveSaveNodeDC('1d6', hero(3))).toBeNull();
		expect(warn).toHaveBeenCalledTimes(2);

		warn.mockRestore();
	});
});

describe('addToSaveDC', () => {
	it('adds to a number and to a stored numeric string', () => {
		expect(addToSaveDC(12, 2)).toBe(14);
		expect(addToSaveDC('16', 1)).toBe(17);
	});

	it('adds to a formula', () => {
		expect(addToSaveDC('12+@key', 1)).toBe('12+@key+1');
	});

	it('starts an empty field from the hero DC', () => {
		expect(addToSaveDC(undefined, 1)).toBe('10+@key+1');
		expect(addToSaveDC('', 2)).toBe('10+@key+2');
	});
});
