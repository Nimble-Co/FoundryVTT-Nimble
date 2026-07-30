import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Resolves how many features a player may select from a group.
 *
 * Most groups are an exact choice, where the maximum equals the required `selectionCount`.
 * Range groups (currently only duplicate-source groups) set `selectionMax` higher so the
 * player can keep more than the minimum.
 */
export default function getEffectiveSelectionMax(
	group: Pick<SelectionGroup, 'selectionCount' | 'selectionMax'>,
): number {
	return group.selectionMax ?? group.selectionCount;
}
