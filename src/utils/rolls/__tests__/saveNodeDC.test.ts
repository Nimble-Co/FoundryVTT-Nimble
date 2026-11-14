import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { addToSaveDC, fixSaveDCs, resolveSaveNodeDC } from '../saveNodeDC.ts';

// The shared Roll mock has no formula helpers. As in Foundry, a missing term stays in the formula.
const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const original = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula, data) =>
		formula.replace(/@(\w+)/g, (match, term: string) => String(data[term] ?? match));
	// Foundry's safeEval has the Math functions, such as max.
	RollGlobal.safeEval = (expression) => {
		if (!/^(?:[\d\s+\-*/().,]|max|min)+$/.test(expression))
			throw new Error(`unsafe: ${expression}`);
		return Function(
			'max',
			'min',
			`"use strict"; return (${expression});`,
		)(Math.max, Math.min) as number;
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

describe('fixSaveDCs', () => {
	const save = (id: string, saveDC?: number | string, on?: Record<string, unknown>) => ({
		id,
		type: 'savingThrow',
		...(saveDC === undefined ? {} : { saveDC }),
		...(on ? { on } : {}),
	});
	const dcs = (effects: Array<Record<string, any>>) => effects.map((node) => node.saveDC);

	it('writes the number of each save DC the user can work out', () => {
		const effects = [save('a', '12+@key'), save('b'), save('c', 15)];

		fixSaveDCs(effects, hero(3));

		expect(dcs(effects)).toEqual([15, 13, 15]);
	});

	it('keeps a blank monster DC blank, and a formula it cannot work out', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const effects = [save('a'), save('b', '10+@key')];

		fixSaveDCs(effects, monster);

		expect(dcs(effects)).toEqual([undefined, '10+@key']);
		warn.mockRestore();
	});

	it('fixes a save under another step', () => {
		const inner = save('inner', '8+@level');
		const deeper = save('deeper', '9');
		const effects = [
			{ id: 'd', type: 'damage', on: { hit: [inner] } },
			save('outer', '10', { failedSaveBy: { 5: [deeper] } }),
		];

		fixSaveDCs(effects, monster);

		expect(inner.saveDC).toBe(12);
		expect(deeper.saveDC).toBe(9);
	});

	it('reads the damage the user took in max(10, @damageTaken)', () => {
		const poppy = (damageTaken: number) => ({
			type: 'npc',
			getRollData: () => ({ damageTaken }),
		});
		const dcAfter = (damageTaken: number) => {
			const effects = [save('stink', 'max(10, @damageTaken)')];
			fixSaveDCs(effects, poppy(damageTaken));
			return effects[0]?.saveDC;
		};

		expect(dcAfter(0)).toBe(10);
		expect(dcAfter(6)).toBe(10);
		expect(dcAfter(14)).toBe(14);
	});
});
