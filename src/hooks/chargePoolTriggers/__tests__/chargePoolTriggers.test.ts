import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

	describe("at the start of another creature's turn", () => {
		function hero(trigger: string) {
			const pools: Record<string, unknown> = { use: { current: 0, max: 1, recoveries: [] } };
			const actor: Record<string, unknown> = {
				uuid: 'Actor.hero',
				type: 'character',
				flags: { nimble: {} },
				getRollData: () => ({}),
				update: vi.fn(async () => {}),
			};
			const item = {
				id: 'feature',
				name: 'Feature',
				actor,
				flags: { nimble: { chargePools: pools } },
				rules: new Map([
					[
						'0',
						{
							type: 'chargePool',
							id: 'pool',
							identifier: 'use',
							scope: 'item',
							max: '1',
							initial: 'max',
							recoveries: [{ trigger, mode: 'refresh', value: '1' }],
						},
					],
				]),
				update: vi.fn(async (changes: Record<string, unknown>) => {
					Object.assign(item.flags.nimble.chargePools, changes['flags.nimble.chargePools']);
				}),
			};
			actor.items = { contents: [item], get: () => item };
			const current = () => (item.flags.nimble.chargePools.use as { current: number }).current;
			return { actor, item, current };
		}

		function monsterTurnWith(actor: Record<string, unknown>) {
			const monster = { id: 'combatant-npc', type: 'npc', actor: { type: 'npc' } };
			const combatants = [{ id: 'combatant-hero', type: 'character', actor }, monster];
			return { ...monster, parent: { combatants: { contents: combatants } } };
		}

		async function turnStart() {
			vi.resetModules();
			const callbacks = createHookCapture(globals().Hooks.on);
			const { registerTurnTriggerHooks } = await import('../turnTrigger.js');
			registerTurnTriggerHooks();
			const hook = callbacks.get('nimbleCombatTurnStart');
			expect(hook).toBeDefined();
			return hook as (combatant: unknown) => void;
		}

		it('refills a pool that refills at the start of each creature turn', async () => {
			const start = await turnStart();
			const { actor, current } = hero('onAnyTurnStart');

			start(monsterTurnWith(actor));

			await vi.waitFor(() => expect(current()).toBe(1));
		});

		it('on its own turn, refills both its own turn pool and its each turn pool', async () => {
			const start = await turnStart();
			const { actor, item } = hero('onAnyTurnStart');
			const pools = item.flags.nimble.chargePools;
			pools.own = { current: 0, max: 1, recoveries: [] };
			item.rules.set('1', {
				type: 'chargePool',
				id: 'own',
				identifier: 'own',
				scope: 'item',
				max: '1',
				initial: 'max',
				recoveries: [{ trigger: 'onTurnStart', mode: 'refresh', value: '1' }],
			});
			const heroTurn = { ...monsterTurnWith(actor), type: 'character', actor };

			start(heroTurn);

			await vi.waitFor(() => {
				const currents = Object.values(pools).map((pool) => (pool as { current: number }).current);
				expect(currents).toEqual([1, 1]);
			});
		});

		it('leaves a pool that refills only on its own turn', async () => {
			const start = await turnStart();
			const { actor, item } = hero('onTurnStart');

			start(monsterTurnWith(actor));
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(item.update).not.toHaveBeenCalled();
		});
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
		const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
		const markOf = (actor: Record<string, unknown>) =>
			foundry.utils.getProperty(actor, 'flags.nimble.initiativeRecoveryCombat');

		async function registeredHooks() {
			const callbacks = createHookCapture(globals().Hooks.on);
			const { registerInitiativeTriggerHooks } = await import('../initiativeTrigger.js');
			registerInitiativeTriggerHooks();
			const roll = callbacks.get('nimble.initiativeRolled');
			const start = callbacks.get('combatStart');
			expect(roll).toBeDefined();
			expect(start).toBeDefined();
			return {
				roll: (actor: Record<string, unknown>, combatId = 'combat-1') =>
					roll?.({ actor, combatant: rolledIn(combatId) }),
				start: (actor: Record<string, unknown>, initiative: number | null) =>
					start?.({ id: 'combat-1', combatants: { contents: [{ actor, initiative }] } }, {}),
			};
		}

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('refills once per combat, however many times Initiative is rolled', async () => {
			const hooks = await registeredHooks();
			const { actor, item, current } = commander(0);

			await hooks.roll(actor);
			await vi.waitFor(() => expect(current()).toBe(2));
			const writes = item.update.mock.calls.length;
			await hooks.roll(actor);
			await settle();
			expect(item.update).toHaveBeenCalledTimes(writes);
			expect(current()).toBe(2);

			await hooks.roll(actor, 'combat-2');
			await vi.waitFor(() => expect(current()).toBe(4));
		});

		describe('when the refill fails', () => {
			async function failedRoll() {
				vi.spyOn(console, 'error').mockImplementation(() => {});
				const hooks = await registeredHooks();
				const hero = commander(0);
				hero.item.update.mockRejectedValueOnce(new Error('write failed'));
				await hooks.roll(hero.actor);
				await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
				return { hooks, ...hero };
			}

			it('does not mark the combat', async () => {
				const { actor } = await failedRoll();

				await vi.waitFor(() => expect(markOf(actor)).toBeNull());
			});

			it('refills on the next roll in that combat', async () => {
				const { hooks, actor, current } = await failedRoll();
				await settle();

				await hooks.roll(actor);

				await vi.waitFor(() => expect(current()).toBe(2));
			});
		});

		describe('when the combat starts', () => {
			it('refills a hero whose Initiative the GM typed by hand', async () => {
				const hooks = await registeredHooks();
				const { actor, current } = commander(0);

				hooks.start(actor, 12);

				await vi.waitFor(() => expect(current()).toBe(2));
			});

			it('leaves a hero with no Initiative to refill on the roll', async () => {
				const hooks = await registeredHooks();
				const { actor, item } = commander(0);

				hooks.start(actor, null);
				await settle();

				expect(item.update).not.toHaveBeenCalled();
			});

			it('gives nothing more to a hero who rolled on this client before the start', async () => {
				const hooks = await registeredHooks();
				const { actor, item, current } = commander(0);
				await hooks.roll(actor);
				await vi.waitFor(() => expect(current()).toBe(2));
				const writes = item.update.mock.calls.length;

				hooks.start(actor, 12);
				await settle();

				expect(item.update).toHaveBeenCalledTimes(writes);
			});

			it('gives nothing to a hero whose mark names this combat', async () => {
				const hooks = await registeredHooks();
				const { actor, item } = commander(0);
				foundry.utils.setProperty(actor, 'flags.nimble.initiativeRecoveryCombat', 'combat-1');

				hooks.start(actor, 12);
				await settle();

				expect(item.update).not.toHaveBeenCalled();
			});

			it('gives nothing on a later roll to a hero refilled at the start', async () => {
				const hooks = await registeredHooks();
				const { actor, item, current } = commander(0);
				hooks.start(actor, 12);
				await vi.waitFor(() => expect(current()).toBe(2));
				const writes = item.update.mock.calls.length;

				await hooks.roll(actor);
				await settle();

				expect(item.update).toHaveBeenCalledTimes(writes);
			});
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
