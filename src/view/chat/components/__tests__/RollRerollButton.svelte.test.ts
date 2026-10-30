import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import RollRerollButton from './RollRerollButton.testHarness.svelte';

const entry = {
	id: 'luck',
	label: 'Luck',
	cost: '2 left',
	text: 'Reroll with Luck. 2 left.',
};

describe('RollRerollButton', () => {
	it('opens the menu for one entry, and uses it only on a pick', async () => {
		const onChoose = vi.fn();
		render(RollRerollButton, {
			sections: [{ id: 'reroll', heading: 'Reroll', items: [entry] }],
			onChoose,
		});

		await fireEvent.click(screen.getByRole('button', { name: entry.text }));

		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByRole('menu')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('menuitem'));

		expect(onChoose).toHaveBeenCalledWith('luck');
	});
});
