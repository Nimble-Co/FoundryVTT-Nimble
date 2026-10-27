/**
 * Pure helpers for the ancestry size selection.
 *
 * An ancestry always offers at least one size, so every write is guaranteed non-empty: removing the
 * last remaining size restores a fallback instead of clearing the field. Callers supply that
 * fallback — a world copy of a published ancestry restores the size it shipped with — and anything
 * without one lands on `DEFAULT_SIZE`. Imported or hand-edited items can still store an empty array
 * or duplicates, so reads go through `effectiveSizes`.
 */

const DEFAULT_SIZE = 'medium';

/**
 * The selection to display for a stored value: deduplicated and in canonical order. An empty stored
 * array means the size was never authored, which presents as the default rather than as "no sizes".
 */
function effectiveSizes(storedSizes: string[] | undefined | null, sizeOrder: string[]): string[] {
	if (storedSizes?.length) return sortBySizeOrder([...new Set(storedSizes)], sizeOrder);

	return [DEFAULT_SIZE];
}

/**
 * Sizes in the canonical order of `CONFIG.NIMBLE.sizeCategories`. Values the config does not
 * define sort first — they are preserved rather than dropped.
 */
function sortBySizeOrder(sizes: string[], sizeOrder: string[]): string[] {
	return [...sizes].sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
}

/** Whether the stored value leaves the player a size to pick during character creation. */
function offersSizeChoice(storedSizes: string[] | undefined | null, sizeOrder: string[]): boolean {
	return effectiveSizes(storedSizes, sizeOrder).length > 1;
}

/**
 * Add or remove one size, keeping canonical order and never returning an empty selection. A removal
 * that empties the selection restores `fallbackSizes`.
 */
function toggleSize(
	currentSizes: string[],
	size: string,
	sizeOrder: string[],
	fallbackSizes: string[] = [DEFAULT_SIZE],
): string[] {
	if (!currentSizes.includes(size))
		return sortBySizeOrder([...new Set([...currentSizes, size])], sizeOrder);

	return withFallback(
		currentSizes.filter((currentSize) => currentSize !== size),
		sizeOrder,
		fallbackSizes,
	);
}

/**
 * Select every size, or deselect them all when they are already selected. Selecting every size is
 * how an ancestry declares that it does not restrict size; deselecting them all keeps whatever the
 * config does not define and otherwise restores `fallbackSizes`, exactly as removing one does.
 */
function toggleAllSizes(
	currentSizes: string[],
	sizeOrder: string[],
	fallbackSizes: string[] = [DEFAULT_SIZE],
): string[] {
	if (!sizeOrder.every((size) => currentSizes.includes(size)))
		return sortBySizeOrder([...new Set([...currentSizes, ...sizeOrder])], sizeOrder);

	return withFallback(
		currentSizes.filter((currentSize) => !sizeOrder.includes(currentSize)),
		sizeOrder,
		fallbackSizes,
	);
}

/** What a removal leaves behind, or the fallback when it leaves nothing. */
function withFallback(
	remainingSizes: string[],
	sizeOrder: string[],
	fallbackSizes: string[],
): string[] {
	if (remainingSizes.length) return sortBySizeOrder([...new Set(remainingSizes)], sizeOrder);

	return effectiveSizes(fallbackSizes, sizeOrder);
}

export {
	DEFAULT_SIZE,
	effectiveSizes,
	offersSizeChoice,
	sortBySizeOrder,
	toggleAllSizes,
	toggleSize,
};
