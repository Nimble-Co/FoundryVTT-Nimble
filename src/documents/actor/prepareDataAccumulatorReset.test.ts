import { describe, expect, it } from 'vitest';
import { actorAccumulatorPaths } from '../../models/rules/accumulatorRegistry.js';
import { NimbleBaseRule } from '../../models/rules/base.js';
import { NimbleBaseActor } from './base.svelte.js';

interface ActorStub {
	initialized: boolean;
	system: Record<string, unknown>;
	rules: { afterPrepareData(): void }[];
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

describe('prepareData — rule accumulator reset', () => {
	it('does not duplicate accumulator entries when prepareData runs twice on the same system object', () => {
		const stub: ActorStub = { initialized: false, system: {}, rules: [] };
		stub.rules = [makeAccumulatingRule(stub, 'damageReductions', { value: 3, damageTypes: [] })];

		runPrepareData(stub);
		runPrepareData(stub);

		expect(stub.system.damageReductions).toEqual([{ value: 3, damageTypes: [] }]);
	});

	it('resets every registered accumulator path, not just the first', () => {
		const stub: ActorStub = { initialized: false, system: {}, rules: [] };
		stub.rules = [
			makeAccumulatingRule(stub, 'damageReductions', { value: 3, damageTypes: [] }),
			makeAccumulatingRule(stub, 'damageBonuses', { value: 2, damageTypes: [] }),
		];

		runPrepareData(stub);
		runPrepareData(stub);

		expect(stub.system.damageReductions).toHaveLength(1);
		expect(stub.system.damageBonuses).toHaveLength(1);
	});

	it('leaves accumulator paths the actor never populated undefined', () => {
		actorAccumulatorPaths.add('neverPopulated');
		const stub: ActorStub = { initialized: false, system: {}, rules: [] };

		runPrepareData(stub);

		expect(stub.system.neverPopulated).toBeUndefined();
	});
});
