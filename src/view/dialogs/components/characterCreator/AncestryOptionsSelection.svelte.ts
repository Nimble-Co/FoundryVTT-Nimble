import { ancestryBonusRequiresSaveChoice } from '../../characterCreation/utils/ancestryBonusRequiresSaveChoice.js';
import {
	nextRadioIndex,
	numberSteps,
	prepareAncestrySizes,
	prepareAncestryVariants,
} from './AncestryOptionsSelection.utils.js';

interface AncestryOptionsSelectionStateParams {
	getSelectedAncestry: () => NimbleAncestryItem | null;
	getSelectedAncestryBonus: () => NimbleAncestryBonusItem | null;
	getSelectedClass: () => NimbleClassItem | null;
}

export function createAncestryOptionsSelectionState(params: AncestryOptionsSelectionStateParams) {
	const { getSelectedAncestry, getSelectedAncestryBonus, getSelectedClass } = params;

	const { ancestryOptions } = CONFIG.NIMBLE;

	const ancestryVariants = $derived(prepareAncestryVariants(getSelectedAncestry()));
	const ancestrySizes = $derived(prepareAncestrySizes(getSelectedAncestry()));

	const hasVariantChoice = $derived(ancestryVariants.length > 1);
	const hasSizeChoice = $derived(ancestrySizes.length > 1);
	// A single size is stated rather than asked, so the player still learns what they are.
	const hasFixedSize = $derived(ancestrySizes.length === 1);
	const hasSaveChoice = $derived(ancestryBonusRequiresSaveChoice(getSelectedAncestryBonus()));
	const hasAnyChoice = $derived(hasVariantChoice || hasSizeChoice || hasFixedSize || hasSaveChoice);

	const stepHeaders = $derived(
		numberSteps([
			[hasVariantChoice, 'variant', ancestryOptions.variant],
			[hasSizeChoice, 'sizeCategory', ancestryOptions.sizeCategory],
			[hasSaveChoice && !!getSelectedClass(), 'enhancedSave', ancestryOptions.enhancedSave],
		]),
	);

	// Roving tabindex: the group is one tab stop, and Tab returns to the last option walked to.
	const focusedValues = $state<Record<string, string>>({});

	function focusedValue(groupLabel: string, values: string[], selected: string | null): string {
		const focused = focusedValues[groupLabel] ?? selected;

		return focused && values.includes(focused) ? focused : values[0];
	}

	// Arrows move focus only, unlike the usual radiogroup pattern: choosing a variant closes its list
	// behind an edit control, so an arrow that chose would commit the player to whatever it landed on.
	function handleRadioKeydown(
		event: KeyboardEvent & { currentTarget: HTMLElement },
		groupLabel: string,
		index: number,
		values: string[],
	): void {
		const next = nextRadioIndex(event.key, index, values.length);
		if (next === null) return;

		event.preventDefault();
		focusedValues[groupLabel] = values[next];

		const group = event.currentTarget.closest('[role="radiogroup"]');
		group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
	}

	return {
		get ancestryVariants() {
			return ancestryVariants;
		},
		get ancestrySizes() {
			return ancestrySizes;
		},
		get hasVariantChoice() {
			return hasVariantChoice;
		},
		get hasSizeChoice() {
			return hasSizeChoice;
		},
		get hasFixedSize() {
			return hasFixedSize;
		},
		get hasSaveChoice() {
			return hasSaveChoice;
		},
		get hasAnyChoice() {
			return hasAnyChoice;
		},
		get stepHeaders() {
			return stepHeaders;
		},
		focusedValue,
		handleRadioKeydown,
	};
}
