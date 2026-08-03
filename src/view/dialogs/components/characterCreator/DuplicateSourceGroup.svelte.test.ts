import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';
// @ts-expect-error - Svelte component default export is provided by the Svelte compiler
import DuplicateSourceGroup from './DuplicateSourceGroup.svelte';

const WORLD = 'Item.wild-shape-world';
const PACK = 'Compendium.nimble.nimble-class-features.Item.wild-shape-comp';

function createFeature(
	uuid: string,
	{ description = 'Transform for 1 hour.', folder }: { description?: string; folder?: string } = {},
): NimbleFeatureItem {
	return {
		uuid,
		name: 'Wild Shape',
		img: '',
		sourceId: undefined,
		folder: folder ? { name: folder } : null,
		system: {
			description,
			activation: {},
			rules: [],
			levelUpOptions: [],
			selectionCountByLevel: {},
			macro: '',
		},
	} as unknown as NimbleFeatureItem;
}

function renderGroup(overrides: Partial<SelectionGroup> = {}, selected: NimbleFeatureItem[] = []) {
	const group: SelectionGroup = {
		features: [createFeature(WORLD, { folder: 'Homebrew' }), createFeature(PACK)],
		selectionCount: 1,
		selectionMax: 2,
		showSourceLabel: true,
		displayName: 'Wild Shape',
		recommendedUuid: WORLD,
		...overrides,
	};

	const onSetSelection = vi.fn();
	render(DuplicateSourceGroup, {
		props: {
			groupName: `duplicate-source:${WORLD}`,
			group,
			selectedFeatures: selected,
			onSetSelection,
		},
	});

	return { onSetSelection, group };
}

describe('DuplicateSourceGroup', () => {
	// The shared foundry mock has no compendium registry; the picker asks it for pack labels.
	const gameGlobal = globalThis as unknown as { game: { packs?: unknown } };
	let originalPacks: unknown;

	beforeEach(() => {
		originalPacks = gameGlobal.game.packs;
		gameGlobal.game.packs = { get: () => ({ metadata: { label: 'Nimble Core' } }) };
	});

	afterEach(() => {
		gameGlobal.game.packs = originalPacks;
	});

	it('identifies two same-named copies by their folder rather than their name', () => {
		renderGroup({
			features: [
				createFeature('Item.wild-shape-a', { folder: 'Homebrew' }),
				createFeature('Item.wild-shape-b', { folder: 'Imported' }),
			],
		});

		// Both are named "Wild Shape" and both carry a World badge, so the folder is the only
		// thing distinguishing them — this is the case that broke every earlier design.
		expect(screen.getByText('Homebrew')).toBeInTheDocument();
		expect(screen.getByText('Imported')).toBeInTheDocument();
	});

	it('marks the recommended copy', () => {
		renderGroup();

		expect(screen.getByText('Recommended')).toBeInTheDocument();
	});

	it('uses the shared SelectionIndicator rather than a look-alike', () => {
		renderGroup();

		// A hand-rolled copy of this control missed SelectionIndicator's max-width/min-height/
		// max-height, and Foundry's core button styles stretched it into an oval. Assert the
		// shared component's own class so a re-implementation fails here instead of on screen.
		for (const radio of screen.getAllByRole('radio')) {
			expect(radio).toHaveClass('select-button');
		}
	});

	it('replaces the selection rather than adding to it', async () => {
		const alreadyPicked = createFeature(WORLD, { folder: 'Homebrew' });
		const { onSetSelection } = renderGroup({}, [alreadyPicked]);

		// Choosing the second copy means "this one instead", not "this one as well".
		await fireEvent.click(screen.getAllByRole('radio')[1]);

		expect(onSetSelection).toHaveBeenCalledTimes(1);
		expect(onSetSelection.mock.calls[0][0].map((f: NimbleFeatureItem) => f.uuid)).toEqual([PACK]);
	});

	it('offers every copy at once through Keep all', async () => {
		const { onSetSelection } = renderGroup();

		await fireEvent.click(screen.getByRole('button', { name: 'Keep all 2' }));

		expect(onSetSelection.mock.calls[0][0]).toHaveLength(2);
	});

	it('turns into Keep recommended once everything is selected', () => {
		const group = {
			features: [createFeature(WORLD, { folder: 'Homebrew' }), createFeature(PACK)],
		};
		renderGroup(group, group.features);

		expect(screen.queryByRole('button', { name: /Keep all/ })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Keep recommended' })).toBeInTheDocument();
	});

	it('steps back to just the recommended copy from Keep recommended', async () => {
		const group = {
			features: [createFeature(WORLD, { folder: 'Homebrew' }), createFeature(PACK)],
		};
		const { onSetSelection } = renderGroup(group, group.features);

		await fireEvent.click(screen.getByRole('button', { name: 'Keep recommended' }));

		expect(onSetSelection.mock.calls[0][0].map((f: NimbleFeatureItem) => f.uuid)).toEqual([WORLD]);
	});

	it('expands a row without changing the selection', async () => {
		const { onSetSelection } = renderGroup();

		const rows = screen.getAllByRole('button', { expanded: false });
		await fireEvent.click(rows[0]);

		expect(rows[0].getAttribute('aria-expanded')).toBe('true');
		expect(onSetSelection).not.toHaveBeenCalled();
	});

	it('says what differs instead of making the player read both', () => {
		renderGroup({
			features: [
				createFeature(WORLD, { folder: 'Homebrew', description: 'Transform for 10 minutes.' }),
				createFeature(PACK, { description: 'Transform for 1 hour.' }),
			],
		});

		expect(screen.getByText(/differs:/)).toBeInTheDocument();
	});

	it('flags a copy that is byte-identical, so it need not be opened', () => {
		renderGroup({
			features: [
				createFeature(WORLD, { folder: 'Homebrew', description: 'Transform for 1 hour.' }),
				createFeature(PACK, { description: 'Transform for 1 hour.' }),
			],
		});

		expect(screen.getByText(/identical to/)).toBeInTheDocument();
	});

	describe('when a copy is already on the sheet', () => {
		const ownedOverrides: Partial<SelectionGroup> = {
			selectionCount: 0,
			selectionMax: 1,
			ownedUuids: new Set([WORLD]),
			recommendedUuid: PACK,
		};

		it('shows the owned copy but gives it no radio', () => {
			renderGroup(ownedOverrides);

			expect(screen.getByText('Already added')).toBeInTheDocument();
			// Two rows on screen, but only the unowned one can be chosen.
			expect(screen.getAllByRole('radio')).toHaveLength(1);
		});

		it('states that taking nothing keeps what you already have', () => {
			renderGroup(ownedOverrides);

			expect(screen.getByText('Keeps only the copy you already have.')).toBeInTheDocument();
		});

		it('hides Keep all when there is only one copy left to take', () => {
			renderGroup(ownedOverrides);

			expect(screen.queryByRole('button', { name: /Keep all/ })).not.toBeInTheDocument();
		});
	});
});
