import { describe, expect, it } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { getHighestSpellTier } from './getHighestSpellTier.js';

function createActor(level: number): NimbleCharacter {
	return {
		levels: { character: level, classes: {} },
	} as unknown as NimbleCharacter;
}

describe('getHighestSpellTier', () => {
	it.each([
		[0, 0],
		[1, 1],
		[3, 1],
		[4, 2],
		[5, 2],
		[6, 3],
		[7, 3],
		[8, 4],
		[9, 4],
		[10, 5],
		[11, 5],
		[12, 6],
		[13, 6],
		[14, 7],
		[15, 7],
		[16, 8],
		[17, 8],
		[18, 9],
		[20, 9],
	])('returns tier %i for level %i', (level, expectedTier) => {
		const actor = createActor(level);
		expect(getHighestSpellTier(actor)).toBe(expectedTier);
	});
});
