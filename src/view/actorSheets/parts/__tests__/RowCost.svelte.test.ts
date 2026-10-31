import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RowCost from '../RowCost.svelte';

describe('RowCost', () => {
	it('tells what the uses, the mana cost and the action bars mean', () => {
		const { container } = render(RowCost, {
			uses: [{ left: 1, max: 1, per: 'round' }],
			pool: { kind: 'mana', icon: 'fa-solid fa-droplet', amount: 2 },
			actions: 2,
		});
		const tips = [...container.querySelectorAll('[data-tooltip]')].map((el) =>
			el.getAttribute('data-tooltip'),
		);

		expect(tips).toEqual(['1 of 1 left. It comes back each round.', 'Costs 2 mana', '2 actions']);
	});
});
