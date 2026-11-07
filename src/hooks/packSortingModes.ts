/**
 * Foundry sorts compendium contents alphabetically unless this browser has switched that pack to
 * manual sorting, and no manifest field can change that default. Packs whose order is meaningful
 * (the Core Rules journal follows the rulebook's chapter order) declare a `sorting` flag under the
 * system scope in system.json; this seeds the browser's per-pack preference from it once, leaving
 * any choice already made here alone.
 */
export default function applyPackSortingModes(): void {
	const sortingModes = game.settings.get('core', 'collectionSortingModes') ?? {};
	const seededPacks: any[] = [];

	for (const pack of game.packs) {
		// dev-rebrand.mjs rewrites packs[*].system in system.json but leaves packs[*].flags alone,
		// so the manifest key is `nimble` on the nimble-dev build too.
		const declaredMode = (pack.metadata.flags as any)?.nimble?.sorting; // allow-hardcoded-system-id
		if (!declaredMode || sortingModes[pack.metadata.id]) continue;

		sortingModes[pack.metadata.id] = declaredMode;
		seededPacks.push(pack);
	}

	if (!seededPacks.length) return;

	// A client-scope setting lands in local storage synchronously, so the trees can be rebuilt at
	// once. Foundry built them in setupGame(), just before the setup hook fired.
	void game.settings.set('core', 'collectionSortingModes', sortingModes);
	for (const pack of seededPacks) pack.initializeTree();
}
