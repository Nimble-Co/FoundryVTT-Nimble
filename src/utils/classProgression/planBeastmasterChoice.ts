import isLevelUpOptionApplicable from '#utils/optionSwap/isLevelUpOptionApplicable.ts';

/** A feature reduced to the fields the Beastmaster choice reads. */
export interface ChoiceFeature {
	uuid?: string | null;
	system?: {
		subclass?: boolean;
		levelUpOptions?: ChoiceOption[];
	};
}

interface ChoiceOption {
	id: string;
	applyAtLevels?: number[];
	rules?: ReadonlyArray<Record<string, unknown>>;
}

/** A Thrill of the Hunt pick, with the level that granted it. */
export interface TrackedPick {
	id: string;
	level: number;
}

const SWAP_SUFFIX = '-swap';
const RELEASE_COUNT = 2;

/**
 * Splits this level's subclass features into the existing option picker and the
 * auto-grant list, and names the Thrill of the Hunt picks a companion swap releases.
 *
 * A subclass feature with a level-up option is a choice, not an automatic grant.
 * Items that those options grant (a size's features) stay off the auto-grant list
 * at every later level, including ones where the option itself no longer applies,
 * so a size the player did not choose never arrives on its own. A swap option
 * releases the earliest Thrill of the Hunt picks. Leaving them is the other option.
 */
export default function planBeastmasterChoice<T extends ChoiceFeature>(input: {
	incoming: readonly T[];
	owned: readonly ChoiceFeature[];
	level: number;
	optionId: string | null;
	thrillPicks: readonly TrackedPick[];
}): { optionFeatures: T[]; autoGrant: T[]; release: TrackedPick[] } {
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

	return {
		optionFeatures,
		autoGrant,
		release: picksToRelease(input.optionId, sources, input.thrillPicks),
	};
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

function picksToRelease(
	optionId: string | null,
	sources: readonly ChoiceFeature[],
	picks: readonly TrackedPick[],
): TrackedPick[] {
	if (!optionId || !isSwapOption(optionId, sources)) return [];
	return [...picks]
		.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
		.slice(0, RELEASE_COUNT);
}

function isSwapOption(optionId: string, sources: readonly ChoiceFeature[]): boolean {
	if (!optionId.endsWith(SWAP_SUFFIX)) return false;
	for (const feature of sources) {
		for (const option of feature.system?.levelUpOptions ?? []) {
			if (option.id !== optionId) continue;
			if ((option.rules ?? []).some((rule) => grantUuid(rule))) return true;
		}
	}
	return false;
}
