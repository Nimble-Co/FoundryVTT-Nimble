import { beforeAll, describe, expect, it, vi } from 'vitest';

const getPools = vi.fn();
let findRequestedPool: typeof import('../findRequestedPool.js').findRequestedPool;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolSync.js', () => ({ getPools }));
	vi.doMock('../dicePoolSync.js', () => ({ getPools }));
	({ findRequestedPool } = await import('../findRequestedPool.js'));
});

const request = (poolIdentifier: string, poolScope: 'item' | 'actor' = 'item') => ({
	actorUuid: 'Actor.a',
	itemId: 'tayg',
	ruleId: 'r',
	poolIdentifier,
	poolScope,
});

describe('findRequestedPool', () => {
	const fury = { id: 'item:fury:rage', identifier: 'fury', scope: 'item', faces: [3] };
	const actorFury = { id: 'actor:fury', identifier: 'fury', scope: 'actor', faces: [] };

	it('matches the pool by identifier and scope', () => {
		getPools.mockReturnValue([actorFury, fury]);

		expect(findRequestedPool({} as Actor, request(' fury '))).toBe(fury);
		expect(findRequestedPool({} as Actor, request('fury', 'actor'))).toBe(actorFury);
	});

	it('gives null for no match or no identifier', () => {
		getPools.mockReturnValue([fury]);

		expect(findRequestedPool({} as Actor, request('rage'))).toBeNull();
		expect(findRequestedPool({} as Actor, request(''))).toBeNull();
	});
});
