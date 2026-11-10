import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Row from '../Row.svelte';

describe('Row', () => {
	it('puts the summary icon before the summary', () => {
		const { container } = render(Row, {
			name: 'Blinded',
			summary: 'Until the end of your next turn - Snowblind',
			summaryIcon: 'fa-solid fa-hourglass-half',
		});

		const line = container.querySelector('.sm.si');
		expect(line?.querySelector('i.fa-hourglass-half')).not.toBeNull();
		expect(line?.textContent).toContain('Until the end of your next turn - Snowblind');
	});

	it('has an end button of its own, outside the main button', async () => {
		const onuse = vi.fn();
		const onclick = vi.fn();
		render(Row, {
			name: 'Grappled',
			onuse,
			endButton: { label: 'Escape DC 13', ariaLabel: 'Escape Grappled', onclick },
		});

		const escapeButton = screen.getByRole('button', { name: 'Escape Grappled' });
		expect(escapeButton.closest('button.main')).toBeNull();
		await fireEvent.click(escapeButton);
		expect(onclick).toHaveBeenCalledOnce();
		expect(onuse).not.toHaveBeenCalled();
	});
});
