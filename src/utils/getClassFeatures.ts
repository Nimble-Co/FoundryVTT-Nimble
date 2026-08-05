import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';
import getItemSource from '#utils/getItemSource.ts';
import isLevelUpOptionApplicable from '#utils/isLevelUpOptionApplicable.ts';

/**
 * Lightweight entry stored in the class feature index.
 * Contains only the data needed for lookups, not full documents.
 */
interface ClassFeatureIndexEntry {
	uuid: string;
	group: string;
	selectionCountByLevel: Record<string, number>;
}

/**
 * Index structure for fast class feature lookups.
 * Maps classIdentifier (or groupName for group-based features) → level → array of feature entries.
 */
export type ClassFeatureIndex = Map<string, Map<number, ClassFeatureIndexEntry[]>>;

/**
 * Shape of a feature's indexed fields in a compendium pack.
 * These fields are configured in init.ts via CONFIG.Item.compendiumIndexFields.
 */
interface FeatureIndexEntry {
	_id: string;
	uuid: string;
	type: string;
	name: string;
	system?: {
		class?: string;
		subclass?: string;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
		group?: string;
		selectionCountByLevel?: Record<string, number>;
	};
}

/**
 * Options controlling how a class feature lookup is resolved.
 */
export interface GetClassFeaturesOptions {
	/**
	 * UUIDs and compendium-source UUIDs of features already owned by the actor.
	 * Any feature whose uuid appears here is filtered out of selection groups and auto-grants.
	 */
	ownedFeatureUuids?: ReadonlySet<string>;
	/**
	 * Offer auto-grant features that exist in more than one source (a customized World Item
	 * plus its Compendium original) as a "choose one or keep all" selection instead of granting
	 * every copy. Only the character-creation and level-up dialogs present that choice; the
	 * class sheet's progression view describes what a class grants and leaves copies as-is.
	 */
	promoteDuplicateSources?: boolean;
}

/**
 * Builds a class feature index by scanning all packs once.
 * Call this when opening the character creator, then use getClassFeaturesFromIndex
 * for instant lookups.
 *
 * Features are indexed by:
 * - Their `class` field if set (e.g., "berserker")
 * - Their `group` field if class is not set (e.g., "savage-arsenal")
 *
 * This allows features without a class to be looked up by group name,
 * which can then be matched against a class's groupIdentifiers.
 */
export async function buildClassFeatureIndex(): Promise<ClassFeatureIndex> {
	const index: ClassFeatureIndex = new Map();

	// Track seen UUIDs per key+level to avoid duplicates
	const seen = new Map<string, Set<string>>();

	/**
	 * Adds a feature entry to the index for a specific key (class or group) and level.
	 * Deduplicates by UUID to handle features with both gainedAtLevel and gainedAtLevels.
	 */
	function addToIndex(key: string, level: number, entry: ClassFeatureIndexEntry): boolean {
		const lookupKey = `${key}:${level}`;
		if (!seen.has(lookupKey)) {
			seen.set(lookupKey, new Set());
		}
		if (seen.get(lookupKey)!.has(entry.uuid)) {
			return false; // Already added
		}
		seen.get(lookupKey)!.add(entry.uuid);

		if (!index.has(key)) {
			index.set(key, new Map());
		}
		const levelMap = index.get(key)!;
		if (!levelMap.has(level)) {
			levelMap.set(level, []);
		}
		levelMap.get(level)!.push(entry);
		return true;
	}

	/**
	 * Processes a feature and adds it to the index.
	 * Features with a class are indexed by class.
	 * Features without a class but with a group are indexed by group.
	 */
	function processFeature(
		uuid: string,
		system: {
			class?: string;
			subclass?: boolean | string;
			gainedAtLevel?: number | null;
			gainedAtLevels?: number[];
			group?: string;
			selectionCountByLevel?: Record<string, number>;
		},
	): void {
		// Skip subclass features
		if (system.subclass) return;

		// Determine the index key: use class if set, otherwise use group
		const indexKey = system.class || system.group;
		if (!indexKey) return;

		const entry: ClassFeatureIndexEntry = {
			uuid,
			group: system.group || 'ungrouped',
			selectionCountByLevel: system.selectionCountByLevel ?? {},
		};

		// Add to index for gainedAtLevel
		if (system.gainedAtLevel) {
			addToIndex(indexKey, system.gainedAtLevel, entry);
		}

		// Add to index for each level in gainedAtLevels
		if (system.gainedAtLevels) {
			for (const level of system.gainedAtLevels) {
				addToIndex(indexKey, level, entry);
			}
		}
	}

	// Process world items
	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		const featureItem = item as NimbleFeatureItem;
		// World items are stored, so `uuid` is always present.
		processFeature(featureItem.uuid ?? '', featureItem.system);
	}

	// Process compendium packs
	// Must call getIndex() with explicit fields to ensure custom fields are loaded
	const indexFields = [
		'system.class',
		'system.subclass',
		'system.gainedAtLevel',
		'system.gainedAtLevels',
		'system.group',
		'system.selectionCountByLevel',
	] as string[];
	for (const pack of game.packs) {
		if (pack.documentName !== 'Item') continue;

		const packIndex = await pack.getIndex({ fields: indexFields });
		for (const indexEntry of packIndex) {
			const packEntry = indexEntry as FeatureIndexEntry;
			if (packEntry.type !== 'feature') continue;
			if (!packEntry.system) continue;

			processFeature(packEntry.uuid, packEntry.system);
		}
	}

	return index;
}

/**
 * Resolves the required number of selections for a group at a specific level.
 *
 * The count is taken from the `selectionCountByLevel` field on each feature entry;
 * we use the max across features in the group so a single authoritative feature can
 * drive the count even if other entries in the group omit the field. Missing values
 * default to 1, preserving the pre-existing "choose one" behaviour.
 */
function resolveSelectionCount(entries: ClassFeatureIndexEntry[], level: number): number {
	const levelKey = String(level);
	let count = 1;
	let firstExplicitCount: number | undefined;

	for (const entry of entries) {
		const candidate = entry.selectionCountByLevel?.[levelKey];
		if (typeof candidate !== 'number' || !Number.isInteger(candidate)) continue;

		if (firstExplicitCount === undefined) {
			firstExplicitCount = candidate;
		} else if (candidate !== firstExplicitCount) {
			console.warn(
				`[Nimble] selectionCountByLevel conflict at level ${level}: entries disagree (${firstExplicitCount} vs ${candidate}). Using the higher value.`,
			);
		}

		if (candidate > count) count = candidate;
	}

	return count;
}

/**
 * Prefix for the synthetic group key of a promoted duplicate-source selection. Deliberately
 * carries no system id: the key only lives in memory for one dialog session and must never be
 * confused with a real, authorable `system.group` value.
 */
export const DUPLICATE_SOURCE_GROUP_PREFIX = 'duplicate-source:';

/** A feature's name, trimmed and lowercased for comparison; `''` when the feature is unnamed. */
function normalizeFeatureName(feature: NimbleFeatureItem): string {
	return (feature.name ?? '').trim().toLowerCase();
}

/**
 * Whether two features represent the same class feature offered from different places —
 * either linked through a compendium source (one is the other's original, or both descend
 * from the same original) or, when no such link establishes a match, sharing a non-blank
 * name. Two copies customized out of different compendia still cluster on their shared name.
 */
function isSameFeature(a: NimbleFeatureItem, b: NimbleFeatureItem): boolean {
	// `sourceId` is the document's own compendium-source accessor; a blank link means "none",
	// so normalize it to undefined before comparing (two unlinked features must not match).
	const sourceA = a.sourceId || undefined;
	const sourceB = b.sourceId || undefined;

	if (sourceA === b.uuid || sourceB === a.uuid) return true;
	if (sourceA !== undefined && sourceA === sourceB) return true;

	const nameA = normalizeFeatureName(a);
	return nameA !== '' && nameA === normalizeFeatureName(b);
}

/**
 * Groups features that represent the same class feature sourced from more than one place
 * (a customized World Item alongside its Compendium original). Returns one cluster per distinct
 * feature; the common case is a single-entry cluster per feature.
 *
 * Each cluster starts with the earliest-supplied of its members, whose uuid becomes the group's
 * synthetic key (the heading instead comes from the first member that has a name).
 * Members added by a later merge trail the bridging feature rather than sitting in input order —
 * harmless, since candidates are sorted by name for display.
 */
function clusterFeaturesBySource(features: NimbleFeatureItem[]): NimbleFeatureItem[][] {
	const clusters: NimbleFeatureItem[][] = [];

	for (const feature of features) {
		const [primary, ...alsoMatched] = clusters.filter((cluster) =>
			cluster.some((member) => isSameFeature(member, feature)),
		);

		if (!primary) {
			clusters.push([feature]);
			continue;
		}

		// One feature can bridge clusters that don't match each other directly (same name as
		// one, same compendium source as another), so fold every match into the first.
		primary.push(feature);
		for (const merged of alsoMatched) {
			primary.push(...merged);
			clusters.splice(clusters.indexOf(merged), 1);
		}
	}

	return clusters;
}

/** Groups whose features apply without a choice: the ungrouped bucket and level progressions. */
function isAutoGrantGroup(groupName: string): boolean {
	return groupName === 'ungrouped' || groupName.endsWith('-progression');
}

/**
 * Picks which copy of a duplicated feature to offer as the default.
 *
 * A world copy wins: if a GM edited a feature into their world, that edit is the thing they
 * meant to be used. Between two world copies — or when every copy is packaged — the most
 * recently touched one wins, on the same reasoning applied to time instead of place.
 */
function pickRecommendedCopy(candidates: NimbleFeatureItem[]): string | undefined {
	if (candidates.length === 0) return undefined;

	const worldCopies = candidates.filter((feature) => getItemSource(feature.uuid) === 'world');
	const pool = worldCopies.length > 0 ? worldCopies : candidates;

	const modifiedAt = (feature: NimbleFeatureItem) =>
		(feature._stats as { modifiedTime?: number } | undefined)?.modifiedTime ?? 0;

	return pool.reduce((best, feature) => (modifiedAt(feature) > modifiedAt(best) ? feature : best))
		.uuid;
}

/**
 * Gets class features using a pre-built index for instant lookups.
 * Use this after building the index with buildClassFeatureIndex().
 *
 * @param index - The pre-built feature index
 * @param classIdentifier - The class identifier (e.g., "berserker")
 * @param level - The level to get features for
 * @param groupIdentifiers - Optional array of group identifiers to also look up (e.g., ["savage-arsenal"])
 */
export default async function getClassFeaturesFromIndex(
	index: ClassFeatureIndex,
	classIdentifier: string,
	level: number,
	options: GetClassFeaturesOptions = {},
	groupIdentifiers: string[] = [],
): Promise<ClassFeatureResult> {
	const result: ClassFeatureResult = {
		autoGrant: [],
		selectionGroups: new Map(),
		optionFeatures: [],
	};

	if (!classIdentifier || level < 1) {
		return result;
	}

	// Collect entries from the class identifier and all group identifiers
	const allEntries: ClassFeatureIndexEntry[] = [];
	const seenUuids = new Set<string>();

	// Look up by class identifier
	const classLevelMap = index.get(classIdentifier);
	const classEntries = classLevelMap?.get(level) ?? [];
	for (const entry of classEntries) {
		if (!seenUuids.has(entry.uuid)) {
			seenUuids.add(entry.uuid);
			allEntries.push(entry);
		}
	}

	// Look up by each group identifier
	for (const groupId of groupIdentifiers) {
		const groupLevelMap = index.get(groupId);
		const groupEntries = groupLevelMap?.get(level) ?? [];
		for (const entry of groupEntries) {
			if (!seenUuids.has(entry.uuid)) {
				seenUuids.add(entry.uuid);
				allEntries.push(entry);
			}
		}
	}

	if (allEntries.length === 0) {
		return result;
	}

	const ownedUuids = options.ownedFeatureUuids ?? new Set<string>();

	// Fetch the matching feature documents
	const features = await Promise.all(
		allEntries.map((entry) => fromUuid(entry.uuid as `Item.${string}`)),
	);

	// Group by category, keeping the backing index entries in parallel so we can
	// compute per-group selection counts after filtering out owned features.
	// Items are identified by UUID — no name-based deduplication so that distinct
	// world items with the same name each appear as separate entries.
	const entriesByGroup = new Map<string, ClassFeatureIndexEntry[]>();
	const featuresByGroup = new Map<string, NimbleFeatureItem[]>();
	/**
	 * Owned copies held back for the duplicate-source picker. A feature the character already
	 * has is normally dropped, but when a *new* copy of the same feature turns up the player
	 * needs to see the one they own to compare against — so those, and only those, are kept.
	 */
	const ownedByGroup = new Map<string, NimbleFeatureItem[]>();

	for (let i = 0; i < features.length; i++) {
		const feature = features[i];
		if (!feature) continue;

		const featureItem = feature as NimbleFeatureItem;
		const groupName = allEntries[i].group;

		// Option features bypass ownership — they appear at every listed level
		const applicableOptions = (featureItem.system.levelUpOptions ?? []).filter((opt) =>
			isLevelUpOptionApplicable(opt, level),
		);
		if (groupName.endsWith('-progression') && applicableOptions.length > 0) {
			result.optionFeatures.push(featureItem);
			continue;
		}

		// All other features: skip if already owned, except where an owned copy still has a job
		// to do as the comparison baseline in a duplicate-source choice.
		if (ownedUuids.has(allEntries[i].uuid)) {
			if (options.promoteDuplicateSources && isAutoGrantGroup(groupName)) {
				const owned = ownedByGroup.get(groupName) ?? [];
				owned.push(featureItem);
				ownedByGroup.set(groupName, owned);
			}
			continue;
		}

		if (!featuresByGroup.has(groupName)) {
			featuresByGroup.set(groupName, []);
			entriesByGroup.set(groupName, []);
		}

		featuresByGroup.get(groupName)!.push(featureItem);
		entriesByGroup.get(groupName)!.push(allEntries[i]);
	}

	// Collect every selectionGroup already claimed by an optionFeature's applicable options.
	// Those groups are presented inside the option picker and must not also appear as direct
	// selection groups, which would create a duplicate list.
	const groupsCoveredByOptions = new Set<string>();
	for (const optionFeature of result.optionFeatures) {
		for (const opt of optionFeature.system.levelUpOptions ?? []) {
			if (!isLevelUpOptionApplicable(opt, level)) continue;
			for (const g of opt.selectionGroups ?? []) {
				groupsCoveredByOptions.add(g);
			}
		}
	}

	// Categorize groups:
	// - Features with no group ('ungrouped') or a -progression group are auto-grant
	// - Features with an explicit named group (e.g. 'savage-arsenal') are selection groups
	// - Groups already covered by an optionFeature's picker are excluded to avoid duplication
	for (const [groupName, groupFeatures] of featuresByGroup) {
		if (isAutoGrantGroup(groupName)) {
			if (!options.promoteDuplicateSources) {
				result.autoGrant.push(...groupFeatures);
				continue;
			}

			// Auto-grant features normally apply without a choice. But when the same feature is
			// available from more than one source (a customized World Item plus its Compendium
			// original), granting every copy would silently add duplicates. Present each such set
			// as a "choose one or keep all" selection, leaving true singletons auto-granted.
			// Owned copies join the cluster so the player can compare a new copy against the one
			// they already have; they are never re-granted.
			// Owned copies lead: the copy already on the sheet is the baseline every new copy is
			// compared against, and seeding the cluster with it keeps the group key stable as
			// candidates come and go.
			const owned = ownedByGroup.get(groupName) ?? [];
			for (const cluster of clusterFeaturesBySource([...owned, ...groupFeatures])) {
				const offerable = cluster.filter((feature) => !ownedUuids.has(feature.uuid));
				// Every copy is already on the sheet — there is nothing left to offer.
				if (offerable.length === 0) continue;

				if (cluster.length === 1) {
					result.autoGrant.push(offerable[0]);
					continue;
				}

				// Name the group after the first member that has a name — a copy can be unnamed,
				// and an omitted displayName would leave the heading showing the synthetic key.
				const clusterName = cluster.find((feature) => feature.name)?.name;
				const ownedInCluster = cluster.filter((feature) => ownedUuids.has(feature.uuid));
				const recommendedUuid = pickRecommendedCopy(offerable);

				result.selectionGroups.set(`${DUPLICATE_SOURCE_GROUP_PREFIX}${cluster[0].uuid}`, {
					features: cluster,
					// Already holding a copy? Then taking nothing is a valid outcome, and the
					// floor drops to zero. Otherwise exactly one copy must be kept.
					selectionCount: ownedInCluster.length > 0 ? 0 : 1,
					// A higher max than count is what makes this a range: keep one copy or all of
					// them. Only copies not already owned can be granted.
					selectionMax: offerable.length,
					...(ownedInCluster.length > 0
						? { ownedUuids: new Set(ownedInCluster.map((feature) => feature.uuid)) }
						: {}),
					...(recommendedUuid ? { recommendedUuid } : {}),
					...(clusterName ? { displayName: clusterName } : {}),
				});
			}
		} else if (!groupsCoveredByOptions.has(groupName)) {
			const groupEntries = entriesByGroup.get(groupName) ?? [];
			const selectionCount = resolveSelectionCount(groupEntries, level);
			// Badge the candidates a class-defined group lists from more than one source, so the
			// player can tell those apart before choosing. Candidates with no twin are left
			// unbadged — their source is not what the choice turns on. Only the dialogs render
			// badges, so skip the clustering pass entirely when they're off.
			const duplicatedSourceUuids =
				options.promoteDuplicateSources === true
					? new Set(
							clusterFeaturesBySource(groupFeatures)
								.filter((cluster) => cluster.length > 1)
								.flatMap((cluster) => cluster.map((feature) => feature.uuid)),
						)
					: new Set<string>();
			result.selectionGroups.set(groupName, {
				features: groupFeatures,
				selectionCount,
				...(duplicatedSourceUuids.size > 0 ? { duplicatedSourceUuids } : {}),
			});
		}
	}

	return result;
}
