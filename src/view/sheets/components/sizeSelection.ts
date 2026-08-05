/**
 * Pure helpers for the ancestry size selection.
 *
 * An ancestry always offers at least one size. Legacy items may still store an empty array, so
 * reads go through `effectiveSizes` and every write is guaranteed non-empty: removing the last
 * remaining size falls back to `DEFAULT_SIZE` rather than clearing the field.
 */

const DEFAULT_SIZE = 'medium';

/**
 * The selection to display for a stored value. An empty stored array means the size was never
 * authored, which presents as the default rather than as "no sizes".
 */
function effectiveSizes(storedSizes: string[] | undefined | null, sizeOrder: string[]): string[] {
	if (storedSizes?.length) return sortBySizeOrder(storedSizes, sizeOrder);

	return [DEFAULT_SIZE];
}

/**
 * Sizes in the canonical order of `CONFIG.NIMBLE.sizeCategories`. Values the config does not
 * define sort first — they are preserved rather than dropped.
 */
function sortBySizeOrder(sizes: string[], sizeOrder: string[]): string[] {
	return [...sizes].sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
}

/**
 * Add or remove one size, keeping canonical order and never returning an empty selection.
 */
function toggleSize(currentSizes: string[], size: string, sizeOrder: string[]): string[] {
	if (!currentSizes.includes(size)) return sortBySizeOrder([...currentSizes, size], sizeOrder);

	const remaining = currentSizes.filter((currentSize) => currentSize !== size);

	return remaining.length ? remaining : [DEFAULT_SIZE];
}

/**
 * Select every size, or fall back to the default when they are all already selected. Selecting
 * every size is how an ancestry declares that it does not restrict size.
 */
function toggleAllSizes(currentSizes: string[], sizeOrder: string[]): string[] {
	if (sizeOrder.every((size) => currentSizes.includes(size))) return [DEFAULT_SIZE];

	return [...sizeOrder];
}

export { DEFAULT_SIZE, effectiveSizes, sortBySizeOrder, toggleAllSizes, toggleSize };
