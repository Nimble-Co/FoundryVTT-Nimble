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

		const roll = {
			evaluate: vi.fn(),
			toMessage: vi.fn().mockResolvedValue({ id: 'chat-message-initiative' }),
		} as const;

		let hasPendingEvaluate = false;
		let resolveEvaluate: () => void = () => {
			throw new Error('Expected initiative roll evaluation to remain pending.');
		};
		roll.evaluate.mockImplementation(async () => {
			await new Promise<void>((resolve) => {
				hasPendingEvaluate = true;
				resolveEvaluate = resolve;
			});
			return roll;
		});

		const rollCreate = vi.fn().mockReturnValue(roll);
		(
			globalThis as unknown as {
				ChatMessage: {
					getSpeaker: ReturnType<typeof vi.fn>;
				};
			}
		).ChatMessage.getSpeaker = vi.fn().mockReturnValue({ actor: actor.id });
		(globalThis as unknown as { Roll: { create: ReturnType<typeof vi.fn> } }).Roll.create =
			rollCreate;

		render(PlayerCharacterCoreTabTestHarness, { actor });

		const initiativeButton = screen.getByRole('button', { name: /roll initiative/i });
		await fireEvent.click(initiativeButton);
		await fireEvent.click(initiativeButton);

		expect(rollCreate).toHaveBeenCalledTimes(1);
		expect(roll.evaluate).toHaveBeenCalledTimes(1);
		expect(roll.toMessage).not.toHaveBeenCalled();

		await waitFor(() => expect(initiativeButton).toBeDisabled());

		if (!hasPendingEvaluate) {
			throw new Error('Expected initiative roll evaluation to remain pending.');
		}
		resolveEvaluate();

		await waitFor(() => expect(roll.toMessage).toHaveBeenCalledTimes(1));
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

		const rollCreate = vi.fn();
		(globalThis as unknown as { Roll: { create: ReturnType<typeof vi.fn> } }).Roll.create =
			rollCreate;

		render(PlayerCharacterCoreTabTestHarness, { actor });

		const initiativeButton = screen.getByRole('button', { name: /roll initiative/i });
		await fireEvent.click(initiativeButton);

		expect(combatRollInitiative).not.toHaveBeenCalled();
		expect(rollCreate).not.toHaveBeenCalled();
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
