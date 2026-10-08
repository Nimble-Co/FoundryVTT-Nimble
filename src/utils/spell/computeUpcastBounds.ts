export interface UpcastBoundsInput {
	spellTier: number;
	/** Absent on actors with no mana pool or tier ladder, such as NPCs. */
	resources?: {
		mana?: { current?: number | null } | null;
		highestUnlockedSpellTier?: number | null;
	} | null;
	/** When false, available mana neither bounds the slider nor blocks the cast. */
	enforceManaCost: boolean;
	/**
	 * When true, the cost is the same at every tier, so a higher tier is only
	 * reached when a class pins the cast to it.
	 */
	flatCost?: boolean;
	/** The tier a class pins the cast to, or null when the caster chooses. */
	pinnedCastTier?: number | null;
}

export interface UpcastBounds {
	currentMana: number;
	/** Most mana the tier ladder allows in one cast. */
	maxTier: number;
	/** Most mana the cast dialog offers, after the mana clamp if it applies. */
	maxMana: number;
}

/**
 * The one place that decides how far a spell can be upcast. The cast dialog
 * and the activation manager both use it, so the two cannot disagree.
 */
export function computeUpcastBounds({
	spellTier,
	resources,
	enforceManaCost,
	flatCost = false,
	pinnedCastTier = null,
}: UpcastBoundsInput): UpcastBounds {
	const currentMana = resources?.mana?.current ?? 0;
	const ladderTier = resources?.highestUnlockedSpellTier ?? spellTier;
	const maxTier = flatCost && pinnedCastTier === null ? spellTier : ladderTier;
	const maxMana = enforceManaCost ? Math.min(currentMana, maxTier) : maxTier;

	return { currentMana, maxTier, maxMana };
}
