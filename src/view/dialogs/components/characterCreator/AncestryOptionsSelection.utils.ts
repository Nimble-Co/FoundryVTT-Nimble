import { effectiveVariants, variantIcon } from '#utils/ancestryVariants.js';
import localize from '#utils/localize.js';
import { effectiveSizes } from '#utils/sizeSelection.js';
import type {
	AncestryChoiceOption,
	AncestryStepCandidate,
	AncestryStepKey,
} from './AncestryOptionsSelection.types.js';

// The ancestry itself is Step 2 and its bonus 2b, so the first thing asked here is 2c.
const FIRST_STEP_LETTER = 'c';

const ARROW_STEPS: Record<string, number> = {
	ArrowDown: 1,
	ArrowRight: 1,
	ArrowUp: -1,
	ArrowLeft: -1,
};

// Smallest to largest, so the list reads the same regardless of the order the sizes were authored
// in. An ancestry that predates the required-one rule resolves to the same default the character
// creation flow already falls back to, so the player is still told their size.
export function prepareAncestrySizes(ancestry: NimbleAncestryItem | null): string[] {
	if (!ancestry) return [];

	return effectiveSizes(ancestry.system?.size, Object.keys(CONFIG.NIMBLE.sizeCategories));
}

export function prepareAncestryVariants(ancestry: NimbleAncestryItem | null): string[] {
	if (!ancestry) return [];

	return effectiveVariants(ancestry.system?.variants);
}

export function toSizeOptions(sizes: string[]): AncestryChoiceOption[] {
	const { sizeCategories, sizeCategoryDescriptions } = CONFIG.NIMBLE;

	return sizes.map((size) => ({
		value: size,
		label: sizeCategories[size] ?? size,
		description: sizeCategoryDescriptions[size] ?? '',
		icon: '',
	}));
}

export function toVariantOptions(variants: string[]): AncestryChoiceOption[] {
	return variants.map((variant) => ({
		value: variant,
		label: variant,
		description: '',
		icon: variantIcon(variant),
	}));
}

export function prepareSaveOptions(
	selectedClass: NimbleClassItem | null,
): Array<{ value: string; label: string }> {
	if (!selectedClass) return [];

	const { savingThrows } = CONFIG.NIMBLE;
	const { advantage, disadvantage } = selectedClass.system?.savingThrows ?? {};

	return Object.keys(savingThrows)
		.filter((saveKey) => saveKey !== advantage && saveKey !== disadvantage)
		.map((saveKey) => ({ value: saveKey, label: savingThrows[saveKey] ?? saveKey }));
}

export function numberSteps(
	steps: AncestryStepCandidate[],
): Partial<Record<AncestryStepKey, string>> {
	const { stepHeader } = CONFIG.NIMBLE.ancestryOptions;
	const headers: Partial<Record<AncestryStepKey, string>> = {};
	let letterCode = FIRST_STEP_LETTER.charCodeAt(0);

	for (const [asked, key, label] of steps) {
		if (!asked) continue;

		headers[key] = localize(stepHeader, { step: String.fromCharCode(letterCode), label });
		letterCode += 1;
	}

	return headers;
}

/** The index an arrow key walks to, wrapping at both ends, or `null` for any other key. */
export function nextRadioIndex(key: string, index: number, length: number): number | null {
	const step = ARROW_STEPS[key];
	if (step === undefined || !length) return null;

	return (index + step + length) % length;
}
