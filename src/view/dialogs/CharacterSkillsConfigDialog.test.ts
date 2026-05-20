import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharacterSkillsConfigDialog from './CharacterSkillsConfigDialog.svelte';

const MINUS = '−';

type SkillData = { points: number; bonus: number; mod: number };
type HistoryEntry = { level: number; skillIncreases: Record<string, number> };

function createSkillsDocument(
	options: {
		skills?: Record<string, SkillData>;
		levelUpHistory?: HistoryEntry[];
		abilities?: Record<string, { baseValue: number; bonus: number; mod: number }>;
		abilityScoreData?: Record<string, unknown>;
	} = {},
) {
	const {
		skills = { might: { points: 3, bonus: 0, mod: 3 }, finesse: { points: 2, bonus: 0, mod: 2 } },
		levelUpHistory = [],
		abilities = {
			strength: { baseValue: 0, bonus: 0, mod: 0 },
			dexterity: { baseValue: 0, bonus: 0, mod: 0 },
		},
		abilityScoreData = {},
	} = options;

	return {
		reactive: {
			system: { skills, levelUpHistory, abilities },
			items: [{ type: 'class', system: { abilityScoreData } }],
		},
		system: { skills, levelUpHistory },
		update: vi.fn().mockResolvedValue(undefined),
	};
}

describe('CharacterSkillsConfigDialog', () => {
	afterEach(() => {
		cleanup();
	});

	describe('skill history', () => {
		it('derives a level-1 entry from current skill points when no level-up history exists', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 3, bonus: 0, mod: 3 },
					finesse: { points: 2, bonus: 0, mod: 2 },
				},
				levelUpHistory: [],
			});

			const { container } = render(CharacterSkillsConfigDialog, { props: { document } });

			await waitFor(() => {
				expect(screen.getByText('Level-Up History')).toBeInTheDocument();
				expect(screen.getByText('Level 1')).toBeInTheDocument();
				// Verify the chip names appear inside the history entry (not just the main skill table)
				const entry = container.querySelector('.nimble-skill-history__entry');
				expect(within(entry as HTMLElement).getByText('Might')).toBeInTheDocument();
				expect(within(entry as HTMLElement).getByText('Finesse')).toBeInTheDocument();
			});
		});

		it('shows level-up history entries alongside the derived level-1 entry', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 5, bonus: 0, mod: 5 },
					finesse: { points: 3, bonus: 0, mod: 3 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 2, finesse: 1 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			await waitFor(() => {
				expect(screen.getByText('Level 1')).toBeInTheDocument();
				expect(screen.getByText('Level 2')).toBeInTheDocument();
			});
		});

		it('omits history entries where all skill changes are zero', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 3, bonus: 0, mod: 3 },
					finesse: { points: 2, bonus: 0, mod: 2 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 0, finesse: 0 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			await waitFor(() => {
				expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
			});
		});

		it('does not render the history section when all skills have 0 points and no history', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 0, bonus: 0, mod: 0 },
					finesse: { points: 0, bonus: 0, mod: 0 },
				},
				levelUpHistory: [],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			await waitFor(() => {
				expect(screen.queryByText('Level-Up History')).not.toBeInTheDocument();
			});
		});
	});

	describe('edit mode', () => {
		it('shows the editing banner with level label and budget when an edit button is clicked', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 5, bonus: 0, mod: 5 },
					finesse: { points: 0, bonus: 0, mod: 0 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 2 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[editButtons.length - 1]);

			await waitFor(() => {
				expect(screen.getByText('Editing Level 2')).toBeInTheDocument();
				expect(screen.getByText('0 of 2 remaining')).toBeInTheDocument();
				expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
				expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
			});
		});

		it('exits edit mode when Cancel is clicked', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 5, bonus: 0, mod: 5 },
					finesse: { points: 0, bonus: 0, mod: 0 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 2 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[editButtons.length - 1]);
			await waitFor(() => expect(screen.getByText('Editing Level 2')).toBeInTheDocument());

			await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

			await waitFor(() => {
				expect(screen.queryByText('Editing Level 2')).not.toBeInTheDocument();
			});
		});

		it('disables Save while points remain unallocated and enables it when budget is spent', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 5, bonus: 0, mod: 5 },
					finesse: { points: 0, bonus: 0, mod: 0 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 2 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[editButtons.length - 1]);

			await waitFor(() => {
				// All 2 points are already in might → remaining=0 → Save enabled
				expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
			});

			// Decrement might: 1 point freed → remaining=1 → Save disabled
			const mightRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Might'));
			await fireEvent.click(within(mightRow!).getByText(MINUS));

			await waitFor(() => {
				expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
				expect(screen.getByText('1 of 2 remaining')).toBeInTheDocument();
			});
		});

		it('adjustChange enforces budget ceiling: + button disabled when no points remain', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 5, bonus: 0, mod: 5 },
					finesse: { points: 0, bonus: 0, mod: 0 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 2 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[editButtons.length - 1]);

			await waitFor(() => {
				// remaining=0 → all + buttons disabled
				const incrementButtons = screen.getAllByText('+');
				for (const btn of incrementButtons) expect(btn).toBeDisabled();
			});

			// Decrement might → remaining=1 → + buttons enabled
			const mightRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Might'));
			await fireEvent.click(within(mightRow!).getByText(MINUS));

			await waitFor(() => {
				const incrementButtons = screen.getAllByText('+');
				expect(incrementButtons.some((btn) => !(btn as HTMLButtonElement).disabled)).toBe(true);
			});
		});
	});

	describe('saveEdits', () => {
		it('calls document.update with redistributed skill points and updated levelUpHistory (level > 1)', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 5, bonus: 0, mod: 5 },
					finesse: { points: 3, bonus: 0, mod: 3 },
				},
				levelUpHistory: [{ level: 2, skillIncreases: { might: 2, finesse: 1 } }],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[editButtons.length - 1]);
			await waitFor(() => expect(screen.getByText('Editing Level 2')).toBeInTheDocument());

			// Move 1 point from might → finesse: decrement might, then increment finesse
			const mightRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Might'));
			await fireEvent.click(within(mightRow!).getByText(MINUS));
			await waitFor(() => expect(screen.getByText('1 of 3 remaining')).toBeInTheDocument());

			const finesseRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Finesse'));
			await fireEvent.click(within(finesseRow!).getByText('+'));
			await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled());

			await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

			await waitFor(() => {
				expect(document.update).toHaveBeenCalledWith(
					expect.objectContaining({
						'system.skills.might.points': 4, // 5 − 1
						'system.skills.finesse.points': 4, // 3 + 1
						'system.levelUpHistory': [{ level: 2, skillIncreases: { might: 1, finesse: 2 } }],
					}),
				);
			});
		});

		it('calls document.update with skill changes but no levelUpHistory key for level 1', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 3, bonus: 0, mod: 3 },
					finesse: { points: 2, bonus: 0, mod: 2 },
				},
				levelUpHistory: [],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[0]); // only level 1 exists

			await waitFor(() => {
				expect(screen.getByText('Editing Level 1')).toBeInTheDocument();
				expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
			});

			// Move 1 point from might → finesse
			const mightRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Might'));
			await fireEvent.click(within(mightRow!).getByText(MINUS));
			await waitFor(() => expect(screen.getByText('1 of 5 remaining')).toBeInTheDocument());

			const finesseRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Finesse'));
			await fireEvent.click(within(finesseRow!).getByText('+'));
			await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled());

			await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

			await waitFor(() => {
				const callArg = (document.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(callArg).toMatchObject({
					'system.skills.might.points': 2, // 3 − 1
					'system.skills.finesse.points': 3, // 2 + 1
				});
				expect(callArg).not.toHaveProperty('system.levelUpHistory');
			});
		});

		it('does not call document.update when nothing changed at level 1', async () => {
			const document = createSkillsDocument({
				skills: {
					might: { points: 3, bonus: 0, mod: 3 },
					finesse: { points: 0, bonus: 0, mod: 0 },
				},
				levelUpHistory: [],
			});

			render(CharacterSkillsConfigDialog, { props: { document } });

			const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
			await fireEvent.click(editButtons[0]);

			await waitFor(() => {
				expect(screen.getByText('Editing Level 1')).toBeInTheDocument();
				// Budget=3, all in might, remaining=0 → Save immediately enabled
				expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
			});

			await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

			await waitFor(() => {
				expect(document.update).not.toHaveBeenCalled();
			});
		});
	});
});
