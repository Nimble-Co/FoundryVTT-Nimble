/// <reference types="vitest/globals" />

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import PlayerCharacterCoreTabTestHarness from './PlayerCharacterCoreTab.testHarness.svelte';

function createCoreTabActor() {
	return {
		id: 'character-core-tab-actor',
		name: 'Initiative Tester',
		reactive: {
			flags: {
				nimble: {
					editingEnabled: false,
					compactSkillsView: true,
					showPassiveSkillScores: false,
				},
			},
			system: {
				abilities: {
					strength: { mod: 3 },
					dexterity: { mod: 2 },
					intelligence: { mod: 1 },
					will: { mod: 1 },
				},
				skills: {
					might: { mod: 5 },
				},
				savingThrows: {
					fortitude: { mod: 4, defaultRollMode: 0 },
					reflex: { mod: 2, defaultRollMode: 0 },
					will: { mod: 1, defaultRollMode: 0 },
				},
				attributes: {
					initiative: { mod: 2 },
					armor: { value: 14 },
					movement: {
						walk: 6,
						burrow: 0,
						climb: 0,
						fly: 0,
						swim: 0,
					},
				},
				proficiencies: {
					armor: [],
					languages: [],
					weapons: [],
				},
			},
		},
		_getInitiativeFormula: vi.fn().mockReturnValue('1d20 + 2'),
		getRollData: vi.fn().mockReturnValue({}),
		rollInitiativeToChat: vi.fn(),
		rollAbilityCheckToChat: vi.fn(),
		configureAbilityScores: vi.fn(),
		rollSavingThrowToChat: vi.fn(),
		configureSavingThrows: vi.fn(),
		rollSkillCheckToChat: vi.fn(),
		configureSkills: vi.fn(),
		configureMovement: vi.fn(),
		configureLanguageProficiencies: vi.fn(),
		configureArmorProficiencies: vi.fn(),
		configureWeaponProficiencies: vi.fn(),
	};
}

function setCurrentScene(sceneId: string) {
	(globalThis as unknown as { canvas?: { scene?: { id: string } } }).canvas ??= {};
	(globalThis as unknown as { canvas: { scene: { id: string } } }).canvas.scene = {
		id: sceneId,
	};
}

describe('PlayerCharacterCoreTab', () => {
	it('does not create a second chat initiative roll while the first one is still pending', async () => {
		const actor = createCoreTabActor();
		(
			globalThis as unknown as {
				game: {
					combats: {
						viewed: Combat | null;
					};
				};
			}
		).game.combats = { viewed: null };
		setCurrentScene('scene-core-tab-test');

		let hasPendingRoll = false;
		let resolveRoll: () => void = () => {
			throw new Error('Expected initiative roll evaluation to remain pending.');
		};
		actor.rollInitiativeToChat.mockImplementation(async () => {
			await new Promise<void>((resolve) => {
				hasPendingRoll = true;
				resolveRoll = resolve;
			});
			return null;
		});

		render(PlayerCharacterCoreTabTestHarness, { actor });

		const initiativeButton = screen.getByRole('button', { name: /roll initiative/i });
		await fireEvent.click(initiativeButton);
		await fireEvent.click(initiativeButton);

		expect(actor.rollInitiativeToChat).toHaveBeenCalledTimes(1);

		await waitFor(() => expect(initiativeButton).toBeDisabled());

		if (!hasPendingRoll) {
			throw new Error('Expected initiative roll evaluation to remain pending.');
		}
		resolveRoll();

		await waitFor(() => expect(initiativeButton).not.toBeDisabled());
	});

	it('does not fall back to a raw chat roll when the current-scene combatant already has initiative', async () => {
		const actor = createCoreTabActor();
		setCurrentScene('scene-core-tab-test');

		const combatRollInitiative = vi.fn().mockResolvedValue(undefined);
		(
			globalThis as unknown as {
				game: {
					combats: {
						viewed: Combat | null;
					};
				};
			}
		).game.combats = {
			viewed: {
				scene: { id: 'scene-core-tab-test' },
				combatants: {
					find: vi.fn().mockReturnValue({
						id: 'combatant-core-tab-test',
						actorId: actor.id,
						initiative: 17,
						flags: {},
					}),
				},
				rollInitiative: combatRollInitiative,
			} as unknown as Combat,
		};

		render(PlayerCharacterCoreTabTestHarness, { actor });

		const initiativeButton = screen.getByRole('button', { name: /roll initiative/i });
		await fireEvent.click(initiativeButton);

		expect(combatRollInitiative).not.toHaveBeenCalled();
		expect(actor.rollInitiativeToChat).not.toHaveBeenCalled();
		expect(
			(
				globalThis as unknown as {
					ui: {
						notifications: {
							info: ReturnType<typeof vi.fn>;
						};
					};
				}
			).ui.notifications.info,
		).toHaveBeenCalledWith('Initiative has already been rolled for this combatant.');
		expect(initiativeButton).not.toBeDisabled();
	});
});
