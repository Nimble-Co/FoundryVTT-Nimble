import type { NimbleCharacter } from '#documents/actor/character.ts';

export function getHighestSpellTier(actor: NimbleCharacter): number {
	const level = actor.levels.character;
	const tiers = [1, 4, 6, 8, 10, 12, 14, 16, 18];

	for (let index = tiers.length - 1; index >= 0; index -= 1) {
		if (level >= tiers[index]) return index + 1;
	}

	return 0;
}
