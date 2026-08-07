/**
 * Document ids of the generic `Spell Scroll - Tier N` blanks in the magic items
 * pack, mapped to the tier each one is fixed at.
 *
 * Matching on the bare document id rather than a flag or a name is deliberate:
 *
 * - A system-id-scoped flag would not survive the dev build. `dev-rebrand.mjs`
 *   rewrites only the compendium-uuid and asset-path prefixes inside
 *   `packs/**\/*.json` — not flag scope keys — so a scope key authored in pack
 *   data would keep the stable system id while `SYSTEM_ID` resolves to the dev
 *   one, and the lookup would silently miss.
 * - `system.identifier` is a user-editable field shown on the object sheet.
 * - Names are translated by Babele.
 *
 * Document ids are identical across both builds, so this resolves on either.
 */
export const TIER_BY_SPELL_SCROLL_TEMPLATE_ID: Readonly<Record<string, number>> = Object.freeze({
	'1UL6G7MDgUqtt4fN': 0,
	FS6fnTIbAVk8CNSa: 1,
	'2aE1qNnrjVjNlsMe': 2,
	M893NOzlKaimRo0t: 3,
	'0txsSMjpZOhH5mW5': 4,
	blN77nwJUFdIfboX: 5,
	rRJiGuX9hFAE2zcH: 6,
	n8I8eqs8zYv67NA7: 7,
	UjUhwAWjkvdhavcp: 8,
	'3YHEw1vfuHAFRJ2a': 9,
});

/** Trailing document id of a UUID such as `Compendium.<pack>.Item.<id>`. */
export function documentIdFromUuid(uuid: string): string {
	const segments = uuid.split('.');
	return segments[segments.length - 1] ?? '';
}

/**
 * The tier of a dropped generic spell scroll template, or null when the item is
 * not one.
 *
 * An already-inscribed scroll is never a template: it is created from
 * `createScrollFromSpell` and carries no template id.
 */
export default function getSpellScrollTemplateTier(item: {
	type?: unknown;
	_id?: unknown;
	uuid?: unknown;
	_stats?: { compendiumSource?: string | null } | null;
}): number | null {
	if (item.type !== 'object') return null;

	const candidateIds = [
		typeof item._id === 'string' ? item._id : null,
		typeof item.uuid === 'string' ? documentIdFromUuid(item.uuid) : null,
		typeof item._stats?.compendiumSource === 'string'
			? documentIdFromUuid(item._stats.compendiumSource)
			: null,
	];

	for (const candidateId of candidateIds) {
		if (!candidateId) continue;
		const tier = TIER_BY_SPELL_SCROLL_TEMPLATE_ID[candidateId];
		if (typeof tier === 'number') return tier;
	}

	return null;
}
