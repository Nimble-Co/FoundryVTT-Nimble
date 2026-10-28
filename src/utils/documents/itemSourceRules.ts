type ItemSourceLike = {
	sourceId?: string;
	_stats?: { compendiumSource?: string };
	flags?: { core?: { source?: string } };
};

export const sourceRuleCache = new Map<string, Record<string, unknown>[]>();

export function getItemSourceId(item: ItemSourceLike): string | undefined {
	return item.sourceId ?? item._stats?.compendiumSource ?? item.flags?.core?.source;
}

export function getRulesFromCompendiumSource(item: ItemSourceLike): Record<string, unknown>[] {
	const sourceId = getItemSourceId(item);
	if (!sourceId) return [];

	const cached = sourceRuleCache.get(sourceId);
	if (cached && cached.length > 0) return foundry.utils.deepClone(cached);

	const fromUuidSyncFn = (globalThis as Record<string, unknown>).fromUuidSync as
		| ((uuid: string) => unknown)
		| undefined;
	if (typeof fromUuidSyncFn !== 'function') return [];

	const sourceItem = fromUuidSyncFn(sourceId) as {
		system?: { rules?: Record<string, unknown>[] };
	} | null;

	const rules = Array.isArray(sourceItem?.system?.rules) ? sourceItem.system.rules : [];
	if (rules.length > 0) sourceRuleCache.set(sourceId, foundry.utils.deepClone(rules));
	return foundry.utils.deepClone(rules);
}
