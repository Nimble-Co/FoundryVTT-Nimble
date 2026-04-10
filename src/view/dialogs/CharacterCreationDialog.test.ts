import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CharacterCreationDialog from './CharacterCreationDialog.svelte';

function createProps(overrides: Record<string, unknown> = {}) {
	return {
		ancestryOptions: Promise.resolve({ core: [], exotic: [] }),
		backgroundOptions: Promise.resolve([]),
		bonusLanguageOptions: [],
		classFeatureIndex: Promise.resolve(new Map()),
		classOptions: Promise.resolve([]),
		dialog: {
			id: 'test-dialog',
			submitCharacterCreation: vi.fn(),
		},
		spellIndex: Promise.resolve(new Map()),
		statArrayOptions: [],
		...overrides,
	};
}

describe('CharacterCreationDialog', () => {
	describe('name validation', () => {
		it('shows a warning and does not submit when name is empty', async () => {
			const props = createProps();
			render(CharacterCreationDialog, { props });

			await fireEvent.click(screen.getByText('Create Character'));

			expect(ui.notifications?.warn).toHaveBeenCalledWith(
				'Please enter a name for your character before creating.',
			);
			expect(props.dialog.submitCharacterCreation).not.toHaveBeenCalled();
		});

		it('shows a warning and does not submit when name is only whitespace', async () => {
			const props = createProps();
			render(CharacterCreationDialog, { props });

			const nameInput = screen.getByPlaceholderText('New Character');
			await fireEvent.input(nameInput, { target: { value: '   ' } });
			await fireEvent.click(screen.getByText('Create Character'));

			expect(ui.notifications?.warn).toHaveBeenCalledWith(
				'Please enter a name for your character before creating.',
			);
			expect(props.dialog.submitCharacterCreation).not.toHaveBeenCalled();
		});
	});
});
