import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';
import { DUPLICATE_SOURCE_GROUP_PREFIX } from '#utils/getClassFeatures.ts';
// @ts-expect-error - Svelte component default export is provided by the Svelte compiler
import FeatureGroupSelection from './FeatureGroupSelection.svelte';

function createFeatureItem({ uuid, name }: { uuid: string; name: string }): NimbleFeatureItem {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		system: {
			description: '',
		},
	} as NimbleFeatureItem;
}

interface GroupProps {
	groupName: string;
	group: SelectionGroup;
	selectedFeatures: NimbleFeatureItem[];
	onSelect: (feature: NimbleFeatureItem) => void;
}

describe('FeatureGroupSelection', () => {
	it('hides unselected features at the selection limit and restores them after deselection', async () => {
		const features = [
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-features.Item.commander-order-one',
				name: 'Order One',
			}),
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-features.Item.commander-order-two',
				name: 'Order Two',
			}),
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-features.Item.commander-order-three',
				name: 'Order Three',
			}),
		];
		const group: SelectionGroup = { features, selectionCount: 2 };

		let selectedFeatures: NimbleFeatureItem[] = [];
		let rerenderComponent: ((props: GroupProps) => Promise<void>) | null = null;

		const onSelect = vi.fn((feature: NimbleFeatureItem) => {
			const alreadySelected = selectedFeatures.some(
				(selectedFeature) => selectedFeature.uuid === feature.uuid,
			);

			if (alreadySelected) {
				selectedFeatures = selectedFeatures.filter(
					(selectedFeature) => selectedFeature.uuid !== feature.uuid,
				);
			} else if (selectedFeatures.length < group.selectionCount) {
				selectedFeatures = [...selectedFeatures, feature];
			}

			void rerenderComponent?.({
				groupName: 'commander-orders',
				group,
				selectedFeatures,
				onSelect,
			});
		});

		const { rerender } = render(FeatureGroupSelection, {
			props: {
				groupName: 'commander-orders',
				group,
				selectedFeatures,
				onSelect,
			},
		});
		rerenderComponent = rerender;

		// A multi-pick exact group asks for a count and reports progress against it.
		expect(screen.getByText('(Choose 2)')).toBeInTheDocument();
		expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Select Order One' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Order Two' }));

		await waitFor(() => {
			expect(screen.queryByText('Order Three')).not.toBeInTheDocument();
		});
		expect(screen.getByRole('button', { name: 'Deselect Order One' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Deselect Order Two' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Deselect Order One' }));

		await waitFor(() => {
			expect(screen.getByText('Order Three')).toBeInTheDocument();
		});
		expect(screen.getByRole('button', { name: 'Select Order Three' })).toBeEnabled();
	});

	it('renders all features as non-interactive when feature count equals selectionCount (fixed group)', async () => {
		const features = [
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-features.Item.style-one',
				name: 'Style One',
			}),
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-features.Item.style-two',
				name: 'Style Two',
			}),
		];
		const onSelect = vi.fn();

		render(FeatureGroupSelection, {
			props: {
				groupName: 'ranger-styles',
				group: { features, selectionCount: 2 },
				selectedFeatures: [],
				onSelect,
			},
		});

		expect(screen.getByText('Style One')).toBeInTheDocument();
		expect(screen.getByText('Style Two')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Select/ })).not.toBeInTheDocument();
	});

	it('keeps every candidate selectable in a duplicate-source range group and names it after the feature', async () => {
		const features = [
			createFeatureItem({ uuid: 'Item.wild-shape-world', name: 'Wild Shape' }),
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
				name: 'Wild Shape',
			}),
		];
		const group: SelectionGroup = {
			features,
			selectionCount: 1,
			selectionMax: 2,
			showSourceLabel: true,
			displayName: 'Wild Shape',
		};

		render(FeatureGroupSelection, {
			props: {
				groupName: `${DUPLICATE_SOURCE_GROUP_PREFIX}Item.wild-shape-world`,
				group,
				// One copy already picked: the minimum is met, but the range allows keeping both.
				selectedFeatures: [features[0]],
				onSelect: vi.fn(),
			},
		});

		// Scoped to the group heading — the cards carry the same name.
		expect(
			screen.getByText('Wild Shape', { selector: 'h4[data-heading-variant="section"]' }),
		).toBeInTheDocument();
		expect(screen.getByText('(Choose one, or keep all 2)')).toBeInTheDocument();
		// "kept", not "of 2 selected" — the upper bound is optional, not required.
		expect(screen.getByText('1 of 2 kept')).toBeInTheDocument();
		// The unselected copy stays offered rather than collapsing away at the minimum.
		expect(screen.getByRole('button', { name: 'Select Wild Shape' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Deselect Wild Shape' })).toBeInTheDocument();
		// Both candidates are badged so the player can tell the two sources apart.
		expect(screen.getByText('World')).toBeInTheDocument();
		expect(screen.getByText('Pack')).toBeInTheDocument();
	});

	it('badges candidates of a named group without turning it into a range', async () => {
		const features = [
			createFeatureItem({ uuid: 'Item.cleave-world', name: 'Cleave' }),
			createFeatureItem({
				uuid: 'Compendium.nimble.nimble-class-features.Item.cleave-comp',
				name: 'Cleave Variant',
			}),
			createFeatureItem({ uuid: 'Item.parry', name: 'Parry' }),
		];

		render(FeatureGroupSelection, {
			props: {
				groupName: 'combat-maneuvers',
				group: { features, selectionCount: 1, showSourceLabel: true },
				selectedFeatures: [],
				onSelect: vi.fn(),
			},
		});

		// Two of the three candidates are world items, one is from a pack.
		expect(screen.getAllByText('World', { selector: 'span[data-source="world"]' })).toHaveLength(2);
		expect(
			screen.getByText('Pack', { selector: 'span[data-source="compendium"]' }),
		).toBeInTheDocument();
		// Badges only — the group stays an exact "choose one".
		expect(screen.getByText('(Choose one)')).toBeInTheDocument();
		expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
	});

	it('falls back to the formatted group key when a group has no display name', async () => {
		const features = [
			createFeatureItem({ uuid: 'Item.cleave', name: 'Cleave' }),
			createFeatureItem({ uuid: 'Item.parry', name: 'Parry' }),
		];

		render(FeatureGroupSelection, {
			props: {
				groupName: 'combat-maneuvers',
				group: { features, selectionCount: 1 },
				selectedFeatures: [],
				onSelect: vi.fn(),
			},
		});

		expect(screen.getByRole('heading', { name: 'Combat Maneuvers' })).toBeInTheDocument();
	});
});
