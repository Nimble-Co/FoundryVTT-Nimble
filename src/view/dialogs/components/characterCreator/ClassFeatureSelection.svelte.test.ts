import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	ClassFeatureResult,
	SelectionGroup,
} from '#types/components/ClassFeatureSelection.d.ts';
import { DUPLICATE_SOURCE_GROUP_PREFIX } from '#utils/getClassFeatures.ts';
import ClassFeatureSelectionStateHarness from '../../../../../tests/harnesses/ClassFeatureSelectionStateHarness.svelte';
import { createClassFeatureSelectionState as createLevelUpState } from '../levelUpHelper/LevelUpClassFeatureSelection.svelte.ts';
import { createClassFeatureSelectionState as createCreatorState } from './ClassFeatureSelection.svelte.ts';

type HarnessFactory = (
	getClassFeatures: () => ClassFeatureResult,
	getSelectedFeatures: () => Map<string, NimbleFeatureItem[]>,
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem[]>) => void,
) => { handleFeatureSelect: (groupName: string, feature: NimbleFeatureItem) => void };

// The UUID stays non-null in the return type: these copies stand in for stored documents, and
// the groups below key on the exact UUID handed in here.
function createFeatureItem(uuid: string, name: string): NimbleFeatureItem & { uuid: string } {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		system: { description: '' },
	} as NimbleFeatureItem & { uuid: string };
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
		groupName = `${DUPLICATE_SOURCE_GROUP_PREFIX}Item.wild-shape-world`,
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

	it('starts a duplicate-source group on its recommended copy', async () => {
		// The feature used to be granted outright, so the dialog opens on a working answer rather
		// than demanding a click before level-up can proceed.
		const { selections, groupName } = renderHarness({
			features: [worldCopy, packCopy],
			selectionCount: 1,
			selectionMax: 2,
			recommendedUuid: packCopy.uuid,
		});

		await waitFor(() => {
			expect(selections()).toBe(`${groupName}=${packCopy.uuid}`);
		});
	});

	it('leaves a duplicate-source group empty when a copy is already on the sheet', async () => {
		// Keeping only the owned copy is a valid outcome here, so nothing may be chosen for the
		// player — preselecting would make that outcome unreachable.
		const { selections } = renderHarness({
			features: [worldCopy, packCopy],
			selectionCount: 0,
			selectionMax: 1,
			ownedUuids: new Set([worldCopy.uuid]),
			recommendedUuid: packCopy.uuid,
		});

		await waitFor(() => {
			expect(selections()).toBe('');
		});
		expect(selections()).toBe('');
	});

	it('caps a group at its required count', async () => {
		const { select, selections, groupName } = renderHarness(
			{ features: [worldCopy, packCopy, thirdCopy], selectionCount: 1 },
			'combat-maneuvers',
		);

		select(worldCopy);
		await waitFor(() => {
			expect(selections()).toBe(`${groupName}=Item.wild-shape-world`);
		});

		select(packCopy);
		// `waitFor` checks its callback once synchronously, before Svelte flushes, so a
		// "nothing changed" claim has to be re-asserted after the await to mean anything.
		await waitFor(() => {
			expect(selections()).toBe(`${groupName}=Item.wild-shape-world`);
		});
		expect(selections()).toBe(`${groupName}=Item.wild-shape-world`);
	});

	it('drops the group entirely when the last selection is toggled off', async () => {
		const { select, selections } = renderHarness(
			{ features: [worldCopy, packCopy], selectionCount: 1 },
			'combat-maneuvers',
		);

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
