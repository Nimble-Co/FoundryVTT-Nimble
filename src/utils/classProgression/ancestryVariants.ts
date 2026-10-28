/**
 * Helpers for an ancestry's variant names.
 *
 * Some ancestries cover more than one kind of people. A Dryad and a Shroomling are the same ancestry
 * in play, and the rules say to take whichever flavour fits ("Flavor Is Free"). Such an ancestry
 * lists each name in `system.variants`, character creation offers them, and the ancestry on the
 * finished character takes the name the player chose.
 *
 * Nothing is inferred from the ancestry's own name: a GM authors the list, so a slash in a name
 * means whatever the GM meant by it.
 */

function variantKey(variant: string | undefined | null): string {
	return variant?.trim().toLowerCase() ?? '';
}

function effectiveVariants(storedVariants: string[] | undefined | null): string[] {
	if (!storedVariants?.length) return [];

	const variants: string[] = [];
	const seen = new Set<string>();

	for (const storedVariant of storedVariants) {
		const variant = storedVariant?.trim() ?? '';
		const key = variantKey(variant);

		if (!variant || seen.has(key)) continue;

		seen.add(key);
		variants.push(variant);
	}

	return variants;
}

function offersVariantChoice(storedVariants: string[] | undefined | null): boolean {
	return effectiveVariants(storedVariants).length > 1;
}

function canonicalVariant(
	storedVariants: string[] | undefined | null,
	variant: string,
): string | null {
	const key = variantKey(variant);
	if (!key) return null;

	return (
		effectiveVariants(storedVariants).find((storedVariant) => variantKey(storedVariant) === key) ??
		null
	);
}

function variantIcon(variant: string): string {
	const { ancestryVariantIcons, defaultAncestryVariantIcon } = CONFIG.NIMBLE;

	return ancestryVariantIcons[variantKey(variant)] ?? defaultAncestryVariantIcon;
}

function addVariant(currentVariants: string[], variant: string): string[] {
	return effectiveVariants([...currentVariants, variant]);
}

function removeVariant(currentVariants: string[], variant: string): string[] {
	const key = variantKey(variant);

	return effectiveVariants(currentVariants).filter(
		(currentVariant) => variantKey(currentVariant) !== key,
	);
}

export {
	addVariant,
	canonicalVariant,
	effectiveVariants,
	offersVariantChoice,
	removeVariant,
	variantIcon,
};
