/**
 * Module-scoped singleton cache of tag keys harvested from every Actor
 * compendium. Shared across every `<PredicateBuilder>` instance so the
 * pack scan only runs once per page load, regardless of how many
 * builders are mounted.
 */

let compendiumKeys = $state<Set<string>>(new Set());
let compendiumLoadPromise: Promise<void> | null = null;

interface PackLike {
	metadata?: { type?: string };
	getDocuments?: () => Promise<Array<{ tags?: Set<string> }>>;
}

export function loadCompendiumKeys(): Promise<void> {
	if (compendiumLoadPromise) return compendiumLoadPromise;
	compendiumLoadPromise = (async () => {
		const next = new Set<string>();
		const packs = (game as unknown as { packs?: Iterable<PackLike> }).packs;
		if (!packs) return;
		for (const pack of packs) {
			if (pack.metadata?.type !== 'Actor') continue;
			try {
				const docs = (await pack.getDocuments?.()) ?? [];
				for (const doc of docs) {
					if (!doc.tags) continue;
					for (const entry of doc.tags) {
						const k = entry.split(':', 1)[0];
						if (k) next.add(k);
					}
				}
			} catch {
				// Partial keys from other packs beat zero.
			}
		}
		compendiumKeys = next;
	})();
	return compendiumLoadPromise;
}

export function getCompendiumKeys(): Set<string> {
	return compendiumKeys;
}
