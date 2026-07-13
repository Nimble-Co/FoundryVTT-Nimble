import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rollDieIntoPool } from './dicePoolRefill.js';
import { isDicePoolFlagUpdate, syncActorPools } from './dicePoolSync.js';
import type { CharacterActorLike } from './types.js';

/**
 * Reproduction for the Oathsworn "Judgment Dice" bug: clicking the dashed "+"
 * chip rolls a die (visible in chat) but the face never lands in the pool.
 *
 * Drives the REAL rollDieIntoPool -> persistDicePoolMap -> item.update path and
 * reads the face back the way getDicePoolMapFromActor does
 * (item.flags.nimble.dicePools[identifier].faces).
 */

beforeEach(() => {
	const BaseRoll = (globalThis as unknown as { Roll: any }).Roll;
	class StubRoll extends BaseRoll {
		dice: unknown[] = [];
		async evaluate(): Promise<this> {
			await super.evaluate();
			(this as unknown as { _total: number })._total = 4;
			return this;
		}
		async toMessage(): Promise<void> {}
	}
	(globalThis as unknown as { Roll: unknown }).Roll = StubRoll;
	(globalThis as unknown as { ChatMessage: unknown }).ChatMessage = {
		getSpeaker: () => ({}),
	};
});

/**
 * Models FoundryVTT Document#update for `flags.*` writes with the real-engine
 * defaults that matter here: `diff: true` and `recursive: true`.
 *
 *   1. expandObject(changes) — dotted keys become nested objects.
 *   2. diff against the current source: subtrees that are deep-equal are dropped
 *      (Foundry skips no-op writes); ARRAYS are compared atomically.
 *   3. recursive merge of the surviving diff into the source.
 *
 * This is the behavior that decides whether a "whole pool object under the
 * parent flag path" write actually lands.
 */
function expand(obj: Record<string, any>): Record<string, any> {
	const out: Record<string, any> = {};
	for (const [key, value] of Object.entries(obj)) {
		const keys = key.split('.');
		let cursor = out;
		for (let i = 0; i < keys.length - 1; i += 1) {
			cursor[keys[i]] ??= {};
			cursor = cursor[keys[i]];
		}
		cursor[keys[keys.length - 1]] = value;
	}
	return out;
}

function isPlain(v: unknown): v is Record<string, any> {
	return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Recursive merge with diff=true: skip deep-equal leaves, honor `-=` deletes. */
function mergeDiff(target: Record<string, any>, source: Record<string, any>): void {
	for (const [key, value] of Object.entries(source)) {
		if (key.startsWith('-=')) {
			delete target[key.slice(2)];
			continue;
		}
		if (isPlain(value)) {
			if (!isPlain(target[key])) target[key] = {};
			mergeDiff(target[key], value);
		} else {
			// diff: true — don't rewrite identical values.
			if (deepEqual(target[key], value)) continue;
			target[key] = value;
		}
	}
}

function applyFoundryUpdate(doc: Record<string, any>, changes: Record<string, any>): void {
	mergeDiff(doc, expand(changes));
}

function makeOathswornActor(): {
	actor: CharacterActorLike;
	item: Record<string, any>;
	updateSpy: ReturnType<typeof vi.fn>;
} {
	const judgmentRule = {
		type: 'dicePool',
		disabled: false,
		id: 'judgment-pool-base',
		identifier: 'judgment',
		label: 'Judgment Dice',
		scope: 'item',
		dieSize: 'd6',
		max: '2',
		initial: 'zero',
		refills: [
			{ trigger: 'onAttacked', mode: 'setIfEmpty', value: '@poolMax' },
			{ trigger: 'encounterEnd', mode: 'clear', value: '0' },
		],
	};

	const updateSpy = vi.fn();
	const item: Record<string, any> = {
		id: 'qiQeJrIxla9y6XY0',
		name: 'Radiant Judgement',
		rules: new Map([['0', judgmentRule]]),
		flags: {},
		actor: null,
		async update(changes: Record<string, any>, options?: Record<string, any>) {
			updateSpy(changes, options);
			applyFoundryUpdate(this as Record<string, any>, changes);
			if (!isDicePoolFlagUpdate(options) && this.actor?.type === 'character') {
				await syncActorPools(this.actor);
			}
			return this;
		},
	};

	const actor = {
		type: 'character',
		items: { contents: [item], get: () => item },
		flags: {},
		getRollData: vi.fn(() => ({})),
	} as unknown as CharacterActorLike;
	item.actor = actor;

	return { actor, item, updateSpy };
}

describe('rollDieIntoPool — item-scoped pool persistence (Judgment Dice)', () => {
	it('lands the rolled face in item.flags.nimble.dicePools.judgment.faces (empty pool)', async () => {
		const { actor, item, updateSpy } = makeOathswornActor();

		const result = await rollDieIntoPool(actor, 'judgment', { flavor: 'Judgment Dice' });

		expect(result).toEqual({ applied: true, face: 4 });
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(item.flags?.nimble?.dicePools?.judgment?.faces).toEqual([4]);
	});

	it('at max: rolls a face but does not modify the pool. Returns applied: false with the face value', async () => {
		// RAW (Berserker Rage): "If you are already at your max, roll as
		// normal and decide which ones to keep." The helper must surface the
		// face so the caller (chat card / activation manager / widget) can
		// display the roll and let the player choose what to do.
		const { actor, item, updateSpy } = makeOathswornActor();
		item.flags = {
			nimble: {
				dicePools: {
					judgment: {
						id: 'judgment',
						identifier: 'judgment',
						scope: 'item',
						sourceItemId: 'qiQeJrIxla9y6XY0',
						sourceItemName: 'Radiant Judgement',
						label: 'Judgment Dice',
						dieSize: 'd6',
						max: 2,
						faces: [5, 6],
						refills: [],
						consumption: 'manual',
						bonusOnAttackDelivery: null,
					},
				},
			},
		};

		const result = await rollDieIntoPool(actor, 'judgment', { flavor: 'Judgment Dice' });

		expect(result).toEqual({ applied: false, face: 4 });
		expect(updateSpy).not.toHaveBeenCalled();
		expect(item.flags?.nimble?.dicePools?.judgment?.faces).toEqual([5, 6]);
	});

	it('adds a second face when the pool already has one (faces array grows)', async () => {
		const { actor, item } = makeOathswornActor();
		// Seed an existing single-die pool (as an onAttacked setIfEmpty refill would).
		item.flags = {
			nimble: {
				dicePools: {
					judgment: {
						id: 'judgment',
						identifier: 'judgment',
						scope: 'item',
						sourceItemId: 'qiQeJrIxla9y6XY0',
						sourceItemName: 'Radiant Judgement',
						label: 'Judgment Dice',
						dieSize: 'd6',
						max: 2,
						faces: [5],
						refills: [
							{ trigger: 'onAttacked', mode: 'setIfEmpty', value: '@poolMax' },
							{ trigger: 'encounterEnd', mode: 'clear', value: '0' },
						],
						consumption: 'manual',
						bonusOnAttackDelivery: null,
					},
				},
			},
		};

		const result = await rollDieIntoPool(actor, 'judgment', { flavor: 'Judgment Dice' });

		expect(result).toEqual({ applied: true, face: 4 });
		expect(item.flags?.nimble?.dicePools?.judgment?.faces).toEqual([5, 4]);
	});
});
