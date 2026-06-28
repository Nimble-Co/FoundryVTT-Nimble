import { describe, expect, it, vi } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

interface ActorStub {
	type: string;
	system: { toObject: ReturnType<typeof vi.fn> };
	sheet: { close: ReturnType<typeof vi.fn> };
	update: ReturnType<typeof vi.fn>;
}

const SYSTEM_SOURCE = { details: { level: 3 } };

function makeStub(type: string): ActorStub {
	return {
		type,
		system: { toObject: vi.fn().mockReturnValue(SYSTEM_SOURCE) },
		sheet: { close: vi.fn().mockResolvedValue(undefined) },
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
	it('force-replaces the system field when converting npc → minion', async () => {
		const stub = makeStub('npc');

		await convert(stub, 'minion');

		expect(stub.update).toHaveBeenCalledTimes(1);
		expect(stub.update).toHaveBeenCalledWith(
			{ type: 'minion', system: SYSTEM_SOURCE },
			{ diff: false, recursive: false },
		);
	});

	it('supports converting between any monster subtypes', async () => {
		const stub = makeStub('minion');

		await convert(stub, 'soloMonster');

		expect(stub.update).toHaveBeenCalledWith(
			{ type: 'soloMonster', system: SYSTEM_SOURCE },
			{ diff: false, recursive: false },
		);
	});

	it('closes the open sheet after converting so it re-renders for the new type', async () => {
		const stub = makeStub('npc');

		await convert(stub, 'minion');

		expect(stub.sheet.close).toHaveBeenCalledTimes(1);
	});

	it('is a no-op (no update) when the target type matches the current type', async () => {
		const stub = makeStub('minion');

		const result = await convert(stub, 'minion');

		expect(stub.update).not.toHaveBeenCalled();
		expect(stub.sheet.close).not.toHaveBeenCalled();
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
