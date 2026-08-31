import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	LevelCorrectionSelection,
	ResolvedLevelSelectionGap,
} from '#types/components/CharacterLevelCorrectionDialog.d.ts';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';

import { isFixedGroup } from './selectionGroupRules.ts';

/**
 * Creates reactive state for the CharacterLevelCorrectionDialog component.
 *
 * Each gap is presented as one selection group asking for exactly the picks the character is
 * still owed, and the dialog submits only once every gap is filled — a partial correction would
 * leave the same warning on the sheet with no record of what was already answered.
 */
export function createLevelCorrectionState(
	getGaps: () => ResolvedLevelSelectionGap[],
	getDialog: () => { submit(data: Record<string, unknown>): void },
) {
	let selectionsByPool = $state<Map<string, NimbleFeatureItem[]>>(new Map());

	const groups = $derived(
		getGaps().map((gap) => ({
			gap,
			group: {
				features: gap.candidates,
				selectionCount: gap.missingCount,
				...(gap.displayName ? { displayName: gap.displayName } : {}),
			} satisfies SelectionGroup,
		})),
	);

	const isComplete = $derived(
		getGaps().every((gap) => (selectionsByPool.get(gap.poolKey) ?? []).length === gap.missingCount),
	);

	// A pool with exactly as many candidates left as picks owed offers no choice, and
	// FeatureGroupSelection renders it as a non-interactive list — so fill it here or the dialog
	// could never complete.
	$effect(() => {
		const filled = new Map(selectionsByPool);
		let hasChanges = false;

		for (const { gap, group } of groups) {
			if (filled.has(gap.poolKey)) continue;
			if (!isFixedGroup(group)) continue;
			filled.set(gap.poolKey, [...group.features]);
			hasChanges = true;
		}

		if (hasChanges) selectionsByPool = filled;
	});

	function getSelectedFeatures(poolKey: string): NimbleFeatureItem[] {
		return selectionsByPool.get(poolKey) ?? [];
	}

	function toggleFeature(poolKey: string, feature: NimbleFeatureItem) {
		const gap = getGaps().find((candidate) => candidate.poolKey === poolKey);
		if (!gap) return;

		const current = getSelectedFeatures(poolKey);
		const isSelected = current.some((selected) => selected.uuid === feature.uuid);

		let next: NimbleFeatureItem[];
		if (isSelected) {
			next = current.filter((selected) => selected.uuid !== feature.uuid);
		} else if (current.length >= gap.missingCount) {
			return;
		} else {
			next = [...current, feature];
		}

		const updated = new Map(selectionsByPool);
		if (next.length === 0) updated.delete(poolKey);
		else updated.set(poolKey, next);
		selectionsByPool = updated;
	}

	function submit() {
		const selections: LevelCorrectionSelection[] = getGaps().map((gap) => ({
			level: gap.level,
			uuids: getSelectedFeatures(gap.poolKey).map((feature) => feature.uuid ?? ''),
		}));

		getDialog().submit({ selections });
	}

	return {
		get groups() {
			return groups;
		},
		get isComplete() {
			return isComplete;
		},
		getSelectedFeatures,
		toggleFeature,
		submit,
	};
}
