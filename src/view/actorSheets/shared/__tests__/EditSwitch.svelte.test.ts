import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EditSwitch from '../EditSwitch.svelte';

const props = { label: 'Edit', startHint: 'Start editing', stopHint: 'Stop editing' };

describe('EditSwitch', () => {
	it('is a menu row with its label that is pressed in edit mode', async () => {
		const onclick = vi.fn();
		const { getByRole } = render(EditSwitch, { ...props, menu: true, editing: true, onclick });
		const button = getByRole('button', { name: 'Edit' });

		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(button.getAttribute('data-tooltip')).toBe('Stop editing');
		await fireEvent.click(button);
		expect(onclick).toHaveBeenCalledOnce();
	});
});
