import { activateItemMacro } from './activateItemMacro.ts';

function globals() {
	return globalThis as unknown as {
		canvas: unknown;
		ChatMessage: {
			getSpeaker: ReturnType<typeof vi.fn>;
		};
		game: {
			actors: unknown;
			combat: unknown;
			combats: unknown;
		};
		ui: {
			notifications: {
				warn: ReturnType<typeof vi.fn>;
			};
		};
	};
}

type TestActor = Actor & {
	name: string;
	items: Array<{
		name: string;
		system?: Record<string, unknown>;
		activate: ReturnType<typeof vi.fn>;
	}>;
};

function setSpeakerActor(actor: TestActor) {
	globals().ChatMessage.getSpeaker = vi.fn().mockReturnValue({ actor: actor.id });
	globals().game.actors = {
		tokens: {},
		get: vi.fn().mockReturnValue(actor),
	};
}

function createItem({
	name = 'Longsword',
	cost = { type: 'action', quantity: 1 },
	activationResult = { ok: true },
}: {
	name?: string;
	cost?: { type: string; quantity: number } | null;
	activationResult?: unknown;
}) {
	return {
		name,
		system: cost
			? {
					activation: {
						cost,
					},
				}
			: {},
		activate: vi.fn().mockResolvedValue(activationResult),
	};
}

function createActor(item: ReturnType<typeof createItem>): TestActor {
	return {
		id: 'actor-item-macro',
		name: 'Macro User',
		items: [item],
	} as unknown as TestActor;
}

function createCombatant(currentActions: number, initiative: number | null = 12) {
	return {
		id: 'combatant-item-macro',
		actorId: 'actor-item-macro',
		initiative,
		system: {
			actions: {
				base: {
					current: currentActions,
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

function setActiveCombat(combatant: ReturnType<typeof createCombatant> | null) {
	const combat =
		combatant == null
			? null
			: {
					scene: { id: 'scene-item-macro' },
					active: true,
					combatants: [combatant],
				};
	globals().game.combat = combat;
	globals().game.combats = {
		contents: combat ? [combat as unknown as Combat] : [],
		viewed: combat as unknown as Combat | null,
	};
}

describe('activateItemMacro', () => {
	beforeEach(() => {
		globals().ui.notifications.warn.mockReset();
		setCurrentScene('scene-item-macro');
		setActiveCombat(null);
	});

	it('deducts action pips after a successful action-cost activation and clamps at zero', async () => {
		const item = createItem({
			cost: { type: 'action', quantity: 2 },
		});
		const actor = createActor(item);
		const combatant = createCombatant(1);
		setSpeakerActor(actor);
		setActiveCombat(combatant);

		await activateItemMacro('Longsword');

		expect(item.activate).toHaveBeenCalled();
		expect(combatant.update).toHaveBeenCalledWith({
			'system.actions.base.current': 0,
		});
	});

	it('does not deduct action pips when the activation fails', async () => {
		const item = createItem({
			activationResult: false,
		});
		const actor = createActor(item);
		const combatant = createCombatant(2);
		setSpeakerActor(actor);
		setActiveCombat(combatant);

		await activateItemMacro('Longsword');

		expect(combatant.update).not.toHaveBeenCalled();
	});

	it('does not deduct action pips for non-action activation costs', async () => {
		const item = createItem({
			cost: { type: 'reaction', quantity: 1 },
		});
		const actor = createActor(item);
		const combatant = createCombatant(2);
		setSpeakerActor(actor);
		setActiveCombat(combatant);

		await activateItemMacro('Longsword');

		expect(combatant.update).not.toHaveBeenCalled();
	});

	it('does not deduct action pips when there is no active combat', async () => {
		const item = createItem({});
		const actor = createActor(item);
		setSpeakerActor(actor);
		setActiveCombat(null);

		await activateItemMacro('Longsword');

		expect(item.activate).toHaveBeenCalled();
	});

	it('does not deduct action pips when the actor is not currently in initiative order', async () => {
		const item = createItem({});
		const actor = createActor(item);
		const combatant = createCombatant(2, null);
		setSpeakerActor(actor);
		setActiveCombat(combatant);

		await activateItemMacro('Longsword');

		expect(combatant.update).not.toHaveBeenCalled();
	});
});
