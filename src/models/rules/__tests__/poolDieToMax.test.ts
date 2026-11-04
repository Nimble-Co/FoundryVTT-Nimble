import { afterEach, describe, expect, it, vi } from 'vitest';

const { maximizePoolDie } = vi.hoisted(() => ({ maximizePoolDie: vi.fn(async () => undefined) }));

async function make(data: object, parent: object = { isEmbedded: true, name: 'Feature' }) {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ maximizePoolDie }));
	vi.doMock('#utils/dicePool/dicePoolSync.js', () => ({
		getPools: () => [{ id: 'p1', identifier: 'judgment' }],
	}));
	const { PoolDieToMaxRule } = await import('../poolDieToMax.js');
	const rule = new PoolDieToMaxRule(
		{ type: 'poolDieToMax' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, data);
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => ({ uuid: 'Actor.a' }), configurable: true });
	return rule;
}

describe('Pool Die To Max rule', () => {
	afterEach(() => {
		maximizePoolDie.mockClear();
		vi.doUnmock('#utils/dicePool/dicePoolRefill.js');
		vi.doUnmock('#utils/dicePool/dicePoolSync.js');
	});

	it('raises the given count of the named pool', async () => {
		const rule = await make({ poolIdentifier: ' judgment ' });

		await rule.raiseDice(2);

		expect(maximizePoolDie).toHaveBeenCalledWith({ uuid: 'Actor.a' }, 'p1', 2);
	});

	it('raises nothing for a pool the hero does not have', async () => {
		const rule = await make({ poolIdentifier: 'other' });

		await rule.raiseDice(1);

		expect(maximizePoolDie).not.toHaveBeenCalled();
	});

	it('raises nothing on an item that no hero holds', async () => {
		const rule = await make({ poolIdentifier: 'judgment' }, { isEmbedded: false });

		await rule.raiseDice(1);

		expect(maximizePoolDie).not.toHaveBeenCalled();
	});
});
