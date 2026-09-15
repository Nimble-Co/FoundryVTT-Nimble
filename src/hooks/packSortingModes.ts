/**
 * Foundry sorts compendium contents alphabetically unless the viewing user has switched that
 * pack to manual sorting, and no manifest field can change that default. Packs whose order is
 * meaningful (the Core Rules journal follows the rulebook's chapter order) declare
 * `flags.nimble.sorting` in system.json; this seeds the user's preference from it once, leaving
 * any choice they have already made alone.
 */
export default async function applyPackSortingModes(): Promise<void> {
	const sortingModes = game.settings.get('core', 'collectionSortingModes') ?? {};
	const seededPacks: any[] = [];

	for (const pack of game.packs) {
		const declaredMode = (pack.metadata.flags as any)?.nimble?.sorting;
		if (!declaredMode || sortingModes[pack.metadata.id]) continue;

		sortingModes[pack.metadata.id] = declaredMode;
		seededPacks.push(pack);
	}

	if (!seededPacks.length) return;

	await game.settings.set('core', 'collectionSortingModes', sortingModes);

	// Pack trees are built during init and cached, so they predate the setting written above.
	for (const pack of seededPacks) pack.initializeTree();
}
