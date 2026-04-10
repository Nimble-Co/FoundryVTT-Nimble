import type { SpellIndexEntry } from '#utils/getSpells.js';
import localize from '#utils/localize.js';
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
 * @param getOnSelect - Optional getter for the select callback
 * @param getIsDisabled - Optional getter for the disabled state
 * @returns Object containing state and actions for the spell card
 */
export function createSpellCardState(
	getSpell: () => SpellIndexEntry,
	getOnSelect?: () => (() => void) | undefined,
	getIsDisabled?: () => boolean,
) {
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

	const tierLabel = $derived(
		getSpell().tier === 0
			? localize('NIMBLE.ui.heroicActions.cantrip')
			: localize('NIMBLE.ui.heroicActions.spellTier', { tier: String(getSpell().tier) }),
	);

	const schoolLabel = $derived(
		localize(CONFIG.NIMBLE.spellSchools[getSpell().school] ?? getSpell().school),
	);

	const isSelectable = $derived(!!getOnSelect?.());

	function handleRowClick() {
		toggleExpanded();
	}

	function handleSelectClick(e: MouseEvent) {
		e.stopPropagation();
		if (!getIsDisabled?.()) {
			getOnSelect?.()?.();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleRowClick();
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
		get tierLabel() {
			return tierLabel;
		},
		get schoolLabel() {
			return schoolLabel;
		},
		get isSelectable() {
			return isSelectable;
		},
		toggleExpanded,
		handleRowClick,
		handleSelectClick,
		handleKeydown,
	};
}
