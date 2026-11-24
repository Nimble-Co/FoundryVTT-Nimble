import isLevelUpOptionApplicable from '#utils/optionSwap/isLevelUpOptionApplicable.ts';

/** A feature reduced to the fields the subclass option plan reads. */
export interface ChoiceFeature {
	id?: string | null;
	uuid?: string | null;
	system?: {
		subclass?: boolean;
		group?: string;
		levelUpOptions?: ChoiceOption[];
	};
	_stats?: { compendiumSource?: string | null };
}

interface ChoiceOption {
	id: string;
	applyAtLevels?: number[];
	rules?: ReadonlyArray<Record<string, unknown>>;
	/** Owned features of `group` the option gives up, earliest first. */
	releases?: { group: string; count: number };
}

/** A feature a level removed: the compendium uuid to restore it from, and the level that granted it. */
export interface ReleasedFeature {
	uuid: string;
	level: number;
}

/** An owned feature a chosen option gives up. `uuid` is empty when it cannot be restored. */
export interface ReleasedPick extends ReleasedFeature {
	id: string;
}

interface HistoryEntry {
	level: number;
	grantedFeatureIds?: string[];
}

/**
 * Splits this level's subclass features into the option picker and the
 * auto-grant list, and names the owned features the chosen options release.
 *
 * A subclass feature with a level-up option is a choice, not an automatic grant.
 * Items that those options grant stay off the auto-grant list at every later
 * level, including ones where the option itself no longer applies, so an option
 * the player did not choose never arrives on its own.
 */
export default function planSubclassOptions<T extends ChoiceFeature>(input: {
	incoming: readonly T[];
	owned: readonly ChoiceFeature[];
	level: number;
	optionIds: readonly string[];
	history: readonly HistoryEntry[];
}): { optionFeatures: T[]; autoGrant: T[]; release: ReleasedPick[] } {
	const sources = choiceSources(input.incoming, input.owned);
	const granted = grantedUuids(sources);
	const optionFeatures: T[] = [];
	const autoGrant: T[] = [];

	for (const feature of input.incoming) {
		const applicable = (feature.system?.levelUpOptions ?? []).filter((option) =>
			isLevelUpOptionApplicable({ applyAtLevels: option.applyAtLevels ?? [] }, input.level),
		);
		if (applicable.length > 0) {
			optionFeatures.push(feature);
			continue;
		}
		if (feature.uuid && granted.has(feature.uuid)) continue;
		autoGrant.push(feature);
	}

	const release = chosenOptions(sources, input.optionIds).flatMap((option) =>
		option.releases?.group && option.releases.count > 0
			? earliestOfGroup(input.owned, input.history, option.releases)
			: [],
	);
	return { optionFeatures, autoGrant, release };
}

/** Subclass features that carry the choice, incoming first, each object once. */
function choiceSources(
	incoming: readonly ChoiceFeature[],
	owned: readonly ChoiceFeature[],
): ChoiceFeature[] {
	const sources: ChoiceFeature[] = [];
	for (const feature of [...incoming, ...owned]) {
		if (feature.system?.subclass !== true) continue;
		if (sources.includes(feature)) continue;
		sources.push(feature);
	}
	return sources;
}

function chosenOptions(
	sources: readonly ChoiceFeature[],
	optionIds: readonly string[],
): ChoiceOption[] {
	return sources.flatMap((feature) =>
		(feature.system?.levelUpOptions ?? []).filter((option) => optionIds.includes(option.id)),
	);
}

function grantUuid(rule: Record<string, unknown>): string | null {
	if (rule.type !== 'grantItem' || typeof rule.uuid !== 'string' || rule.uuid.length === 0) {
		return null;
	}
	return rule.uuid;
}

function grantedUuids(sources: readonly ChoiceFeature[]): Set<string> {
	const uuids = new Set<string>();
	for (const feature of sources) {
		for (const option of feature.system?.levelUpOptions ?? []) {
			for (const rule of option.rules ?? []) {
				const uuid = grantUuid(rule);
				if (uuid) uuids.add(uuid);
			}
		}
	}
	return uuids;
}

/** The owned features of a group, by the level that granted them, then by id. */
function earliestOfGroup(
	owned: readonly ChoiceFeature[],
	history: readonly HistoryEntry[],
	releases: { group: string; count: number },
): ReleasedPick[] {
	const picks: ReleasedPick[] = [];
	for (const feature of owned) {
		const id = feature.id;
		if (!id || feature.system?.group !== releases.group) continue;
		const entry = history.find((row) => (row.grantedFeatureIds ?? []).includes(id));
		picks.push({
			id,
			uuid: feature._stats?.compendiumSource ?? '',
			level: entry?.level ?? Number.MAX_SAFE_INTEGER,
		});
	}
	return picks
		.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
		.slice(0, releases.count);
}
