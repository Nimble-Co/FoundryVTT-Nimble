import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import BrowseTabContent from './BrowseTabContent.svelte';

function monster(id: string, creator?: { username: string; displayName: string }) {
	return {
		type: 'monsters',
		id,
		attributes: {
			name: `Monster ${id}`,
			hp: 10,
			level: 1,
			size: 'medium',
			armor: 'none',
			kind: 'Beast',
		},
		...(creator ? { creator } : {}),
	};
}

function renderBrowseTab(searchResults: ReturnType<typeof monster>[]) {
	return render(BrowseTabContent, {
		props: {
			dialog: {
				searchResults,
				selectedMonsters: new Set<string>(),
				isLoading: false,
				toggleSelection: vi.fn(),
				selectAll: vi.fn(),
				deselectAll: vi.fn(),
			},
			onScroll: vi.fn(),
		},
	});
}

describe('BrowseTabContent creator credit', () => {
	it('credits the creator by display name', () => {
		renderBrowseTab([monster('m1', { username: 'sample-user', displayName: 'Sample User' })]);

		expect(screen.getByText('by Sample User')).toBeTruthy();
	});

	it('falls back to the username when the display name is blank', () => {
		renderBrowseTab([monster('m1', { username: 'other-user', displayName: '' })]);

		expect(screen.getByText('by other-user')).toBeTruthy();
	});

	it('shows no credit when the monster has no creator', () => {
		renderBrowseTab([monster('m1')]);

		expect(screen.queryByText(/^by /)).toBeNull();
	});

	it('shows no credit when the creator has no usable name', () => {
		renderBrowseTab([monster('m1', { username: '', displayName: '' })]);

		expect(screen.queryByText(/^by /)).toBeNull();
	});
});
