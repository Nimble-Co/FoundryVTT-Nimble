export interface UpcastBoundsInput {
	spellTier: number;
	/** Absent on actors with no mana pool or tier ladder, such as NPCs. */
	resources?: {
		mana?: { current?: number | null } | null;
		highestUnlockedSpellTier?: number | null;
	} | null;
	/** When false, available mana neither bounds the slider nor blocks the cast. */
	enforceManaCost: boolean;
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
 * bounds its slider with this, and the activation manager validates against
 * the same numbers, so the two cannot disagree.
 *
 * An actor with no tier ladder casts at the spell's own tier and cannot
 * upcast at all.
 */
export function computeUpcastBounds({
	spellTier,
	resources,
	enforceManaCost,
}: UpcastBoundsInput): UpcastBounds {
	const currentMana = resources?.mana?.current ?? 0;
	const maxTier = resources?.highestUnlockedSpellTier ?? spellTier;
	const maxMana = enforceManaCost ? Math.min(currentMana, maxTier) : maxTier;

	return { currentMana, maxTier, maxMana };
}
