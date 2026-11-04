import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import type { IncomingReactionEntry } from '../../utils/incomingReactions/incomingReactionEntry.js';
import { NimbleChatMessage } from '../chatMessage.js';

const ROLLER = 'Actor.roller';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

function makeCombatant(overrides: Record<string, unknown> = {}) {
	const combatant = {
		id: 'combatant-1',
		type: 'character',
		initiative: 7 as number | null,
		system: { actions: { base: { current: 1, max: 3 }, pendingDelta: 0 } },
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(combatant, path, value);
			}
		}),
		...overrides,
	};
	return combatant;
}

function setupCombat(combatant: ReturnType<typeof makeCombatant> | null) {
	const combat = {
		id: 'combat-1',
		combatants: new Map(combatant ? [[combatant.id, combatant]] : []),
	};
	globals.game.combats = new Map([[combat.id, combat]]);
}

function setupRule(cost: Record<string, unknown> = {}) {
	const roller = {
		uuid: ROLLER,
		type: 'character',
		isOwner: true,
		rules: [] as unknown[],
		system: {
			attributes: { wounds: { value: 0, max: 6 } },
			resources: { mana: { current: 5, max: 5 } },
		},
		items: [],
		getRollData: () => ({}),
		testUserPermission: () => true,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(roller, path, value);
			}
		}),
	};
	const rule = {
		type: 'changeResult',
		id: 'cheat',
		disabled: false,
		label: '',
		item: { name: 'Cheat!', uuid: 'Item.cheat' },
		actor: roller,
		rollUseCost: { chargePoolIdentifier: '', chargeCost: 1, manaCost: 0, woundCost: 0, ...cost },
		resultUseFor: () => ({ change: 'setTotal', value: 10, stat: '' }),
		offersUseOn: () => true,
	};
	roller.rules = [rule];
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn(
			(uuid: string) =>
				({
					[ROLLER]: roller,
					'Item.cheat': { rules: new Map([[rule.id, rule]]) },
				})[uuid] ?? null,
		),
	);
	return roller;
}

const ENTRY: IncomingReactionEntry = {
	id: 'entry-cheat',
	kind: 'reroll',
	source: 'rule',
	actorUuid: ROLLER,
	tokenUuid: null,
	targetTokenUuid: null,
	side: 'roller',
	label: 'cheat',
	ruleId: 'cheat',
	itemUuid: 'Item.cheat',
	used: false,
	outcomeTrigger: 'always',
	use: 'result',
};

function createCard(system: Record<string, unknown> = {}, d20 = 5, total = 7) {
	const roll = {
		class: 'Roll',
		formula: '1d20 + 2',
		total,
		options: {},
		data: {},
		terms: [{ class: 'Die', faces: 20, number: 1, results: [{ result: d20, active: true }] }],
	};
	const message = new NimbleChatMessage({
		type: 'initiative',
		system: {},
	} as unknown as ChatMessage.CreateData) as NimbleChatMessage & {
		update: ReturnType<typeof vi.fn>;
		system: Record<string, any>;
	};
	(message as unknown as { _source: unknown })._source = { rolls: [JSON.stringify(roll)] };
	Object.assign(message, {
		id: foundry.utils.randomID(),
		system: {
			actorType: 'character',
			actorUuid: ROLLER,
			combatId: 'combat-1',
			combatantId: 'combatant-1',
			foldedActionDelta: 0,
			rollMode: 0,
			incomingReactions: [ENTRY],
			resultChanges: [],
			rerolls: [],
			...system,
		},
	});
	message.update = vi.fn(async (changes: { system?: Record<string, unknown> }) => {
		Object.assign(message.system, changes.system ?? {});
	}) as never;
	return message;
}

const click = (card: ReturnType<typeof createCard>) =>
	card.resolveRerollReaction('entry-cheat', 'gm-user');
const removeChange = (card: ReturnType<typeof createCard>) =>
	card.resolveResultRemoval(
		(card.system as unknown as { resultChanges: ResultChange[] }).resultChanges[0].lineId,
		'gm-user',
	);

const actionsOf = (combatant: ReturnType<typeof makeCombatant>) =>
	combatant.system.actions.base.current;

beforeEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	globals.game.user = { isGM: true, id: 'gm-user' };
	globals.game.users = { get: vi.fn((id: string) => ({ isGM: true, id })) };
	globals.ui.notifications.warn = vi.fn();
	setupRule();
});

describe('Change a Result on an Initiative card', () => {
	it('updates the initiative, and unspent actions follow the new number', async () => {
		const combatant = makeCombatant();
		setupCombat(combatant);

		await click(createCard());

		expect(combatant.initiative).toBe(10);
		expect(actionsOf(combatant)).toBe(2);
	});

	it('adds the difference to actions on a late click', async () => {
		// Started with 1, refilled to 3, spent 1.
		const combatant = makeCombatant({
			system: { actions: { base: { current: 2, max: 3 }, pendingDelta: 0 } },
		});
		setupCombat(combatant);

		await click(createCard());

		expect(combatant.initiative).toBe(10);
		expect(actionsOf(combatant)).toBe(3);
	});

	it('adds the difference when every action is spent', async () => {
		const combatant = makeCombatant({
			system: { actions: { base: { current: 0, max: 3 }, pendingDelta: 0 } },
		});
		setupCombat(combatant);

		await click(createCard());

		expect(actionsOf(combatant)).toBe(1);
	});

	it('takes off only what is left, and never goes below 0', async () => {
		const combatant = makeCombatant();
		setupCombat(combatant);
		const card = createCard();
		await click(card);
		combatant.system.actions.base.current = 0;

		await removeChange(card);

		expect(combatant.initiative).toBe(7);
		expect(actionsOf(combatant)).toBe(0);
	});

	it('Remove reverses the change and gives the cost back', async () => {
		const roller = setupRule({ woundCost: 1 });
		const combatant = makeCombatant();
		setupCombat(combatant);
		const card = createCard();
		await click(card);
		expect(roller.system.attributes.wounds.value).toBe(1);

		await removeChange(card);

		expect(card.system.resultChanges).toEqual([]);
		expect(combatant.initiative).toBe(7);
		expect(actionsOf(combatant)).toBe(1);
		expect(roller.system.attributes.wounds.value).toBe(0);
	});

	it('Remove on a late change takes the difference off', async () => {
		const combatant = makeCombatant();
		setupCombat(combatant);
		const card = createCard();
		await click(card);
		combatant.system.actions.base.current = 3;

		await removeChange(card);

		expect(actionsOf(combatant)).toBe(2);
	});

	describe('a combat or a combatant that is not the card', () => {
		it('does not change the current combat for a card of an old combat', async () => {
			const combatant = makeCombatant();
			setupCombat(combatant);
			globals.game.combat = globals.game.combats.get('combat-1');
			const card = createCard({ combatId: 'old-combat' });

			await click(card);

			expect(combatant.update).not.toHaveBeenCalled();
			expect(card.system.resultChanges).toHaveLength(1);
		});

		it('keeps the change on the card when the combatant is gone', async () => {
			setupCombat(null);
			const card = createCard();

			await click(card);

			expect(card.system.resultChanges).toHaveLength(1);
		});

		it('keeps the change on the card for a card of no combat', async () => {
			const combatant = makeCombatant();
			setupCombat(combatant);
			const card = createCard({ combatId: null, combatantId: null });

			await click(card);

			expect(combatant.update).not.toHaveBeenCalled();
			expect(card.system.resultChanges).toHaveLength(1);
		});

		it('does not write over a new roll or a number set by hand', async () => {
			const combatant = makeCombatant({ initiative: 15 });
			setupCombat(combatant);

			await click(createCard());

			expect(combatant.update).not.toHaveBeenCalled();
		});

		it('keeps the change on the card when the write fails', async () => {
			const combatant = makeCombatant({ update: vi.fn().mockRejectedValue(new Error('no')) });
			setupCombat(combatant);
			const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
			const card = createCard();

			await click(card);

			expect(card.system.resultChanges).toHaveLength(1);
			expect(error).toHaveBeenCalled();
		});
	});

	it('updates only the initiative of a combatant that is not a character', async () => {
		const combatant = makeCombatant({ type: 'npc' });
		setupCombat(combatant);

		await click(createCard({ actorType: 'npc' }));

		expect(combatant.update).toHaveBeenCalledWith({ initiative: 10 });
	});

	describe('pending action adjustments', () => {
		it('leaves a pending adjustment for the next refill', async () => {
			const combatant = makeCombatant({
				system: { actions: { base: { current: 1, max: 3 }, pendingDelta: 2 } },
			});
			setupCombat(combatant);

			await click(createCard());

			expect(actionsOf(combatant)).toBe(2);
			expect(combatant.system.actions.pendingDelta).toBe(2);
			expect(Object.keys(combatant.update.mock.calls[0][0])).not.toContain(
				'system.actions.pendingDelta',
			);
		});

		it('keeps a grant the roll folded in', async () => {
			const combatant = makeCombatant({
				system: { actions: { base: { current: 3, max: 3 }, pendingDelta: 0 } },
			});
			setupCombat(combatant);

			await click(createCard({ foldedActionDelta: 2 }));

			expect(actionsOf(combatant)).toBe(4);
		});

		it('reads a debt the roll folded in, as a roll of the new number would', async () => {
			// Rolled 7 with a debt of 2: max(0, 1 - 2) = 0. A roll of 10 gives max(0, 2 - 2) = 0.
			const combatant = makeCombatant({
				system: { actions: { base: { current: 0, max: 3 }, pendingDelta: 0 } },
			});
			setupCombat(combatant);

			await click(createCard({ foldedActionDelta: -2 }));

			expect(actionsOf(combatant)).toBe(0);
		});
	});

	it('reads the new number when a set total replaces a natural 20', async () => {
		const combatant = makeCombatant({
			initiative: 19,
			system: { actions: { base: { current: 3, max: 3 }, pendingDelta: 0 } },
		});
		setupCombat(combatant);

		await click(createCard({}, 20, 19));

		expect(combatant.initiative).toBe(10);
		expect(actionsOf(combatant)).toBe(2);
	});
});
