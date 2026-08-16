import { getItemSourceId } from './itemSourceRules.js';

/**
 * Document ids of the generic `Spell Scroll, Tier N` blanks in the magic items
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
	sourceId?: string;
	_stats?: { compendiumSource?: string | null } | null;
	flags?: { core?: { source?: string; sourceId?: string } };
}): number | null {
	if (item.type !== 'object') return null;

	// `getItemSourceId` covers `_stats.compendiumSource` and the legacy `sourceId`
	// and `flags.core.source` locations. `flags.core.sourceId` is checked beside it
	// because that is the key older Foundry versions actually wrote — it is what
	// `MigrationBase#getSourceId` reads — so a blank imported back then still
	// resolves. Documents carry `null` rather than `undefined` for an absent
	// compendium source, so normalize on the way in.
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
