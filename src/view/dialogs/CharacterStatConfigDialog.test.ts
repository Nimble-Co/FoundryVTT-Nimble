import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharacterStatConfigDialog from './CharacterStatConfigDialog.svelte';

function createStatConfigDocument(
	options: {
		classLevel?: number;
		abilityScoreData?: Record<string, unknown>;
		keyAbilityScores?: string[];
		ASI?: Record<string, number>;
		totalASI?: Record<string, number>;
	} = {},
) {
	const {
		classLevel = 1,
		abilityScoreData = { 1: { statIncreaseType: 'primary', value: '' } },
		keyAbilityScores = ['strength', 'dexterity'],
		ASI = {},
		totalASI = {},
	} = options;

	const classItem = {
		type: 'class',
		_id: 'class-id',
		system: {
			classLevel,
			abilityScoreData,
			keyAbilityScores,
			savingThrows: { advantage: null, disadvantage: null },
		},
		identifier: 'warrior',
		ASI,
		totalASI,
	};

	const abilities = {
		strength: { baseValue: 0, value: 0, mod: 0 },
		dexterity: { baseValue: 0, value: 0, mod: 0 },
		intelligence: { baseValue: 0, value: 0, mod: 0 },
		will: { baseValue: 0, value: 0, mod: 0 },
	};

	return {
		reactive: {
			items: [classItem],
			system: { abilities },
		},
		system: { abilities },
		update: vi.fn().mockResolvedValue(undefined),
		updateItem: vi.fn().mockResolvedValue(undefined),
	};
}

describe('CharacterStatConfigDialog', () => {
	afterEach(() => {
		cleanup();
	});

	describe('stat increase cap', () => {
		it('disables toggle button for an ability when totalASI reaches 5', async () => {
			const document = createStatConfigDocument({ totalASI: { strength: 5 } });

			render(CharacterStatConfigDialog, { props: { document } });

			await waitFor(() => {
				const atMaxButtons = screen.getAllByRole('button', {
					name: 'Stat is at its maximum (+5 from increases)',
				});
				expect(atMaxButtons.length).toBeGreaterThan(0);
				for (const btn of atMaxButtons) expect(btn).toBeDisabled();
			});
		});

		it('does not disable toggle buttons when totalASI is below 5', async () => {
			const document = createStatConfigDocument({ totalASI: { strength: 4 } });

			render(CharacterStatConfigDialog, { props: { document } });

			await waitFor(() => {
				const toggleButtons = screen.getAllByRole('button', {
					name: 'Toggle Stat Increase',
				});
				expect(toggleButtons.length).toBeGreaterThan(0);
				for (const btn of toggleButtons) expect(btn).not.toBeDisabled();
			});
		});

		it('keeps the active toggle enabled so an already-selected stat can be deselected', async () => {
			// strength is at cap AND selected — dexterity is also at cap but inactive
			const document = createStatConfigDocument({
				abilityScoreData: { 1: { statIncreaseType: 'primary', value: 'strength' } },
				totalASI: { strength: 5, dexterity: 5 },
			});

			render(CharacterStatConfigDialog, { props: { document } });

			await waitFor(() => {
				// Only the active strength toggle should be enabled (deselection allowed)
				const enabledToggle = screen.getByRole('button', { name: 'Toggle Stat Increase' });
				expect(enabledToggle).not.toBeDisabled();

				// Dexterity is at cap and inactive — it should be disabled
				const atMaxButtons = screen.getAllByRole('button', {
					name: 'Stat is at its maximum (+5 from increases)',
				});
				expect(atMaxButtons.length).toBeGreaterThan(0);
			});
		});
	});
});
