import type { SpellIndexEntry } from '#utils/getSpells.js';

/**
 * Enriches a text segment using Foundry's TextEditor
 */
async function enrichText(text: string): Promise<string> {
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(text);
}

/**
 * Fetches the full spell document and extracts the description
 */
async function fetchSpellDescription(uuid: string): Promise<string> {
	try {
		const spell = (await fromUuid(uuid)) as Item | null;
		if (!spell) return '';

		const system = spell.system as {
			description?: { baseEffect?: string; higherLevelEffect?: string; upcastEffect?: string };
		};
		const desc = system?.description;

		// Combine description parts
		const parts: string[] = [];
		if (desc?.baseEffect) parts.push(desc.baseEffect);
		if (desc?.higherLevelEffect)
			parts.push(`<p><strong>Higher Levels:</strong> ${desc.higherLevelEffect}</p>`);
		if (desc?.upcastEffect) parts.push(`<p><strong>Upcast:</strong> ${desc.upcastEffect}</p>`);

		return parts.join('');
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
		const rawDescription = await fetchSpellDescription(spell.uuid);
		if (rawDescription) {
			enrichedDescription = await enrichText(rawDescription);
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
