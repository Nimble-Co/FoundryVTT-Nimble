import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
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
		const selectionCount = 2;

		let selectedFeatures: NimbleFeatureItem[] = [];
		let rerenderComponent:
			| ((props: {
					groupName: string;
					features: NimbleFeatureItem[];
					selectionCount: number;
					selectedFeatures: NimbleFeatureItem[];
					onSelect: (feature: NimbleFeatureItem) => void;
			  }) => Promise<void>)
			| null = null;

		const onSelect = vi.fn((feature: NimbleFeatureItem) => {
			const alreadySelected = selectedFeatures.some(
				(selectedFeature) => selectedFeature.uuid === feature.uuid,
			);

			if (alreadySelected) {
				selectedFeatures = selectedFeatures.filter(
					(selectedFeature) => selectedFeature.uuid !== feature.uuid,
				);
			} else if (selectedFeatures.length < selectionCount) {
				selectedFeatures = [...selectedFeatures, feature];
			}

			void rerenderComponent?.({
				groupName: 'commander-orders',
				features,
				selectionCount,
				selectedFeatures,
				onSelect,
			});
		});

		const { rerender } = render(FeatureGroupSelection, {
			props: {
				groupName: 'commander-orders',
				features,
				selectionCount,
				selectedFeatures,
				onSelect,
			},
		});
		rerenderComponent = rerender;

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
		const selectionCount = 2;
		const onSelect = vi.fn();

		render(FeatureGroupSelection, {
			props: {
				groupName: 'ranger-styles',
				features,
				selectionCount,
				selectedFeatures: [],
				onSelect,
			},
		});

		expect(screen.getByText('Style One')).toBeInTheDocument();
		expect(screen.getByText('Style Two')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Select/ })).not.toBeInTheDocument();
	});
});
