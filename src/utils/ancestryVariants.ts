/**
 * Pure helpers for an ancestry's variant names.
 *
 * Some ancestries cover more than one kind of people — a Dryad and a Shroomling are the same
 * ancestry in play, and the rules say to take whichever flavour fits ("Flavor Is Free"). Such an
 * ancestry lists each name in `system.variants`; character creation offers them, and the ancestry on
 * the finished character takes the name the player chose.
 *
 * Nothing infers variants from the ancestry's own name: a GM authors them, so a slash in a name
 * means whatever the GM meant by it. Two names are the minimum that leaves a player anything to
 * choose, which is what `offersVariantChoice` reports — reads still return a lone name so the sheet
 * can show the first one the GM adds.
 *
 * Every comparison here is trimmed and case-insensitive (see `variantKey`), so the list a GM
 * authors and the lookups made against it agree on what counts as the same name.
 */

/**
 * How two names are compared throughout this module: trimmed and case-folded, so one list can never
 * hold two names that look alike, and a lookup finds the authored name however it was typed.
 */
function variantKey(variant: string | undefined | null): string {
	return variant?.trim().toLowerCase() ?? '';
}

/** Names as authored, minus blanks and repeats. Keeps the GM's order, which is the reading order. */
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

/** Whether the stored names leave the player a variant to pick during character creation. */
function offersVariantChoice(storedVariants: string[] | undefined | null): boolean {
	return effectiveVariants(storedVariants).length > 1;
}

/**
 * The ancestry's own spelling of a name it offers, or `null` when it offers no such name. Callers
 * that record the choice use this rather than the submitted string, so what lands on the character
 * is the name the GM authored — "shroomling" becomes "Shroomling".
 */
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

/** Append a name, ignoring one that is blank or already listed. */
function addVariant(currentVariants: string[], variant: string): string[] {
	return effectiveVariants([...currentVariants, variant]);
}

/** Drop a name, leaving the rest in their authored order. */
function removeVariant(currentVariants: string[], variant: string): string[] {
	const key = variantKey(variant);

	return effectiveVariants(currentVariants).filter(
		(currentVariant) => variantKey(currentVariant) !== key,
	);
}

export { addVariant, canonicalVariant, effectiveVariants, offersVariantChoice, removeVariant };
