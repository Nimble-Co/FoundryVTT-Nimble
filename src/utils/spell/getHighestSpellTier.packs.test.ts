import { describe, expect, it } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { loadAllFeatureDocs } from '../../../tests/fixtures/classProgression.js';
import { getHighestSpellTier } from './getHighestSpellTier.js';

type RawRule = { type?: string; [key: string]: unknown };

function createActorFromPackFeatures(
	classIdentifier: string,
	level: number,
	{ subclass }: { subclass?: string } = {},
): NimbleCharacter {
	const items = loadAllFeatureDocs()
		.filter((feature) => feature.system.class === classIdentifier)
		.filter((feature) => {
			if (!feature.system.subclass) return true;
			return subclass !== undefined && feature.system.group === subclass;
		})
		.map((feature) => ({
			type: 'feature',
			rules: new Map(
				((feature.system.rules ?? []) as RawRule[]).map((rule, index) => [String(index), rule]),
			),
		}));

	return {
		levels: { character: level, classes: {} },
		items: { contents: items },
	} as unknown as NimbleCharacter;
}

// The authored class ladders these assert against are the source of truth the
// deleted global level table contradicted, including at the first rung: every
// caster's first tiered grant arrives at level 2 or later, never level 1.
describe('getHighestSpellTier against authored pack ladders', () => {
	it.each([
		[1, 0],
		[2, 1],
		[3, 1],
		[4, 2],
		[6, 3],
		[8, 4],
		[10, 5],
		[12, 6],
		[14, 7],
		[16, 8],
		[18, 9],
		[20, 9],
	])('unlocks tier %2$i for a level %1$i Mage', (level, expectedTier) => {
		expect(getHighestSpellTier(createActorFromPackFeatures('mage', level))).toBe(expectedTier);
	});

	it.each([
		[1, 0],
		[2, 1],
		[4, 1],
		[5, 2],
		[7, 3],
		[9, 3],
		[10, 4],
		[13, 5],
		[16, 6],
		[19, 7],
		[20, 7],
	])('unlocks tier %2$i for a level %1$i Shadowmancer', (level, expectedTier) => {
		expect(getHighestSpellTier(createActorFromPackFeatures('shadowmancer', level))).toBe(
			expectedTier,
		);
	});

	it('derives the same Shadowmancer ladder with a subclass attached', () => {
		const actor = createActorFromPackFeatures('shadowmancer', 13, {
			subclass: 'pact-of-the-red-dragon',
		});
		expect(getHighestSpellTier(actor)).toBe(5);
	});

	it('treats a Berserker as having no unlocked tier at any level', () => {
		for (const level of [1, 5, 10, 15, 20]) {
			expect(getHighestSpellTier(createActorFromPackFeatures('berserker', level))).toBe(0);
		}
	});
});
