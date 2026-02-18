/**
 * Calculate the highest spell tier a character can access based on their level.
 * @param characterLevel - The character's current level
 * @returns The highest spell tier (1-9) the character can access, or 0 if below level 1
 */
export function getHighestSpellTier(characterLevel: number): number {
	const tiers = [1, 4, 6, 8, 10, 12, 14, 16, 18];

	for (let index = tiers.length - 1; index >= 0; index -= 1) {
		if (characterLevel >= tiers[index]) return index + 1;
	}

	return 0;
}
