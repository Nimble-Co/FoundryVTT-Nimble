import { createCombatantsCollectionFixture } from '../../../tests/fixtures/combat.js';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';

const damageRollMock = vi.fn();
const getUnarmedDamageFormulaMock = vi.fn();
const hasUnarmedProficiencyMock = vi.fn();
const itemActivationConfigDialogMock = vi.fn();

// The test setup has already loaded this macro through game.ts, so a hoisted
// vi.mock would not reach it. Load a fresh copy after the mocks are registered.
let activateHeroicActionMacro: typeof import('../activateHeroicActionMacro.ts').activateHeroicActionMacro;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../../dice/DamageRoll.js', () => ({
		DamageRoll: damageRollMock,
	}));
	vi.doMock('../../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
		default: itemActivationConfigDialogMock,
	}));
	vi.doMock('../../utils/damage/attackUtils.js', () => ({
		getDamageBonusFormulas: () => [],
		getDamageBonusTotal: () => 0,
		getUnarmedDamageFormula: getUnarmedDamageFormulaMock,
		hasUnarmedProficiency: hasUnarmedProficiencyMock,
	}));
	({ activateHeroicActionMacro } = await import('../activateHeroicActionMacro.ts'));
});

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
		getRollData: () => ({}),
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
		combatants: createCombatantsCollectionFixture([
			combatant,
			activeCombatant,
		] as unknown as Combatant.Implementation[]),
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

	describe('the new character sheet', () => {
		function withRevealSheet() {
			const actor = createCharacterActor();
			const reveal = vi.fn();
			(actor as unknown as { sheet: unknown }).sheet = { reveal, render: vi.fn() };
			setSpeakerActor(actor);
			return reveal;
		}

		it.each([
			['assess', 'action', { tab: 'actions', rowId: 'heroic-assess', step: 'choice' }],
			['opportunity', 'reaction', { tab: 'actions', rowId: 'heroic-opportunity', step: 'choice' }],
			['attack', 'action', { tab: 'actions' }],
			['spell', 'action', { tab: 'spells' }],
		] as const)('%s opens the sheet through reveal()', async (actionId, actionType, request) => {
			const reveal = withRevealSheet();

			await activateHeroicActionMacro(actionId, actionType);

			expect(reveal).toHaveBeenCalledWith(request);
			expect(globals().foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
		});

		it('still moves at once, with no sheet', async () => {
			const reveal = withRevealSheet();

			await activateHeroicActionMacro('move', 'action');

			expect(reveal).not.toHaveBeenCalled();
		});
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

		expect(combatant.update).not.toHaveBeenCalled();
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

	describe('action pips', () => {
		const holder = globalThis as unknown as {
			game: { settings?: unknown };
			CONST: { CHAT_MESSAGE_STYLES?: unknown };
			CONFIG: { sounds?: unknown };
		};
		let previousSettings: unknown;

		function setActionTracking(enabled: boolean) {
			holder.game.settings = {
				get: vi.fn(
					(_namespace: string, key: string) =>
						key !== AUTOMATION_SETTING_KEYS.actionTracking || enabled,
				),
			};
		}

		function setUpUnarmedStrike() {
			getUnarmedDamageFormulaMock.mockReturnValue('1d4');
			hasUnarmedProficiencyMock.mockReturnValue(false);
			itemActivationConfigDialogMock.mockImplementation(function dialog() {
				return { render: vi.fn(), promise: Promise.resolve({ rollMode: 0 }) };
			});
			damageRollMock.mockImplementation(function roll() {
				return { evaluate: vi.fn(), toJSON: () => ({}), isCritical: false, isMiss: false };
			});
			holder.CONST.CHAT_MESSAGE_STYLES ??= { OTHER: 0 };
			holder.CONFIG.sounds ??= { dice: '' };
		}

		function inCombatWithActions(currentActions: number) {
			const actor = createCharacterActor();
			const combatant = createCombatant(actor, currentActions);
			setSpeakerActor(actor);
			setActiveCombat(combatant, {
				id: 'active-combatant',
				actorId: 'other-actor',
				initiative: 15,
			} as Combatant);
			return combatant;
		}

		beforeEach(() => {
			previousSettings = holder.game.settings;
		});

		afterEach(() => {
			holder.game.settings = previousSettings;
		});

		it.each(['move', 'unarmedStrike'])('spends 1 action for %s', async (actionId) => {
			setActionTracking(true);
			setUpUnarmedStrike();
			const combatant = inCombatWithActions(2);

			await activateHeroicActionMacro(actionId, 'action');

			expect(combatant.update).toHaveBeenCalledWith({ 'system.actions.base.current': 1 });
		});

		it.each(['move', 'unarmedStrike'])(
			'spends no action for %s with action tracking off',
			async (actionId) => {
				setActionTracking(false);
				setUpUnarmedStrike();
				const combatant = inCombatWithActions(2);

				await activateHeroicActionMacro(actionId, 'action');

				expect(ChatMessage.create).toHaveBeenCalled();
				expect(combatant.update).not.toHaveBeenCalled();
			},
		);
	});
});
