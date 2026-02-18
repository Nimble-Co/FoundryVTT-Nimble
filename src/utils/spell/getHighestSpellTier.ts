/** Minimal interface for actors that have character levels */
interface ActorWithLevels {
	levels: { character: number };
}

/**
 * Calculate the highest spell tier a character can access based on their level.
 * @param actor - An actor with character level information
 * @returns The highest spell tier (1-9) the character can access, or 0 if below level 1
 */
export function getHighestSpellTier(actor: ActorWithLevels): number {
	const level = actor.levels.character;
	const tiers = [1, 4, 6, 8, 10, 12, 14, 16, 18];

	for (let index = tiers.length - 1; index >= 0; index -= 1) {
		if (level >= tiers[index]) return index + 1;
	}

	return 0;
}
