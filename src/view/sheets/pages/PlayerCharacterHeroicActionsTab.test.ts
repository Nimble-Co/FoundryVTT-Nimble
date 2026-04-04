import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';

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

vi.mock('../../../dice/DamageRoll.js', () => ({
	DamageRoll: damageRollMock,
}));

vi.mock('../../../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
	default: itemActivationConfigDialogMock,
}));

vi.mock('../components/attackUtils.js', () => ({
	getUnarmedDamageFormula: getUnarmedDamageFormulaMock,
	hasUnarmedProficiency: hasUnarmedProficiencyMock,
}));

import { activateHeroicActionMacro } from '../../../macros/activateHeroicActionMacro.ts';
import PlayerCharacterHeroicActionsTabTestHarness from './PlayerCharacterHeroicActionsTab.testHarness.svelte';

function globals() {
	return globalThis as unknown as {
		canvas: unknown;
		ChatMessage: {
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
				isGM?: boolean;
				targets: Set<unknown>;
			};
		};
	};
}

function createOpportunityActor(sheetState: Record<string, unknown>) {
	const weapon = {
		_id: 'weapon-opportunity',
		id: 'weapon-opportunity',
		sort: 1,
		type: 'object',
		reactive: {
			name: 'Spear',
			img: 'spear.webp',
		},
		system: {
			objectType: 'weapon',
			activation: {
				effects: [
					{
						type: 'damage',
						formula: '1d6',
					},
				],
			},
			properties: {
				selected: ['reach'],
				reach: {
					max: 2,
				},
			},
		},
	} as unknown as Item;

	return {
		id: 'heroic-actions-tab-actor',
		name: 'Opportunity Tester',
		type: 'character',
		isOwner: true,
		img: 'opportunity.webp',
		system: {
			unarmedDamage: '1d4',
		},
		permission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
		reactive: {
			flags: {
				nimble: {
					showEmbeddedDocumentImages: false,
				},
			},
			system: {
				attributes: {
					armor: {
						value: 13,
					},
				},
			},
			items: [weapon],
		},
		items: {
			get: vi.fn().mockReturnValue(weapon),
		},
		activateItem: vi.fn().mockResolvedValue({ ok: true }),
		sheet: {
			render: vi.fn().mockResolvedValue(undefined),
			$state: sheetState,
		},
	} as const;
}

describe('PlayerCharacterHeroicActionsTab opportunity macro handoff', () => {
	beforeEach(() => {
		globals().foundry.applications.api.DialogV2.confirm.mockReset();
		globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);
		globals().ChatMessage.getSpeaker = vi.fn();
		globals().game.user = {
			...game.user,
			isGM: false,
			targets: new Set(),
		};
	});

	it('opens the opportunity panel from the macro and uses the next weapon click without prompting twice', async () => {
		const sheetState: Record<string, unknown> = {};
		const actor = createOpportunityActor(sheetState);
		const application = { _onDragStart: vi.fn() };
		const useHeroicReactions = vi.fn().mockResolvedValue(true);
		const reactingCombatant = {
			id: 'combatant-opportunity',
			actorId: actor.id,
			actor,
			type: 'character',
			initiative: 12,
			system: {
				actions: {
					base: {
						current: 0,
					},
					heroic: {
						opportunityAttackAvailable: true,
					},
				},
			},
		};
		const activeCombatant = {
			id: 'active-combatant',
			actorId: 'other-actor',
			initiative: 20,
		};

		globals().game.actors = {
			tokens: {},
			get: vi.fn().mockReturnValue(actor),
		};
		globals().ChatMessage.getSpeaker.mockReturnValue({ actor: actor.id });
		globals().canvas = {
			scene: { id: 'scene-opportunity' },
		};
		globals().game.combat = {
			scene: { id: 'scene-opportunity' },
			active: true,
			started: true,
			round: 1,
			combatant: activeCombatant,
			useHeroicReactions,
			combatants: [reactingCombatant, activeCombatant],
		};
		globals().game.combats = {
			contents: [globals().game.combat as Combat],
			viewed: globals().game.combat as Combat,
		};

		await activateHeroicActionMacro('opportunity', 'reaction');

		expect(globals().foundry.applications.api.DialogV2.confirm).toHaveBeenCalledTimes(1);

		render(PlayerCharacterHeroicActionsTabTestHarness, {
			actor,
			application,
			sheetState,
		});

		await waitFor(() => expect(screen.getByRole('button', { name: /spear/i })).toBeInTheDocument());
		await fireEvent.click(screen.getByRole('button', { name: /spear/i }));

		expect(actor.activateItem).toHaveBeenCalledWith('weapon-opportunity', { rollMode: -1 });
		await waitFor(() =>
			expect(useHeroicReactions).toHaveBeenCalledWith(
				'combatant-opportunity',
				['opportunityAttack'],
				{
					force: true,
				},
			),
		);
		expect(globals().foundry.applications.api.DialogV2.confirm).toHaveBeenCalledTimes(1);
	});
});
