import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHasPropertyMock,
	createHookCapture,
} from '../../../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<
		CombatDefeatSyncTestGlobals & { game: { combat: Combat | null; user: { isGM: boolean } } }
	>();
}

function createMockCharacterActor(actorId: string): Actor.Implementation {
	return {
		id: actorId,
		type: 'character',
		name: 'Test Character',
		system: {
			attributes: {
				hp: { value: 10, max: 20 },
				wounds: { value: 0, max: 6 },
			},
		},
	} as unknown as Actor.Implementation;
}

function createMockCombatantWithActor(
	actor: Actor.Implementation,
): Combatant.Implementation & { update: ReturnType<typeof vi.fn> } {
	return {
		id: `combatant-${actor.id}`,
		type: actor.type as 'character',
		actor,
		update: vi.fn().mockResolvedValue(undefined),
	} as unknown as Combatant.Implementation & { update: ReturnType<typeof vi.fn> };
}

function createMockCombat(
	combatId: string,
	combatants: Combatant.Implementation[],
	started: boolean,
	round: number,
): Combat {
	return {
		id: combatId,
		started,
		round,
		combatants: {
			contents: combatants,
			size: combatants.length,
		},
		turn: 0,
		combatant: combatants[0] ?? null,
	} as unknown as Combat;
}

describe('registerWoundTriggerHooks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().foundry.utils.hasProperty = createHasPropertyMock();
		globals().game.combat = null;
	});

	it('registers updateActor hook for wound detection', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerWoundTriggerHooks } = await import('../woundTrigger.js');
		registerWoundTriggerHooks();

		const updateActorHook = callbacks.get('updateActor');
		expect(updateActorHook).toBeDefined();
	});

	it('does not trigger for non-character actors', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerWoundTriggerHooks } = await import('../woundTrigger.js');
		registerWoundTriggerHooks();

		const updateActor = callbacks.get('updateActor');

		const npcActor = {
			id: 'npc-actor',
			type: 'npc',
			system: {
				attributes: {
					wounds: { value: 1 },
				},
			},
		} as unknown as Actor.Implementation;

		let threw = false;
		try {
			updateActor?.(npcActor, {
				system: { attributes: { wounds: { value: 1 } } },
			});
		} catch {
			threw = true;
		}

		expect(threw).toBe(false);
	});
});

describe('registerTurnTriggerHooks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.combat = null;
	});

	it('registers both turn-boundary custom hooks for recovery detection', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerTurnTriggerHooks } = await import('../turnTrigger.js');
		registerTurnTriggerHooks();

		expect(callbacks.get('nimbleCombatTurnStart')).toBeDefined();
		expect(callbacks.get('nimbleCombatTurnEnd')).toBeDefined();
	});

	it('does not throw when called with non-character combatant', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerTurnTriggerHooks } = await import('../turnTrigger.js');
		registerTurnTriggerHooks();

		const npcActor = {
			id: 'npc-1',
			type: 'npc',
			name: 'Test NPC',
			system: { attributes: { hp: { value: 10, max: 20 } } },
		} as unknown as Actor.Implementation;

		const npcCombatant = {
			id: 'combatant-npc',
			type: 'npc',
			actor: npcActor,
		} as unknown as Combatant.Implementation;

		let threw = false;
		try {
			callbacks.get('nimbleCombatTurnStart')?.(npcCombatant);
			callbacks.get('nimbleCombatTurnEnd')?.(npcCombatant);
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});

describe('registerKillTriggerHooks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.combat = null;
	});

	it('registers nimbleKillApplied hook for kill detection', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerKillTriggerHooks } = await import('../killTrigger.js');
		registerKillTriggerHooks();

		const killHook = callbacks.get('nimbleKillApplied');
		expect(killHook).toBeDefined();
	});

	it('does not throw when attacker is not a character', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerKillTriggerHooks } = await import('../killTrigger.js');
		registerKillTriggerHooks();

		const npcAttacker = {
			id: 'npc-attacker',
			type: 'npc',
			name: 'Goblin',
		} as unknown as Actor.Implementation;

		const target = {
			id: 'character-target',
			type: 'character',
			name: 'Player Character',
		} as unknown as Actor.Implementation;

		const killHook = callbacks.get('nimbleKillApplied');
		let threw = false;
		try {
			killHook?.(npcAttacker, target);
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});

describe('registerInitiativeTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		globals().game.combat = null;
	});

	it('registers nimble.initiativeRolled hook for initiative detection', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerInitiativeTriggerHooks } = await import('../initiativeTrigger.js');
		registerInitiativeTriggerHooks();

		const initiativeHook = callbacks.get('nimble.initiativeRolled');
		expect(initiativeHook).toBeDefined();
	});

	it('does not throw when actor is not a character', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerInitiativeTriggerHooks } = await import('../initiativeTrigger.js');
		registerInitiativeTriggerHooks();

		const npcActor = {
			id: 'npc-1',
			type: 'npc',
			name: 'Test NPC',
		} as unknown as Actor.Implementation;

		const initiativeHook = callbacks.get('nimble.initiativeRolled');
		let threw = false;
		try {
			initiativeHook?.({ actor: npcActor });
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});

	describe('a pool that refills when Initiative is rolled', () => {
		function commander(start: number) {
			const pools: Record<string, unknown> = {
				dice: { current: start, max: 5, recoveries: [] },
			};
			const actor: Record<string, unknown> = {
				uuid: 'Actor.commander',
				type: 'character',
				flags: { nimble: {} },
				getRollData: () => ({}),
				update: vi.fn(async (changes: Record<string, unknown>) => {
					for (const [path, value] of Object.entries(changes)) {
						foundry.utils.setProperty(actor, path, value);
					}
				}),
			};
			const item = {
				id: 'combat-dice',
				name: 'Combat Dice',
				actor,
				flags: { nimble: { chargePools: pools } },
				rules: new Map([
					[
						'0',
						{
							type: 'chargePool',
							id: 'pool',
							identifier: 'dice',
							scope: 'item',
							max: '5',
							initial: 'max',
							recoveries: [{ trigger: 'onInitiativeRolled', mode: 'add', value: '2' }],
						},
					],
				]),
				update: vi.fn(async (changes: Record<string, unknown>) => {
					const payload = changes['flags.nimble.chargePools'] as Record<string, unknown>;
					Object.assign(item.flags.nimble.chargePools, payload);
				}),
			};
			actor.items = { contents: [item], get: () => item };
			const current = () => (item.flags.nimble.chargePools.dice as { current: number }).current;
			return { actor, item, current };
		}

		const rolledIn = (combatId: string) => ({ parent: { id: combatId } });

		it('refills once per combat, however many times Initiative is rolled', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const { registerInitiativeTriggerHooks } = await import('../initiativeTrigger.js');
			registerInitiativeTriggerHooks();
			const hook = callbacks.get('nimble.initiativeRolled');
			const { actor, item, current } = commander(0);

			await hook?.({ actor, combatant: rolledIn('combat-1') });
			await vi.waitFor(() => expect(current()).toBe(2));
			const writes = item.update.mock.calls.length;
			await hook?.({ actor, combatant: rolledIn('combat-1') });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(item.update).toHaveBeenCalledTimes(writes);
			expect(current()).toBe(2);

			await hook?.({ actor, combatant: rolledIn('combat-2') });
			await vi.waitFor(() => expect(current()).toBe(4));
		});
	});

	it('does not throw when payload has no actor', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerInitiativeTriggerHooks } = await import('../initiativeTrigger.js');
		registerInitiativeTriggerHooks();

		const initiativeHook = callbacks.get('nimble.initiativeRolled');
		let threw = false;
		try {
			initiativeHook?.({});
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});

describe('registerBloodiedTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		globals().game.combat = null;
	});

	it('registers combatStart, deleteCombat, and updateActor hooks', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerBloodiedTriggerHooks } = await import('../bloodiedTrigger.js');
		registerBloodiedTriggerHooks();

		const combatStartHook = callbacks.get('combatStart');
		expect(combatStartHook).toBeDefined();

		const deleteCombatHook = callbacks.get('deleteCombat');
		expect(deleteCombatHook).toBeDefined();

		const updateActorHook = callbacks.get('updateActor');
		expect(updateActorHook).toBeDefined();
	});

	it('does not throw when combat is deleted', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerBloodiedTriggerHooks } = await import('../bloodiedTrigger.js');
		registerBloodiedTriggerHooks();

		const actor = createMockCharacterActor('character-1');
		const combatant = createMockCombatantWithActor(actor);
		const combat = createMockCombat('combat-1', [combatant], false, 0);

		const deleteCombatHook = callbacks.get('deleteCombat');
		let threw = false;
		try {
			deleteCombatHook?.(combat);
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});
