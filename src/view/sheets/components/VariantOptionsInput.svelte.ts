import type { VariantOptionsInputProps } from '#types/components/VariantOptionsInput.d.ts';
import { addVariant, effectiveVariants, removeVariant } from '#utils/ancestryVariants.js';
import localize from '#utils/localize.js';

function formatVariants(variants: string[]): string {
	const formatter = new Intl.ListFormat(game.i18n?.lang ?? 'en', {
		style: 'long',
		type: 'disjunction',
	});

	return formatter.format(variants);
}

export function createVariantOptionsInputState(getProps: () => VariantOptionsInputProps) {
	let draftVariant = $state('');
	/** A name the list already carries, shown until the next add or removal. */
	let duplicateVariant = $state('');

	// Imported or hand-edited ancestries can still store blanks or repeats; reads normalize both.
	const currentVariants = $derived(effectiveVariants(getProps().selectedVariants));

	/** What the GM's list means for character creation. */
	const summary = $derived.by(() => {
		if (currentVariants.length > 1) {
			return localize('NIMBLE.ancestrySheet.variantsSummaryChoice', {
				variants: formatVariants(currentVariants),
			});
		}

		if (currentVariants.length === 1) return localize('NIMBLE.ancestrySheet.variantsSummaryOne');

		return localize('NIMBLE.ancestrySheet.variantsSummaryNone', {
			ancestry: getProps().ancestryName,
		});
	});

	/**
	 * Commit the draft name. A name the list already carries stays in the field with a note saying
	 * so, rather than vanishing as though it had been added.
	 */
	function addDraftVariant() {
		const variant = draftVariant.trim();
		const nextVariants = addVariant(currentVariants, variant);

		if (nextVariants.length === currentVariants.length) {
			duplicateVariant = variant;
			return;
		}

		duplicateVariant = '';
		draftVariant = '';
		getProps().onChange(nextVariants);
	}

	/** Enter adds the name rather than submitting the sheet, matching the Add button. */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		event.preventDefault();
		addDraftVariant();
	}

	function removeListedVariant(variant: string) {
		duplicateVariant = '';
		getProps().onChange(removeVariant(currentVariants, variant));
	}

	return {
		get draftVariant() {
			return draftVariant;
		},
		set draftVariant(value: string) {
			draftVariant = value;
		},
		get duplicateVariant() {
			return duplicateVariant;
		},
		get currentVariants() {
			return currentVariants;
		},
		get summary() {
			return summary;
		},
		addDraftVariant,
		handleKeydown,
		removeListedVariant,
	};
}
