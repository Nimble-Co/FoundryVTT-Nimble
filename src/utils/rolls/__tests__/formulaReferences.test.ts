import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	checkFormulaReferences,
	findMissingReferences,
	poolOwner,
	ruleOwner,
} from '../formulaReferences.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function warnings(): string[] {
	return vi.mocked(ui.notifications.warn).mock.calls.map((call) => String(call[0]));
}

describe('formula references', () => {
	beforeEach(() => {
		vi.mocked(ui.notifications.warn).mockClear();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('finds the references the roll data has no value for, with or without braces', () => {
		const rollData = { level: 3, abilities: { strength: { mod: 2 } }, zero: 0 };

		expect(
			findMissingReferences(
				'@level + @{abilities.strength.mod} + @zero + @leve + @{abilites.x}',
				rollData,
			),
		).toEqual(['@leve', '@{abilites.x}']);
	});

	it('names the item and the actor for a formula of the item itself', async () => {
		const actor = { name: 'Hero', getRollData: () => ({ level: 1 }) };
		checkFormulaReferences('1d6 + @lvl', actor, { item: { name: 'Club', isOwner: true } });
		await flush();

		expect(warnings()).toEqual([
			'Club: a formula uses @lvl, which Hero does not have. Nimble counts it as 0.',
		]);
	});

	it('names only the actor, and tells its owner, when no item is known', async () => {
		const actor = { name: 'Hero', isOwner: true, getRollData: () => ({}) };
		checkFormulaReferences('@nope', actor, {});
		await flush();

		expect(warnings()).toEqual([
			'A formula uses @nope, which Hero does not have. Nimble counts it as 0.',
		]);
	});

	it('reads the values the caller adds for this formula only', async () => {
		const actor = { name: 'Hero', isOwner: true, getRollData: () => ({}) };
		checkFormulaReferences('@spent * 2', actor, {}, { extraRollData: { spent: 1 } });
		await flush();

		expect(warnings()).toEqual([]);
	});

	it('gives a rule owner the rule label, else its type, and a pool owner the granting item', () => {
		const item = { name: 'Rage', isOwner: true };
		expect(ruleOwner({ parentDocument: item, label: 'Fury', type: 'dicePool' })).toEqual({
			item,
			rule: 'Fury',
		});
		expect(ruleOwner({ parentDocument: item, label: '', type: 'dicePool' })).toEqual({
			item,
			rule: 'dicePool',
		});

		const actor = { items: { get: (id: string) => (id === 'rage' ? item : undefined) } };
		expect(poolOwner(actor, { sourceItemId: 'rage', label: 'Fury Dice' })).toEqual({
			item,
			rule: 'Fury Dice',
		});
	});

	it('names only the actor when the pool item is gone', async () => {
		const actor = {
			name: 'Hero',
			isOwner: true,
			getRollData: () => ({}),
			items: { get: () => undefined },
		};
		checkFormulaReferences('@gone', actor, poolOwner(actor, { sourceItemId: 'x', label: 'Fury' }));
		await flush();

		expect(warnings()).toEqual([
			'A formula uses @gone, which Hero does not have. Nimble counts it as 0.',
		]);
	});

	it('queues nothing for a reference it already warned about', async () => {
		const actor = { name: 'Hero', isOwner: true, getRollData: () => ({}) };
		checkFormulaReferences('@twice', actor, {});
		await flush();
		const queue = vi.spyOn(globalThis, 'queueMicrotask');
		checkFormulaReferences('@twice', actor, {});

		expect(queue).not.toHaveBeenCalled();
	});
});
