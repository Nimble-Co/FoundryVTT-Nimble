import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import CharacterLevelDownStateHarness from '../../../tests/harnesses/CharacterLevelDownStateHarness.svelte';

interface OptionInput {
	label?: string;
	poolIdentifier?: string;
}

/**
 * Build a minimal level-down actor whose most recent history entry reverts the given
 * pool-max bonuses, with owned items that define those pools via poolMaxBonus rules.
 */
function createActor(poolMaxBonuses: Record<string, number>, definingOptions: OptionInput[]) {
	const items = definingOptions.map((o) => ({
		type: 'feature',
		name: 'Definer',
		system: {
			levelUpOptions: [
				{
					label: o.label,
					rules: o.poolIdentifier
						? [{ type: 'poolMaxBonus', poolIdentifier: o.poolIdentifier }]
						: [],
				},
			],
		},
	}));

	return {
		system: {
			levelUpHistory: [
				{
					classIdentifier: 'berserker',
					level: 5,
					hpIncrease: 0,
					hitDieAdded: false,
					skillIncreases: {},
					abilityIncreases: {},
					grantedFeatureIds: [],
					poolMaxBonuses,
				},
			],
		},
		classes: { berserker: { system: { classLevel: 5 } } },
		items: {
			filter: (fn: (i: { type: string }) => boolean) => items.filter(fn),
			get: () => undefined,
		},
	};
}

async function readPoolBonuses(actor: unknown) {
	const { getByTestId } = render(CharacterLevelDownStateHarness, { props: { actor } });
	let parsed: Array<{ name: string; amount: number }> = [];
	await waitFor(() => {
		parsed = JSON.parse(getByTestId('pool-bonus-changes').textContent ?? '[]');
		expect(getByTestId('pool-bonus-changes').textContent).not.toBeNull();
	});
	return parsed;
}

describe('createLevelDownState poolBonusChanges', () => {
	it("uses the defining option's label with the leading '+N ' stripped", async () => {
		const result = await readPoolBonuses(
			createActor({ 'combat-dice': 1 }, [
				{ label: '+1 Max Combat Die', poolIdentifier: 'combat-dice' },
			]),
		);

		expect(result).toEqual([{ name: 'Max Combat Die', amount: 1 }]);
	});

	it('falls back to a humanized pool identifier when no defining option is found', async () => {
		const result = await readPoolBonuses(createActor({ 'combat-dice': 2 }, []));

		expect(result).toEqual([{ name: 'Combat Dice', amount: 2 }]);
	});

	it('omits pools whose reverted amount is not positive', async () => {
		const result = await readPoolBonuses(
			createActor({ 'combat-dice': 0 }, [
				{ label: '+1 Max Combat Die', poolIdentifier: 'combat-dice' },
			]),
		);

		expect(result).toEqual([]);
	});
});
