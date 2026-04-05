import type { SpellIndexEntry } from '#utils/getSpells.js';
import enrichSpellText from '#utils/spellDescription.js';

interface SpellDescriptionParts {
	baseEffect?: string;
	higherLevelEffect?: string;
	upcastEffect?: string;
}

/**
 * Combines spell description parts into a single HTML string
 */
function combineSpellDescriptionParts(
	description: SpellDescriptionParts | string | null | undefined,
): string {
	if (typeof description === 'string') {
		return description;
	}

	if (!description || typeof description !== 'object') {
		return '';
	}

	const parts: string[] = [];
	if (description.baseEffect) parts.push(description.baseEffect);
	if (description.higherLevelEffect) {
		parts.push(`<p><strong>Higher Levels:</strong> ${description.higherLevelEffect}</p>`);
	}
	if (description.upcastEffect) {
		parts.push(`<p><strong>Upcast:</strong> ${description.upcastEffect}</p>`);
	}

	return parts.join('');
}

/**
 * Fetches a spell by UUID and returns its combined description
 */
async function fetchSpellDescriptionByUuid(uuid: string): Promise<string> {
	try {
		const spell = (await fromUuid(uuid)) as Item | null;
		if (!spell) return '';

		const system = spell.system as { description?: SpellDescriptionParts };
		return combineSpellDescriptionParts(system?.description);
	} catch {
		return '';
	}
}

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
