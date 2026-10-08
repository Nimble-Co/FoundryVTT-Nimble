import { describe, expect, it, vi } from 'vitest';

import type { ClassSheetProps } from '#types/components/ClassSheet.d.ts';
import { createClassSheetState } from './ClassSheet.state.svelte.js';

function createState() {
	const update = vi.fn().mockResolvedValue(undefined);
	const props = { item: { update }, sheet: {} } as unknown as ClassSheetProps;
	return { state: createClassSheetState(() => props), update };
}

describe('class sheet spellcasting controls', () => {
	it('offers the declared overdraft consequences, including the absence of one', () => {
		const { state } = createState();

		expect(state.overdraftConsequenceOptions.map((option) => option.value)).toEqual([
			'',
			'halfMaxHpDamage',
		]);
	});

	it('writes the cast-at-highest-tier flag', async () => {
		const { state, update } = createState();

		await state.toggleCastAtHighestTier(true);

		expect(update).toHaveBeenCalledWith({ 'system.spellcasting.castAtHighestTier': true });
	});

	it('writes the pool the class spends', async () => {
		const { state, update } = createState();

		await state.updateSpellCostPoolIdentifier('pilfered-power');

		expect(update).toHaveBeenCalledWith({
			'system.spellcasting.cost.poolIdentifier': 'pilfered-power',
		});
	});

	it.each([
		['11', 11],
		[' 11 ', 11],
		['0', 1],
		['-4', 1],
	])('stores %s as the level bound %s', async (input, expected) => {
		const { state, update } = createState();

		await state.updateOverdraftMaxLevel(input);

		expect(update).toHaveBeenCalledWith({
			'system.spellcasting.cost.overdraftMaxLevel': expected,
		});
	});

	it.each(['', '   ', 'twelve'])('clears the level bound for %s', async (input) => {
		const { state, update } = createState();

		await state.updateOverdraftMaxLevel(input);

		expect(update).toHaveBeenCalledWith({
			'system.spellcasting.cost.overdraftMaxLevel': null,
		});
	});
});
