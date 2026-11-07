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

	describe('pools that recover at the start of a turn', () => {
		type PoolSpec = { identifier: string; trigger: string };

		/** A pool write lands one tick later, as a server reply does. */
		function createHeroWithPools(pools: PoolSpec[]) {
			const stored: Record<string, { current: number; max: number; recoveries: [] }> = {};
			for (const pool of pools) stored[pool.identifier] = { current: 0, max: 1, recoveries: [] };
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
				flags: { nimble: { chargePools: stored } },
				rules: new Map(
					pools.map((pool, index) => [
						String(index),
						{
							type: 'chargePool',
							id: pool.identifier,
							identifier: pool.identifier,
							scope: 'item',
							max: '1',
							initial: 'max',
							recoveries: [{ trigger: pool.trigger, mode: 'refresh', value: '1' }],
						},
					]),
				),
				update: vi.fn(async (changes: Record<string, unknown>) => {
					const payload = structuredClone(changes['flags.nimble.chargePools']);
					await new Promise((resolve) => setTimeout(resolve, 0));
					Object.assign(stored, payload);
				}),
			};
			actor.items = { contents: [item], get: () => item };
			const current = (identifier: string) => stored[identifier].current;
			return { actor, item, current };
		}

		function createCombatant(type: 'character' | 'npc', actor: unknown, id: string) {
			return { id, type, actor } as unknown as Combatant.Implementation;
		}

		function createTurnOf(type: 'character' | 'npc', heroes: unknown[]) {
			const monster = createCombatant('npc', { type: 'npc' }, 'combatant-npc');
			const entries = heroes.map((actor, index) =>
				createCombatant('character', actor, `combatant-hero-${index}`),
			);
			const combat = createMockCombat('combat-1', [...entries, monster], true, 1);
			for (const entry of [...entries, monster]) Object.assign(entry, { parent: combat });
			return type === 'npc' ? monster : entries[0];
		}

		async function registerTurnStart() {
			vi.resetModules();
			const callbacks = createHookCapture(globals().Hooks.on);
			const { registerTurnTriggerHooks } = await import('../turnTrigger.js');
			registerTurnTriggerHooks();
			const start = callbacks.get('nimbleCombatTurnStart');
			const end = callbacks.get('nimbleCombatTurnEnd');
			expect(start).toBeDefined();
			expect(end).toBeDefined();
			return {
				start: start as (combatant: unknown) => void,
				end: end as (combatant: unknown) => void,
			};
		}

		const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

		describe("at the start of another creature's turn", () => {
			it('recovers a pool that recovers at the start of each turn', async () => {
				const hooks = await registerTurnStart();
				const { actor, current } = createHeroWithPools([
					{ identifier: 'use', trigger: 'onAnyTurnStart' },
				]);

				hooks.start(createTurnOf('npc', [actor]));

				await vi.waitFor(() => expect(current('use')).toBe(1));
			});

			it('does not recover a pool that recovers only on its own turn', async () => {
				const hooks = await registerTurnStart();
				const { actor, current } = createHeroWithPools([
					{ identifier: 'use', trigger: 'onTurnStart' },
				]);

				hooks.start(createTurnOf('npc', [actor]));
				await settle();

				expect(current('use')).toBe(0);
			});

			it('recovers a hero with two combatants one time', async () => {
				const hooks = await registerTurnStart();
				const { actor, item } = createHeroWithPools([
					{ identifier: 'use', trigger: 'onAnyTurnStart' },
				]);

				hooks.start(createTurnOf('npc', [actor, actor]));
				await settle();

				expect(item.update).toHaveBeenCalledTimes(1);
			});

			it('does not recover at the end of a turn', async () => {
				const hooks = await registerTurnStart();
				const { actor, current } = createHeroWithPools([
					{ identifier: 'use', trigger: 'onAnyTurnStart' },
				]);

				hooks.end(createTurnOf('npc', [actor]));
				await settle();

				expect(current('use')).toBe(0);
			});
		});

		describe("at the start of the hero's own turn", () => {
			it('recovers both its own turn pool and its each turn pool', async () => {
				const hooks = await registerTurnStart();
				const { actor, current } = createHeroWithPools([
					{ identifier: 'use', trigger: 'onAnyTurnStart' },
					{ identifier: 'own', trigger: 'onTurnStart' },
				]);

				hooks.start(createTurnOf('character', [actor]));

				await vi.waitFor(() => {
					expect(current('use')).toBe(1);
					expect(current('own')).toBe(1);
				});
				await settle();
				expect([current('use'), current('own')]).toEqual([1, 1]);
			});
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
