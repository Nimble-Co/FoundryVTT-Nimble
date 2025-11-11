/**
 * Test fixtures for Character-related data
 * These provide realistic test data for character documents
 */

/**
 * Creates a mock character document for testing
 * @param overrides - Object to override default values
 * @returns A mock character document with the specified overrides applied
 */
export function createMockCharacterDocument(overrides = {}) {
	return {
		id: 'test-character-id',
		classes: {
			warrior: {
				system: {
					classLevel: 1,
					abilityScoreData: {
						2: { statIncreaseType: 'primary' },
						4: { statIncreaseType: 'primary' },
						6: { statIncreaseType: 'secondary' },
						8: { statIncreaseType: 'primary' },
						10: { statIncreaseType: 'capstone' },
					},
					keyAbilityScores: ['strength', 'dexterity'],
				},
				identifier: 'warrior',
			},
		},
		system: {
			abilities: {
				strength: { value: 10, mod: 3 },
				dexterity: { value: 10, mod: 2 },
				intelligence: { value: 10, mod: 1 },
				will: { value: 10, mod: 1 },
			},
		},
		reactive: {
			system: {
				abilities: {
					strength: { value: 10, mod: 3 },
					dexterity: { value: 10, mod: 2 },
					intelligence: { value: 10, mod: 1 },
					will: { value: 10, mod: 1 },
				},
				skills: {
					might: { points: 12, bonus: 0, mod: 12 },
					finesse: { points: 5, bonus: 0, mod: 7 },
					arcana: { points: 3, bonus: 0, mod: 4 },
					examination: { points: 2, bonus: 0, mod: 3 },
					influence: { points: 1, bonus: 0, mod: 2 },
					insight: { points: 1, bonus: 0, mod: 2 },
					lore: { points: 0, bonus: 0, mod: 1 },
					naturecraft: { points: 0, bonus: 0, mod: 1 },
					perception: { points: 1, bonus: 0, mod: 2 },
					stealth: { points: 0, bonus: 0, mod: 2 },
				},
			},
		},
		...overrides,
	};
}
