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
 */

/** Names as authored, minus blanks and repeats. Keeps the GM's order, which is the reading order. */
function effectiveVariants(storedVariants: string[] | undefined | null): string[] {
	if (!storedVariants?.length) return [];

	const seen = new Set<string>();

	return storedVariants.reduce<string[]>((variants, storedVariant) => {
		const variant = storedVariant?.trim() ?? '';
		// Compared case-insensitively so "Dryad" and "dryad" can't become two identical-looking
		// options; the spelling that survives is the one authored first.
		const key = variant.toLowerCase();

		if (!variant || seen.has(key)) return variants;

		seen.add(key);
		variants.push(variant);

		return variants;
	}, []);
}

/** Whether the stored names leave the player a variant to pick during character creation. */
function offersVariantChoice(storedVariants: string[] | undefined | null): boolean {
	return effectiveVariants(storedVariants).length > 1;
}

/** Whether a name is one of the variants this ancestry offers. */
function isVariantOf(storedVariants: string[] | undefined | null, variant: string): boolean {
	return effectiveVariants(storedVariants).includes(variant.trim());
}

/** Append a name, ignoring one that is blank or already listed. */
function addVariant(currentVariants: string[], variant: string): string[] {
	return effectiveVariants([...currentVariants, variant]);
}

/** Drop a name, leaving the rest in their authored order. */
function removeVariant(currentVariants: string[], variant: string): string[] {
	return effectiveVariants(currentVariants).filter((currentVariant) => currentVariant !== variant);
}

export { addVariant, effectiveVariants, isVariantOf, offersVariantChoice, removeVariant };
