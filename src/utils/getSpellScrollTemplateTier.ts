import { getItemSourceId } from './itemSourceRules.js';

/**
 * Document ids of the generic `Spell Scroll, Tier N` blanks in the magic items
 * pack, mapped to the tier each one is fixed at.
 *
 * Matched on the bare document id, which is identical on the `nimble` and
 * `nimble-dev` builds. The alternatives all break: `dev-rebrand.mjs` rewrites
 * compendium-uuid and asset-path prefixes in `packs/**\/*.json` but not flag
 * scope keys, so a scoped flag would silently miss on the dev build;
 * `system.identifier` is user-editable; and names are translated by Babele.
 */
const TIER_BY_SPELL_SCROLL_TEMPLATE_ID: Readonly<Record<string, number>> = Object.freeze({
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
function documentIdFromUuid(uuid: string): string {
	return uuid.split('.').at(-1) ?? '';
}

/**
 * The tier of a dropped scroll blank, or null when the item is not one.
 *
 * An already-inscribed scroll never matches: `createScrollFromSpell` builds it
 * fresh, so it carries no blank's document id.
 */
export default function getSpellScrollTemplateTier(item: {
	type?: unknown;
	_id?: unknown;
	uuid?: unknown;
	sourceId?: string;
	_stats?: { compendiumSource?: string | null } | null;
	flags?: { core?: { source?: string; sourceId?: string } };
}): number | null {
	if (item.type !== 'object') return null;

	// `flags.core.sourceId` is checked beside `getItemSourceId` because that is the
	// key older Foundry versions wrote, and it is what `MigrationBase#getSourceId`
	// reads. Documents carry `null` for an absent compendium source, so normalize
	// on the way in.
	const sourceId =
		getItemSourceId({
			sourceId: item.sourceId,
			_stats: { compendiumSource: item._stats?.compendiumSource ?? undefined },
			flags: item.flags,
		}) ?? item.flags?.core?.sourceId;

	const candidateIds = [
		typeof item._id === 'string' ? item._id : null,
		typeof item.uuid === 'string' ? documentIdFromUuid(item.uuid) : null,
		sourceId ? documentIdFromUuid(sourceId) : null,
	];

	for (const candidateId of candidateIds) {
		if (!candidateId) continue;
		const tier = TIER_BY_SPELL_SCROLL_TEMPLATE_ID[candidateId];
		if (typeof tier === 'number') return tier;
	}

	return null;
}
