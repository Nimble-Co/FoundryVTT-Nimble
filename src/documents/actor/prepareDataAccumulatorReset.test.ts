import { describe, expect, it, vi } from 'vitest';
import { actorAccumulatorPaths } from '../../models/rules/accumulatorRegistry.js';
import { NimbleBaseRule } from '../../models/rules/base.js';
import { NimbleBaseActor } from './base.svelte.js';

interface ActorStub {
	initialized: boolean;
	system: Record<string, unknown>;
	rules: { afterPrepareData(): void }[];
	reset(): void;
	_onBeforePrepareData(): void;
	_onAfterPrepareData(): void;
}

function makeStub(overrides: Partial<ActorStub> = {}): ActorStub {
	return {
		initialized: false,
		system: {},
		rules: [],
		reset: vi.fn(),
		_onBeforePrepareData: vi.fn(),
		_onAfterPrepareData: vi.fn(),
		...overrides,
	};
}

/**
 * Rule stand-in that accumulates through the real `pushToActorSystemArray`,
 * so the path registration the actor's reset depends on happens for real.
 */
function makeAccumulatingRule(actor: ActorStub, path: string, entry: unknown) {
	const push = (
		NimbleBaseRule.prototype as unknown as {
			pushToActorSystemArray(path: string, entry: unknown): void;
		}
	).pushToActorSystemArray;

	return {
		afterPrepareData() {
			push.call({ item: { actor } } as unknown as NimbleBaseRule, path, entry);
		},
	};
}

function runPrepareData(stub: ActorStub): void {
	NimbleBaseActor.prototype.prepareData.call(
		stub as unknown as InstanceType<typeof NimbleBaseActor>,
	);
}

/** Stand in for what `_initialize` does before every real prepare cycle. */
function reinitialize(stub: ActorStub): void {
	stub.initialized = false;
}

describe('prepareData — re-entry guard', () => {
	it('re-initializes instead of running the cycle again on an already-prepared actor', () => {
		const stub = makeStub();
		const rule = { afterPrepareData: vi.fn() };
		stub.rules = [rule];

		runPrepareData(stub);
		expect(rule.afterPrepareData).toHaveBeenCalledTimes(1);
		expect(stub.reset).not.toHaveBeenCalled();

		// A bare second call must not re-run the rule hooks over the already-derived
		// `system` object — read-modify-write bonuses would stack twice.
		runPrepareData(stub);
		expect(stub.reset).toHaveBeenCalledTimes(1);
		expect(rule.afterPrepareData).toHaveBeenCalledTimes(1);
	});

	it('runs the subclass hooks around the cycle exactly once', () => {
		const stub = makeStub();

		runPrepareData(stub);

		expect(stub._onBeforePrepareData).toHaveBeenCalledTimes(1);
		expect(stub._onAfterPrepareData).toHaveBeenCalledTimes(1);
	});
});

describe('prepareData — rule accumulator reset', () => {
	it('does not duplicate accumulator entries across prepare cycles on the same system object', () => {
		const stub = makeStub();
		stub.rules = [makeAccumulatingRule(stub, 'damageReductions', { value: 3, damageTypes: [] })];

		runPrepareData(stub);
		reinitialize(stub);
		runPrepareData(stub);

		expect(stub.system.damageReductions).toEqual([{ value: 3, damageTypes: [] }]);
	});

	it('resets every registered accumulator path, not just the first', () => {
		const stub = makeStub();
		stub.rules = [
			makeAccumulatingRule(stub, 'damageReductions', { value: 3, damageTypes: [] }),
			makeAccumulatingRule(stub, 'damageBonuses', { value: 2, damageTypes: [] }),
		];

		runPrepareData(stub);
		reinitialize(stub);
		runPrepareData(stub);

		expect(stub.system.damageReductions).toHaveLength(1);
		expect(stub.system.damageBonuses).toHaveLength(1);
	});

	it('leaves accumulator paths the actor never populated undefined', () => {
		actorAccumulatorPaths.add('neverPopulated');
		const stub = makeStub();

		runPrepareData(stub);

		expect(stub.system.neverPopulated).toBeUndefined();
	});
});
