const {
	damageRollMock,
	getUnarmedDamageFormulaMock,
	hasUnarmedProficiencyMock,
	itemActivationConfigDialogMock,
} = vi.hoisted(() => ({
	damageRollMock: vi.fn(),
	getUnarmedDamageFormulaMock: vi.fn(),
	hasUnarmedProficiencyMock: vi.fn(),
	itemActivationConfigDialogMock: vi.fn(),
}));

vi.mock('../dice/DamageRoll.js', () => ({
	DamageRoll: damageRollMock,
}));

vi.mock('../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
	default: itemActivationConfigDialogMock,
}));

vi.mock('../view/sheets/components/attackUtils.js', () => ({
	getUnarmedDamageFormula: getUnarmedDamageFormulaMock,
	hasUnarmedProficiency: hasUnarmedProficiencyMock,
}));

import { activateHeroicActionMacro } from './activateHeroicActionMacro.ts';

function globals() {
	return globalThis as unknown as {
		canvas: unknown;
		ChatMessage: {
			create: ReturnType<typeof vi.fn>;
			getSpeaker: ReturnType<typeof vi.fn>;
		};
		foundry: {
			applications: {
				api: {
					DialogV2: {
						confirm: ReturnType<typeof vi.fn>;
					};
				};
			};
		};
		game: {
			actors: unknown;
			combat: unknown;
			combats: unknown;
			user: {
				targets: Set<unknown>;
			};
		};
		ui: {
			notifications: {
				warn: ReturnType<typeof vi.fn>;
			};
		};
	};
}

type MacroTestActor = Actor & {
	name: string;
	type: string;
	img: string;
	permission: number;
	reactive: {
		system: {
			attributes: {
				armor: {
					value: number;
				};
			};
		};
	};
	sheet: {
		render: ReturnType<typeof vi.fn>;
		$state: Record<string, unknown>;
	};
};

function setSpeakerActor(actor: Actor | null) {
	globals().ChatMessage.create = vi.fn().mockResolvedValue({ id: 'chat-message-id' });
	globals().ChatMessage.getSpeaker = vi.fn().mockReturnValue(actor ? { actor: actor.id } : {});
	globals().game.actors = {
		tokens: {},
		get: vi.fn().mockReturnValue(actor),
	};
}

function createCharacterActor(): MacroTestActor {
	return {
		id: 'character-macro-actor',
		name: 'Heroic Tester',
		type: 'character',
		isOwner: true,
		img: 'hero.webp',
		permission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
		system: {
			attributes: {
				movement: {
					walk: 6,
					fly: 0,
					climb: 0,
					swim: 0,
					burrow: 0,
				},
			},
		},
		reactive: {
			system: {
				attributes: {
					armor: {
						value: 15,
					},
				},
			},
		},
		sheet: {
			render: vi.fn().mockResolvedValue(undefined),
			$state: {},
		},
	} as unknown as MacroTestActor;
}

function createCombatant(actor: MacroTestActor, currentActions = 1) {
	return {
		id: 'combatant-heroic-macro',
		actorId: actor.id,
		actor,
		initiative: 12,
		system: {
			actions: {
				base: {
					current: currentActions,
				},
				heroic: {
					defendAvailable: true,
					interposeAvailable: true,
					helpAvailable: true,
					opportunityAttackAvailable: true,
				},
			},
		},
		update: vi.fn().mockResolvedValue(undefined),
	};
}

function setCurrentScene(sceneId: string) {
	globals().canvas = {
		scene: { id: sceneId },
	};
}

function setActiveCombat(
	combatant: ReturnType<typeof createCombatant>,
	activeCombatant: Combatant,
) {
	const combat = {
		scene: { id: 'scene-heroic-macro' },
		active: true,
		started: true,
		round: 1,
		combatant: activeCombatant,
		combatants: [combatant, activeCombatant],
	} as unknown as Combat;
	globals().game.combat = combat;
	globals().game.combats = {
		contents: [combat],
		viewed: combat,
	};
}

describe('activateHeroicActionMacro', () => {
	beforeEach(() => {
		globals().ui.notifications.warn.mockReset();
		globals().foundry.applications.api.DialogV2.confirm.mockReset();
		globals().game.user.targets = new Set();
		setCurrentScene('scene-heroic-macro');
		globals().game.combat = null;
		globals().game.combats = {
			contents: [],
			viewed: null,
		};
	});

	it('warns when the current speaker does not resolve to a character actor', async () => {
		setSpeakerActor({
			id: 'npc-actor',
			type: 'npc',
		} as unknown as Actor);

		await activateHeroicActionMacro('move', 'action');

		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			game.i18n.localize('NIMBLE.ui.heroicActions.macroWarnings.selectCharacterToken'),
		);
	});

	it('asks for confirmation before moving with no actions and stops when the user cancels', async () => {
		const actor = createCharacterActor();
		const combatant = createCombatant(actor, 0);
		const activeCombatant = {
			id: 'active-combatant',
			actorId: 'other-actor',
			initiative: 15,
		} as Combatant;
		setSpeakerActor(actor);
		setActiveCombat(combatant, activeCombatant);
		globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);

		await activateHeroicActionMacro('move', 'action');

		expect(globals().foundry.applications.api.DialogV2.confirm).toHaveBeenCalledTimes(1);
		expect(combatant.update).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
	});

	it('moves after confirmation even when the actor has no actions remaining', async () => {
		const actor = createCharacterActor();
		const combatant = createCombatant(actor, 0);
		const activeCombatant = {
			id: 'active-combatant',
			actorId: 'other-actor',
			initiative: 15,
		} as Combatant;
		setSpeakerActor(actor);
		setActiveCombat(combatant, activeCombatant);
		globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);

		await activateHeroicActionMacro('move', 'action');

		expect(combatant.update).toHaveBeenCalledWith({
			'system.actions.base.current': -1,
		});
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'moveAction',
				system: expect.objectContaining({
					actorName: actor.name,
					speed: 6,
				}),
			}),
		);
	});

	it.each([
		['defend', ['defend'], 'defend', [], 15],
		['help', ['help'], 'help', ['Scene.scene.Token.target-one'], undefined],
		['interpose', ['interpose'], 'interpose', ['Scene.scene.Token.target-one'], undefined],
	] as const)(
		'confirms and resolves the %s reaction directly from the hotbar',
		async (actionId, reactionKeys, reactionType, targets, armorValue) => {
			const actor = createCharacterActor();
			const combatant = createCombatant(actor, 0);
			const useHeroicReactions = vi.fn().mockResolvedValue(true);
			const activeCombatant = {
				id: 'active-combatant',
				actorId: 'other-actor',
				initiative: 15,
			} as Combatant;
			setSpeakerActor(actor);
			setActiveCombat(
				{
					...combatant,
					system: {
						...combatant.system,
						actions: {
							...combatant.system.actions,
							base: { current: 0 },
						},
					},
				},
				activeCombatant,
			);
			globals().game.combat = {
				...(globals().game.combat as Combat),
				useHeroicReactions,
			};
			globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);
			globals().game.user.targets = new Set([
				{
					actor: { id: 'target-actor' },
					document: { uuid: 'Scene.scene.Token.target-one' },
				},
			]);

			await activateHeroicActionMacro(actionId, 'reaction');

			expect(globals().foundry.applications.api.DialogV2.confirm).toHaveBeenCalledTimes(1);
			expect(useHeroicReactions).toHaveBeenCalledWith(combatant.id, reactionKeys, {
				force: true,
			});
			expect(ChatMessage.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'reaction',
					system: expect.objectContaining({
						reactionType,
						targets,
						...(armorValue === undefined ? {} : { armorValue }),
					}),
				}),
			);
		},
	);

	it('creates interpose before defend for the combined reaction macro', async () => {
		const actor = createCharacterActor();
		const combatant = createCombatant(actor, 2);
		const useHeroicReactions = vi.fn().mockResolvedValue(true);
		const activeCombatant = {
			id: 'active-combatant',
			actorId: 'other-actor',
			initiative: 15,
		} as Combatant;
		setSpeakerActor(actor);
		setActiveCombat(combatant, activeCombatant);
		globals().game.combat = {
			...(globals().game.combat as Combat),
			useHeroicReactions,
		};
		globals().game.user.targets = new Set([
			{
				actor: { id: 'target-actor' },
				document: { uuid: 'Scene.scene.Token.target-one' },
			},
		]);

		await activateHeroicActionMacro('interposeAndDefend', 'reaction');

		expect(useHeroicReactions).toHaveBeenCalledWith(
			combatant.id,
			['interpose', 'defend'],
			undefined,
		);
		expect(ChatMessage.create).toHaveBeenCalledTimes(2);
		expect(ChatMessage.create).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				system: expect.objectContaining({
					reactionType: 'interpose',
				}),
			}),
		);
		expect(ChatMessage.create).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				system: expect.objectContaining({
					reactionType: 'defend',
				}),
			}),
		);
	});
});
