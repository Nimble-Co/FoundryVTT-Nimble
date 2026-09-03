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
	let duplicateVariant = $state('');

	const currentVariants = $derived(effectiveVariants(getProps().selectedVariants));

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
