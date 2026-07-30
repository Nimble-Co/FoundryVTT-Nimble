import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	ClassFeatureResult,
	SelectionGroup,
} from '#types/components/ClassFeatureSelection.d.ts';
import ClassFeatureSelectionStateHarness from '../../../../../tests/harnesses/ClassFeatureSelectionStateHarness.svelte';
import { createClassFeatureSelectionState as createLevelUpState } from '../levelUpHelper/LevelUpClassFeatureSelection.svelte.ts';
import { createClassFeatureSelectionState as createCreatorState } from './ClassFeatureSelection.svelte.ts';

type HarnessFactory = (
	getClassFeatures: () => ClassFeatureResult,
	getSelectedFeatures: () => Map<string, NimbleFeatureItem[]>,
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem[]>) => void,
) => { handleFeatureSelect: (groupName: string, feature: NimbleFeatureItem) => void };

function createFeatureItem(uuid: string, name: string): NimbleFeatureItem {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		system: { description: '' },
	} as NimbleFeatureItem;
}

function createResult(groups: Array<[string, SelectionGroup]>): ClassFeatureResult {
	return { autoGrant: [], selectionGroups: new Map(groups), optionFeatures: [] };
}

// The two dialogs each own a copy of this selection logic, so both must honour the cap.
const VARIANTS: Array<[string, HarnessFactory]> = [
	[
		'characterCreator',
		(getClassFeatures, getSelectedFeatures, setSelectedFeatures) =>
			createCreatorState(
				() => ({ classFeatures: getClassFeatures(), selectedFeatures: getSelectedFeatures() }),
				setSelectedFeatures,
			),
	],
	[
		'levelUpHelper',
		(getClassFeatures, getSelectedFeatures, setSelectedFeatures) =>
			createLevelUpState(
				getClassFeatures,
				getSelectedFeatures,
				setSelectedFeatures,
				() => new Map(),
				() => {},
				() => new Map(),
				() => {},
			),
	],
];

describe.each(VARIANTS)('createClassFeatureSelectionState (%s)', (_name, createState) => {
	const worldCopy = createFeatureItem('Item.wild-shape-world', 'Wild Shape');
	const packCopy = createFeatureItem(
		'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
		'Wild Shape',
	);
	const thirdCopy = createFeatureItem('Item.wild-shape-third', 'Wild Shape');

	function renderHarness(
		group: SelectionGroup,
		groupName = 'duplicate-source:Item.wild-shape-world',
	) {
		const { component, getByTestId } = render(ClassFeatureSelectionStateHarness, {
			props: { classFeatures: createResult([[groupName, group]]), createState },
		});
		// The harness exports `selectFeature` so tests can drive the factory directly.
		const harness = component as unknown as {
			selectFeature: (g: string, f: NimbleFeatureItem) => void;
		};
		return {
			select: (feature: NimbleFeatureItem) => harness.selectFeature(groupName, feature),
			selections: () => getByTestId('selections').textContent,
			groupName,
		};
	}

	it('lets a range group keep more copies than it requires, up to selectionMax', async () => {
		const { select, selections, groupName } = renderHarness({
			features: [worldCopy, packCopy],
			selectionCount: 1,
			selectionMax: 2,
		});

		select(worldCopy);
		await waitFor(() => {
			expect(selections()).toBe(`${groupName}=Item.wild-shape-world`);
		});

		// The minimum is already met — the second copy must still be addable.
		select(packCopy);
		await waitFor(() => {
			expect(selections()).toBe(
				`${groupName}=Item.wild-shape-world,Compendium.nimble.nimble-class-features.Item.wild-shape-comp`,
			);
		});
	});

	it('refuses a selection beyond selectionMax', async () => {
		const { select, selections, groupName } = renderHarness({
			features: [worldCopy, packCopy, thirdCopy],
			selectionCount: 1,
			selectionMax: 2,
		});

		select(worldCopy);
		select(packCopy);
		await waitFor(() => {
			expect(selections()).toContain('wild-shape-comp');
		});

		select(thirdCopy);
		await waitFor(() => {
			expect(selections()).not.toContain('Item.wild-shape-third');
		});
		expect(selections()).toBe(
			`${groupName}=Item.wild-shape-world,Compendium.nimble.nimble-class-features.Item.wild-shape-comp`,
		);
	});

	it('still caps an exact group at its required count when no maximum is set', async () => {
		const { select, selections, groupName } = renderHarness(
			{ features: [worldCopy, packCopy, thirdCopy], selectionCount: 1 },
			'combat-maneuvers',
		);

		select(worldCopy);
		await waitFor(() => {
			expect(selections()).toBe(`${groupName}=Item.wild-shape-world`);
		});

		select(packCopy);
		await waitFor(() => {
			expect(selections()).toBe(`${groupName}=Item.wild-shape-world`);
		});
	});

	it('drops the group entirely when the last selection is toggled off', async () => {
		const { select, selections } = renderHarness({
			features: [worldCopy, packCopy],
			selectionCount: 1,
			selectionMax: 2,
		});

		select(worldCopy);
		await waitFor(() => {
			expect(selections()).toContain('Item.wild-shape-world');
		});

		select(worldCopy);
		await waitFor(() => {
			expect(selections()).toBe('');
		});
	});
});
