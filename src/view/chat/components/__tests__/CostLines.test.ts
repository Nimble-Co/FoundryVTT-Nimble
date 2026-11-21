import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { CardResourceCost } from '#types/resourceCost.d.ts';
import CostLinesTestHarness from './CostLines.testHarness.svelte';

function card(costs: CardResourceCost[]) {
	const system = { costs };
	return { reactive: { system } };
}

describe('the cost lines of a card', () => {
	it('show one line for each cost, with its kind and its source', () => {
		render(CostLinesTestHarness, {
			props: {
				messageDocument: card([
					{ kind: 'mana', amount: 2, source: 'Stretch Time' },
					{ kind: 'tempHp', amount: 10, source: 'Shadowfrost' },
					{ kind: 'hp', amount: 14, source: "Cryomancer's Reprisal" },
					{ kind: 'wounds', amount: 3, source: 'Enveloped by the Master' },
					{ kind: 'wounds', amount: 1, source: 'Dark Bargain' },
				]),
			},
		});

		expect(screen.getAllByText(/^Cost:/).map((line) => line.textContent)).toEqual([
			'Cost: 2 mana (Stretch Time)',
			'Cost: 10 temp HP (Shadowfrost)',
			"Cost: 14 HP (Cryomancer's Reprisal)",
			'Cost: 3 Wounds (Enveloped by the Master)',
			'Cost: 1 Wound (Dark Bargain)',
		]);
	});

	it('show the roll of a rolled cost next to its source', () => {
		render(CostLinesTestHarness, {
			props: {
				messageDocument: card([
					{ kind: 'wounds', amount: 3, source: 'Enveloped by the Master', roll: '1d4' },
				]),
			},
		});

		expect(screen.getByText(/^Cost:/).textContent).toBe(
			'Cost: 3 Wounds (1d4, Enveloped by the Master)',
		);
	});

	it('show nothing on a card with no cost', () => {
		const { container } = render(CostLinesTestHarness, { props: { messageDocument: card([]) } });

		expect(container.querySelector('section')).toBeNull();
	});
});
