/**
 * The rules governing how many features a player must and may keep from a selection group,
 * shared by the character-creation and level-up dialogs.
 */

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Resolves how many features a player may select from a group.
 *
 * Most groups are an exact choice, where the maximum equals the required `selectionCount`.
 * Range groups (currently only duplicate-source groups) set `selectionMax` higher so the
 * player can keep more than the minimum.
 */
export function getEffectiveSelectionMax(
	group: Pick<SelectionGroup, 'selectionCount' | 'selectionMax'>,
): number {
	return group.selectionMax ?? group.selectionCount;
}

/**
 * A group is "fixed" when the only available options exactly match the required count — nothing
 * to choose, every card is granted.
 */
export function isFixedGroup(group: Pick<SelectionGroup, 'features' | 'selectionCount'>): boolean {
	return group.features.length === group.selectionCount;
}

/**
 * True when more selections are allowed than required — a duplicate-source group, where the
 * player keeps at least one copy and may keep more.
 */
export function isRangeGroup(
	group: Pick<SelectionGroup, 'selectionCount' | 'selectionMax'>,
): boolean {
	return getEffectiveSelectionMax(group) > group.selectionCount;
}

/** A group is complete once it holds at least the number of picks it requires. */
export function isGroupComplete(
	group: Pick<SelectionGroup, 'selectionCount'>,
	selectedFeatures: NimbleFeatureItem[],
): boolean {
	return selectedFeatures.length >= group.selectionCount;
}
