import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock CONFIG.NIMBLE
(globalThis as any).CONFIG = {
	NIMBLE: {
		defaultSkillAbilities: {
			arcana: 'intelligence',
			examination: 'intelligence',
			finesse: 'dexterity',
			influence: 'will',
			insight: 'will',
			might: 'strength',
			lore: 'intelligence',
			naturecraft: 'will',
			perception: 'will',
			stealth: 'dexterity',
		},
		skills: {
			arcana: 'Arcana',
			examination: 'Examination',
			finesse: 'Finesse',
			influence: 'Influence',
			insight: 'Insight',
			might: 'Might',
			lore: 'Lore',
			naturecraft: 'Naturecraft',
			perception: 'Perception',
			stealth: 'Stealth',
		},
		abilityScores: {
			strength: 'Strength',
			dexterity: 'Dexterity',
			intelligence: 'Intelligence',
			will: 'Will',
		},
		abilityScoreAbbreviations: {
			strength: 'STR',
			dexterity: 'DEX',
			intelligence: 'INT',
			will: 'WIL',
		},
	},
};

// Mock Foundry game object
(globalThis as any).game = {
	packs: {
		*[Symbol.iterator]() {
			// Empty iterator - no compendium packs in tests
		},
	},
	items: {
		*[Symbol.iterator]() {
			// Yield mock subclasses for testing
			yield {
				type: 'subclass',
				name: 'Path of the Mountainheart',
				system: {
					parentClass: 'warrior',
					identifier: 'path-of-the-mountainheart',
				},
			};
			yield {
				type: 'subclass',
				name: 'Path of the Storm',
				system: {
					parentClass: 'warrior',
					identifier: 'path-of-the-storm',
				},
			};
		},
	},
};

// Cleanup after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
