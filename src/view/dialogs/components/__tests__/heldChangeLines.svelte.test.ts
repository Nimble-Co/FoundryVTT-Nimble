import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import HeldChangeLines from '../HeldChangeLines.svelte';

const lines = [
	{ key: 'T.e0.r0', text: 'Create an Opening: +1 to Primary Die', source: 'From Mira.' },
	{ key: 'A.e1.r1', text: 'True Strike: +1 advantage', source: 'From Tessa.' },
];

describe('HeldChangeLines', () => {
	it('shows read-only lines with no tick box', () => {
		const { container } = render(HeldChangeLines, { lines });

		expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
		expect(container.textContent).toContain('Create an Opening: +1 to Primary Die');
	});

	it('shows each change as a tick box that starts unticked when the player chooses', async () => {
		const { getByLabelText } = render(HeldChangeLines, { lines, choosing: true, chosen: [] });

		const opening = getByLabelText(/Create an Opening/) as HTMLInputElement;
		const strike = getByLabelText(/True Strike/) as HTMLInputElement;
		expect(opening.checked).toBe(false);
		expect(strike.checked).toBe(false);

		await fireEvent.click(opening);

		expect(opening.checked).toBe(true);
		expect(strike.checked).toBe(false);
	});
});
