import type { SpellIndexEntry } from '#utils/getSpells.js';
import {
	enrichSpellText,
	fetchSpellDescriptionByUuid,
} from '../../../../utils/spellDescription.js';

/**
 * Creates reactive state for the SpellCard component
 *
 * @param getSpell - Getter function that returns the spell index entry
 * @returns Object containing state and actions for the spell card
 */
export function createSpellCardState(getSpell: () => SpellIndexEntry) {
	let isExpanded = $state(false);
	let enrichedDescription = $state<string>('');
	let isLoading = $state(false);

	// Load description when expanded for the first time
	async function loadDescription() {
		if (enrichedDescription || isLoading) return;

		isLoading = true;
		const spell = getSpell();
		const rawDescription = await fetchSpellDescriptionByUuid(spell.uuid);
		if (rawDescription) {
			enrichedDescription = await enrichSpellText(rawDescription);
		}
		isLoading = false;
	}

	function toggleExpanded() {
		isExpanded = !isExpanded;
		if (isExpanded) {
			loadDescription();
		}
	}

	return {
		get isExpanded() {
			return isExpanded;
		},
		get enrichedDescription() {
			return enrichedDescription;
		},
		get isLoading() {
			return isLoading;
		},
		toggleExpanded,
	};
}
