import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SheetTabs from '../SheetTabs.svelte';

const tabs = [
	{ id: 'core', label: 'Core', icon: 'fa-solid fa-home' },
	{ id: 'bio', label: 'Bio', icon: 'fa-solid fa-file-lines' },
];

describe('SheetTabs', () => {
	it('lets go of the focus after a click, so Escape closes the sheet', async () => {
		const onchange = vi.fn();
		render(SheetTabs, { tabs, value: 'core', onchange });
		const bio = screen.getByRole('tab', { name: /Bio/ });
		bio.focus();

		await fireEvent.click(bio, { detail: 1 });

		expect(onchange).toHaveBeenCalledWith('bio');
		expect(document.activeElement).not.toBe(bio);
	});

	it('keeps the focus on a tab that the keyboard picks', async () => {
		const onchange = vi.fn();
		render(SheetTabs, { tabs, value: 'core', onchange });
		const bio = screen.getByRole('tab', { name: /Bio/ });
		bio.focus();

		await fireEvent.click(bio, { detail: 0 });

		expect(onchange).toHaveBeenCalledWith('bio');
		expect(document.activeElement).toBe(bio);
	});
});
