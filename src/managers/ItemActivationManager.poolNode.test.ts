import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectNode, PoolNode } from '#types/effectTree.js';
import * as chargePoolRecoverModule from '../utils/chargePool/chargePoolRecover.js';
import * as dicePoolRefillModule from '../utils/dicePool/dicePoolRefill.js';
import { ItemActivationManager, testDependencies } from './ItemActivationManager.js';

// Spy on the helper module exports rather than vi.mock — the dispatcher
// calls these via the module namespace, so a spy on the module symbol
// intercepts cleanly without the hoisting / path-resolution gotchas of
// vi.mock on relative imports.
const mockRollDieIntoPool = vi
	.spyOn(dicePoolRefillModule, 'rollDieIntoPool')
	.mockResolvedValue({ applied: true, face: 4 });
const mockRollPoolFresh = vi.spyOn(dicePoolRefillModule, 'rollPoolFresh').mockResolvedValue(true);
const mockSetPoolFaces = vi.spyOn(dicePoolRefillModule, 'setPoolFaces').mockResolvedValue(true);
const mockAdjustPool = vi.spyOn(chargePoolRecoverModule, 'adjustPool').mockResolvedValue(true);

interface PoolMockActor {
	uuid: string;
	type: string;
	token: null;
	system: { savingThrows: Record<string, { mod: number }> };
	getRollData: () => Record<string, unknown>;
	getDomain: () => string[];
	items: { contents: Array<{ id: string; flags?: Record<string, unknown> }> };
	flags?: Record<string, unknown>;
}

function makeActor(level: number, options: Partial<PoolMockActor> = {}): PoolMockActor {
	return {
		uuid: 'actor-uuid',
		type: 'character',
		token: null,
		system: {
			savingThrows: {
				strength: { mod: 0 },
				dexterity: { mod: 0 },
				will: { mod: 0 },
				intelligence: { mod: 0 },
			},
		},
		getRollData: () => ({ level }),
		getDomain: () => [`level:${level}`],
		items: { contents: [] },
		...options,
	};
}

function makeItem(actor: PoolMockActor | null, effects: EffectNode[]) {
	return {
		type: 'feature',
		name: 'Test Pool Item',
		actor,
		system: { activation: { effects } },
	};
}

function poolNode(overrides: Partial<PoolNode>): PoolNode {
	return {
		id: overrides.id ?? 'pool-node-1',
		type: 'pool',
		poolType: overrides.poolType ?? 'dice',
		action: overrides.action ?? 'rollDie',
		poolIdentifier: overrides.poolIdentifier ?? 'fury',
		value: overrides.value ?? 1,
		predicate: overrides.predicate ?? {},
		suppressChat: overrides.suppressChat,
		parentContext: null,
		parentNode: null,
		result: overrides.result ?? null,
	};
}

describe('ItemActivationManager: pool effect node dispatch', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRollDieIntoPool.mockResolvedValue({ applied: true, face: 4 });
		mockRollPoolFresh.mockResolvedValue(true);
		mockSetPoolFaces.mockResolvedValue(true);
		mockAdjustPool.mockResolvedValue(true);
		// Ensure game.user.targets is iterable for the manager's _targets collection.
		const gameGlobal = globalThis as unknown as {
			game: { user: { targets?: unknown[] } };
		};
		gameGlobal.game.user.targets = [];
		// reconstructEffectsTree just returns its input so we can read mutated nodes back.
		testDependencies.reconstructEffectsTree = ((effects: EffectNode[]) => effects) as never;
	});

	function buildManager(actor: PoolMockActor | null, effects: EffectNode[]) {
		const item = makeItem(actor, effects);
		return new ItemActivationManager(
			item as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
			{ fastForward: true },
		);
	}

	async function runAndGetNode(actor: PoolMockActor | null, original: PoolNode): Promise<PoolNode> {
		const manager = buildManager(actor, [original]);
		const result = await manager.getData();
		const dispatched = (result.activation?.effects ?? []).find(
			(n: EffectNode) => n.id === original.id,
		);
		return dispatched as PoolNode;
	}

	describe('dice pools', () => {
		it('rollDie: invokes rollDieIntoPool once per value', async () => {
			const actor = makeActor(3);
			const out = await runAndGetNode(
				actor,
				poolNode({ poolType: 'dice', action: 'rollDie', value: 2 }),
			);

			expect(mockRollDieIntoPool).toHaveBeenCalledTimes(2);
			expect(mockRollDieIntoPool.mock.calls[0][1]).toBe('fury');
			expect(out.result?.applied).toBe(true);
		});

		it('rollDie: continues rolling even when the pool fills up so all rolls are surfaced (player decides what to keep)', async () => {
			// Old behavior was to short-circuit on the first at-max return; that
			// hid roll outcomes from the player. RAW: "roll as normal and
			// decide which ones to keep" — so every die must be rolled and
			// every face surfaced in the result for the chat card to display.
			mockRollDieIntoPool
				.mockResolvedValueOnce({ applied: true, face: 3 })
				.mockResolvedValueOnce({ applied: false, face: 2 })
				.mockResolvedValueOnce({ applied: false, face: 4 });
			const actor = makeActor(3);
			const out = await runAndGetNode(
				actor,
				poolNode({ poolType: 'dice', action: 'rollDie', value: 3 }),
			);

			expect(mockRollDieIntoPool).toHaveBeenCalledTimes(3);
			expect(out.result?.rolledFaces).toEqual([3, 2, 4]);
		});

		it('rollDie: at-max rolls are surfaced in rolledFaces so the chat card can show them (RAW Rage: "roll as normal and decide which ones to keep")', async () => {
			mockRollDieIntoPool
				.mockResolvedValueOnce({ applied: false, face: 3 })
				.mockResolvedValueOnce({ applied: false, face: 1 });
			const actor = makeActor(3);
			const out = await runAndGetNode(
				actor,
				poolNode({ poolType: 'dice', action: 'rollDie', value: 2 }),
			);

			expect(out.result?.applied).toBe(false);
			expect(out.result?.rolledFaces).toEqual([3, 1]);
		});

		it('rollPool: invokes rollPoolFresh exactly once', async () => {
			const actor = makeActor(3);
			await runAndGetNode(actor, poolNode({ poolType: 'dice', action: 'rollPool', value: 0 }));

			expect(mockRollPoolFresh).toHaveBeenCalledTimes(1);
			expect(mockRollDieIntoPool).not.toHaveBeenCalled();
		});

		it('rollDie/rollPool: defaults suppressChat to false (helper posts chat unless opted out)', async () => {
			// Effects without the opt-in keep posting a standalone roll card,
			// so the existing behavior for non-Rage features is unchanged.
			const actor = makeActor(3);

			await runAndGetNode(actor, poolNode({ poolType: 'dice', action: 'rollDie', value: 1 }));
			expect(mockRollDieIntoPool).toHaveBeenCalledWith(
				actor,
				'fury',
				expect.objectContaining({ suppressChat: false }),
			);

			await runAndGetNode(actor, poolNode({ poolType: 'dice', action: 'rollPool', value: 0 }));
			expect(mockRollPoolFresh).toHaveBeenCalledWith(
				actor,
				'fury',
				expect.objectContaining({ suppressChat: false }),
			);
		});

		it('rollDie/rollPool: forwards suppressChat=true when set on the node (Rage opts in)', async () => {
			// Features whose activation card already shows rolledFaces set
			// suppressChat on the effect node to avoid a duplicate roll card.
			const actor = makeActor(3);

			await runAndGetNode(
				actor,
				poolNode({ poolType: 'dice', action: 'rollDie', value: 1, suppressChat: true }),
			);
			expect(mockRollDieIntoPool).toHaveBeenCalledWith(
				actor,
				'fury',
				expect.objectContaining({ suppressChat: true }),
			);

			await runAndGetNode(
				actor,
				poolNode({ poolType: 'dice', action: 'rollPool', value: 0, suppressChat: true }),
			);
			expect(mockRollPoolFresh).toHaveBeenCalledWith(
				actor,
				'fury',
				expect.objectContaining({ suppressChat: true }),
			);
		});

		it('clear: invokes setPoolFaces with []', async () => {
			const actor = makeActor(3);
			await runAndGetNode(actor, poolNode({ poolType: 'dice', action: 'clear' }));

			expect(mockSetPoolFaces).toHaveBeenCalledWith(actor, 'fury', []);
		});

		it('fillCount on dice pool: not meaningful, marks invalidAction', async () => {
			const actor = makeActor(3);
			const out = await runAndGetNode(
				actor,
				poolNode({ poolType: 'dice', action: 'fillCount', value: 2 }),
			);

			expect(out.result?.applied).toBe(false);
			expect(out.result?.skipReason).toBe('invalidAction');
			expect(mockRollDieIntoPool).not.toHaveBeenCalled();
		});
	});

	describe('charge pools', () => {
		it('fillCount: invokes adjustPool with add mode', async () => {
			const actor = makeActor(3);
			await runAndGetNode(
				actor,
				poolNode({
					poolType: 'charge',
					action: 'fillCount',
					poolIdentifier: 'combat-dice',
					value: 3,
				}),
			);

			expect(mockAdjustPool).toHaveBeenCalledWith(actor, 'combat-dice', 'add', 3);
		});

		it('clear: invokes adjustPool with set mode and value 0', async () => {
			const actor = makeActor(3);
			await runAndGetNode(
				actor,
				poolNode({
					poolType: 'charge',
					action: 'clear',
					poolIdentifier: 'combat-dice',
				}),
			);

			expect(mockAdjustPool).toHaveBeenCalledWith(actor, 'combat-dice', 'set', 0);
		});

		it('rollDie on charge pool: not meaningful, marks invalidAction', async () => {
			const actor = makeActor(3);
			const out = await runAndGetNode(
				actor,
				poolNode({ poolType: 'charge', action: 'rollDie', value: 1 }),
			);

			expect(out.result?.applied).toBe(false);
			expect(out.result?.skipReason).toBe('invalidAction');
			expect(mockAdjustPool).not.toHaveBeenCalled();
		});
	});

	describe('predicate gating', () => {
		it('skips when predicate level.min is not satisfied', async () => {
			const actor = makeActor(2);
			const out = await runAndGetNode(
				actor,
				poolNode({
					poolType: 'dice',
					action: 'rollDie',
					predicate: { level: { min: 5 } },
				}),
			);

			expect(out.result?.applied).toBe(false);
			expect(out.result?.skipReason).toBe('predicate');
			expect(mockRollDieIntoPool).not.toHaveBeenCalled();
		});

		it('runs when predicate is satisfied', async () => {
			const actor = makeActor(7);
			await runAndGetNode(
				actor,
				poolNode({
					poolType: 'dice',
					action: 'rollDie',
					predicate: { level: { min: 5 } },
				}),
			);

			expect(mockRollDieIntoPool).toHaveBeenCalledTimes(1);
		});

		it('empty predicate always runs', async () => {
			const actor = makeActor(1);
			await runAndGetNode(actor, poolNode({ poolType: 'dice', action: 'rollDie', predicate: {} }));

			expect(mockRollDieIntoPool).toHaveBeenCalledTimes(1);
		});
	});

	describe('missing actor', () => {
		it('marks noActor and does not invoke helpers', async () => {
			const out = await runAndGetNode(null, poolNode({ poolType: 'dice', action: 'rollDie' }));

			expect(out.result?.applied).toBe(false);
			expect(out.result?.skipReason).toBe('noActor');
			expect(mockRollDieIntoPool).not.toHaveBeenCalled();
		});
	});
});
