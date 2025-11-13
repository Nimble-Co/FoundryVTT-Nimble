import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { createMockCharacterDocument, createMockDialog } from '../../../tests/fixtures/index.js';
import CharacterLevelUpDialog from './CharacterLevelUpDialog.svelte';

describe('CharacterLevelUpDialog Component', () => {
	describe('Ability Score Increase Causing Skill Over Max', () => {
		it('should disable submit when selecting strength pushes might over 12', async () => {
			const document = createMockCharacterDocument();
			const dialog = createMockDialog();

			const { container } = render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// Initial state: Submit should be disabled (no ability selected, no skill points assigned)
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).toBeDisabled();
			});

			// Step 1: Select Strength as ability score increase (this should push Might from 12 to 13)
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			// After selecting Strength: Submit should still be disabled (no skill points assigned yet)
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).toBeDisabled();
			});

			// Verify that Might has been increased from 12 to 13
			// The ability score increase should add +1 to Might's total
			await waitFor(() => {
				const mightSkillName = screen.getByText('Might', { selector: 'th' });
				const mightRow = mightSkillName.closest('tr');
				expect(mightRow).toBeTruthy();

				// Get all cells in the Might row
				// Columns: Ability Mod (0), Skill Bonus (1), Skill Points (2), Total (3)
				const cells = mightRow!.querySelectorAll('td');
				expect(cells.length).toBe(4);

				// Verify Ability Mod increased (should be 4: 3 base + 1 from Strength)
				const abilityModCell = cells[0];
				const abilityModText = abilityModCell.textContent?.trim() || '';
				const abilityMod = parseInt(abilityModText, 10);
				expect(abilityMod).toBe(4); // Base mod is 3, +1 from Strength = 4

				// Verify Total increased to 13 (12 base + 1 from Strength ability increase)
				const totalCell = cells[3]; // Last cell is Total
				const totalText = totalCell.textContent?.trim() || '';

				// The total should show 13, or might show "13 (+1)" if there's a delta indicator
				// Extract just the main number (before any parentheses)
				const mainTotal = totalText.split('(')[0].trim();
				const total = parseInt(mainTotal, 10);
				expect(total).toBe(13);
			});

			// Step 2: Add 1 skill point to Finesse
			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr');
			expect(finesseRow).toBeTruthy();

			// Find the increment button for Finesse within its row
			const finesseIncrementBtn = within(finesseRow!).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			// Step 3: After adding skill point to Finesse, submit should be disabled
			// because Might is now 13 (12 base + 1 from Strength ability increase)
			// CRITICAL ASSERTION: The button MUST be disabled when a skill exceeds 12
			await waitFor(
				() => {
					const submitButton = screen.getByText('Submit') as HTMLButtonElement;
					expect(submitButton).toBeDisabled();
					expect(submitButton).toHaveAttribute(
						'data-tooltip',
						'One or more skills would exceed the 12 point cap. Please reallocate skill points before submitting.',
					);
					expect(submitButton).toHaveAttribute(
						'aria-label',
						'A skill would exceed the 12 point cap',
					);
				},
				{ timeout: 3000 },
			);

			// Verify Might row is highlighted as over-cap
			const mightRow = container.querySelector('.nimble-skill-over-cap');
			expect(mightRow).toBeTruthy();

			// Verify Might is actually showing as 13 in the UI
			// (12 base + 1 from Strength ability increase)
			const mightSkillName = screen.getByText('Might', { selector: 'th' });
			const mightRowElement = mightSkillName.closest('tr');
			expect(mightRowElement).toBeTruthy();
			// The total should show 13 (or we should see it's over cap)
			// This verifies the calculation is actually happening

			// Final verification: Double-check the button is still disabled
			const finalSubmitButton = screen.getByText('Submit');
			expect(finalSubmitButton).toBeDisabled();
		});

		it('should enable submit when skill allocation is valid', async () => {
			// Create document where Might is at 11, so selecting Strength brings it to 12 (valid)
			const document = createMockCharacterDocument({
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
							might: { points: 11, bonus: 0, mod: 11 },
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
			});
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// Select Strength (brings Might to 12, which is valid)
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			// Add 1 skill point to Finesse
			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr')!;
			const finesseIncrementBtn = within(finesseRow).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			// Submit should now be enabled
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).not.toBeDisabled();
			});
		});

		it('should re-enable submit when user changes ability selection to resolve over-max', async () => {
			const document = createMockCharacterDocument();
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// 1. Select Strength (pushes Might to 13 - invalid)
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			// 2. Add skill point to Finesse
			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr')!;
			const finesseIncrementBtn = within(finesseRow).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			// Verify it's disabled
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).toBeDisabled();
			});

			// 3. Change selection to Dexterity (doesn't affect Might)
			const dexterityLabel = screen.getByText('Dexterity', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(dexterityLabel);

			// 4. Add another skill point (since changing ability resets skill points)
			const finesseSkillName2 = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow2 = finesseSkillName2.closest('tr')!;
			const finesseIncrementBtn2 = within(finesseRow2).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn2);

			// Submit should now be enabled
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).not.toBeDisabled();
			});
		});
	});

	describe('Submit Button States', () => {
		it('should be disabled when no ability score selected', async () => {
			const document = createMockCharacterDocument();
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// Add skill point but don't select ability
			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr')!;
			const finesseIncrementBtn = within(finesseRow).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			const submitButton = screen.getByText('Submit');
			expect(submitButton).toBeDisabled();
			expect(submitButton).toHaveAttribute(
				'aria-label',
				'Complete all selections before submitting',
			);
		});

		it('should be disabled when no skill points assigned', async () => {
			const document = createMockCharacterDocument();
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// Select ability but don't assign skill points
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).toBeDisabled();
			});
		});

		it('should be enabled when all requirements met', async () => {
			const document = createMockCharacterDocument({
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
							might: { points: 10, bonus: 0, mod: 10 },
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
			});
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// Select ability
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			// Assign skill point
			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr')!;
			const finesseIncrementBtn = within(finesseRow).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			// Should be enabled
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).not.toBeDisabled();
				expect(submitButton).toHaveAttribute('aria-label', 'Submit');
			});
		});
	});

	describe('Skill Point Reset on Ability Change', () => {
		it('should reset skill points when ability selection changes', async () => {
			const document = createMockCharacterDocument({
				reactive: {
					system: {
						abilities: {
							strength: { value: 10, mod: 3 },
							dexterity: { value: 10, mod: 2 },
							intelligence: { value: 10, mod: 1 },
							will: { value: 10, mod: 1 },
						},
						skills: {
							might: { points: 10, bonus: 0, mod: 10 },
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
			});
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// 1. Select Strength and add skill point
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr')!;
			const finesseIncrementBtn = within(finesseRow).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			// Verify it's complete
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).not.toBeDisabled();
			});

			// 2. Change to Dexterity - skill points should reset
			const dexterityLabel = screen.getByText('Dexterity', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(dexterityLabel);

			// Submit should now be disabled (skill points were reset)
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).toBeDisabled();
			});
		});
	});

	describe('Level 3 Subclass Selection', () => {
		it('should require subclass selection at level 3', async () => {
			const document = createMockCharacterDocument({
				classes: {
					warrior: {
						system: {
							classLevel: 2, // Leveling to 3
							abilityScoreData: {
								3: { statIncreaseType: 'primary' },
							},
							keyAbilityScores: ['strength', 'dexterity'],
						},
						identifier: 'warrior',
					},
				},
			});
			const dialog = createMockDialog();

			render(CharacterLevelUpDialog, {
				props: {
					document,
					dialog,
				},
			});

			// Select ability and skill point
			const strengthLabel = screen.getByText('Strength', {
				selector: '.nimble-stat-selection__option',
			});
			await fireEvent.click(strengthLabel);

			const finesseSkillName = screen.getByText('Finesse', { selector: 'th' });
			const finesseRow = finesseSkillName.closest('tr')!;
			const finesseIncrementBtn = within(finesseRow).getByRole('button', {
				name: /increment skill points/i,
			});
			await fireEvent.click(finesseIncrementBtn);

			// Submit should still be disabled (need subclass)
			await waitFor(() => {
				const submitButton = screen.getByText('Submit');
				expect(submitButton).toBeDisabled();
			});

			// Verify subclass section is visible
			expect(screen.getByText(/subclass/i)).toBeTruthy();
		});
	});
});
