import { describe, expect, it, vi } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

interface ActorStub {
	type: string;
	update: ReturnType<typeof vi.fn>;
}

function makeStub(type: string): ActorStub {
	return {
		type,
		update: vi.fn().mockResolvedValue(undefined),
	};
}

function convert(stub: ActorStub, targetType: string): Promise<unknown> {
	const fn = NimbleBaseActor.prototype.convertMonsterType;
	return fn.call(
		stub as unknown as InstanceType<typeof NimbleBaseActor>,
		targetType as Parameters<typeof fn>[0],
	);
}

describe('convertMonsterType', () => {
	it('changes the actor type via update when converting npc → minion', async () => {
		const stub = makeStub('npc');

		await convert(stub, 'minion');

		expect(stub.update).toHaveBeenCalledTimes(1);
		expect(stub.update).toHaveBeenCalledWith({ type: 'minion' });
	});

	it('supports converting between any monster subtypes', async () => {
		const stub = makeStub('minion');

		await convert(stub, 'soloMonster');

		expect(stub.update).toHaveBeenCalledWith({ type: 'soloMonster' });
	});

	it('is a no-op (no update) when the target type matches the current type', async () => {
		const stub = makeStub('minion');

		const result = await convert(stub, 'minion');

		expect(stub.update).not.toHaveBeenCalled();
		expect(result).toBe(stub);
	});

	it('throws when the source actor is not a monster subtype', async () => {
		const stub = makeStub('character');

		await expect(convert(stub, 'minion')).rejects.toThrow(
			'Cannot convert actor of type "character" to a monster subtype.',
		);
		expect(stub.update).not.toHaveBeenCalled();
	});
});
