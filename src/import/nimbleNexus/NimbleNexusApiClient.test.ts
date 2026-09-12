import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachCreators, getMonsterById, searchMonsters } from './NimbleNexusApiClient.js';
import type {
	NimbleNexusIncludedResource,
	NimbleNexusMonster,
	NimbleNexusMonsterAttributes,
} from './types.js';

function monster(id: string, creatorId?: string | null): NimbleNexusMonster {
	return {
		type: 'monsters',
		id,
		attributes: { name: id } as NimbleNexusMonsterAttributes,
		...(creatorId === undefined
			? {}
			: { relationships: { creator: { data: creatorId && { type: 'users', id: creatorId } } } }),
	} as NimbleNexusMonster;
}

const user: NimbleNexusIncludedResource = {
	type: 'users',
	id: 'user-1',
	attributes: {
		username: 'jao7371',
		displayName: '(jao)',
		imageUrl: 'https://cdn.example/avatar.png',
	},
};

function mockFetchOnce(body: unknown): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		statusText: 'OK',
		json: async () => body,
	});

	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('attachCreators', () => {
	it('attaches the creator named by the relationship', () => {
		const [result] = attachCreators([monster('m1', 'user-1')], [user]);

		expect(result.creator).toEqual({
			username: 'jao7371',
			displayName: '(jao)',
			imageUrl: 'https://cdn.example/avatar.png',
		});
	});

	it('shares one included creator across every monster that references it', () => {
		const results = attachCreators([monster('m1', 'user-1'), monster('m2', 'user-1')], [user]);

		expect(results.map((m) => m.creator?.username)).toEqual(['jao7371', 'jao7371']);
	});

	it('leaves the creator unset when the monster has no relationship', () => {
		const [result] = attachCreators([monster('m1')], [user]);

		expect(result.creator).toBeUndefined();
	});

	it('leaves the creator unset when the relationship data is null', () => {
		const [result] = attachCreators([monster('m1', null)], [user]);

		expect(result.creator).toBeUndefined();
	});

	it('leaves the creator unset when nothing was side-loaded', () => {
		const [result] = attachCreators([monster('m1', 'user-1')], undefined);

		expect(result.creator).toBeUndefined();
	});

	it('ignores an included resource of another type that shares the id', () => {
		const family: NimbleNexusIncludedResource = {
			type: 'families',
			id: 'user-1',
			attributes: { name: 'Goblins' },
		};

		const [result] = attachCreators([monster('m1', 'user-1')], [family]);

		expect(result.creator).toBeUndefined();
	});

	it('coerces missing name fields to empty strings', () => {
		const nameless: NimbleNexusIncludedResource = { type: 'users', id: 'user-1', attributes: {} };

		const [result] = attachCreators([monster('m1', 'user-1')], [nameless]);

		expect(result.creator).toEqual({ username: '', displayName: '', imageUrl: undefined });
	});

	it('does not mutate the monster it was given', () => {
		const original = monster('m1', 'user-1');

		attachCreators([original], [user]);

		expect(original.creator).toBeUndefined();
	});
});

describe('searchMonsters', () => {
	it('asks the API to side-load creators', async () => {
		const fetchMock = mockFetchOnce({ data: [] });

		await searchMonsters();

		expect(fetchMock.mock.calls[0][0]).toContain('include=creator');
	});

	it('keeps a caller-supplied include and adds creator to it', async () => {
		const fetchMock = mockFetchOnce({ data: [] });

		await searchMonsters({ include: ['families'] });

		expect(decodeURIComponent(fetchMock.mock.calls[0][0] as string)).toContain(
			'include=families,creator',
		);
	});

	it('does not ask for creator twice', async () => {
		const fetchMock = mockFetchOnce({ data: [] });

		await searchMonsters({ include: ['creator'] });

		expect(decodeURIComponent(fetchMock.mock.calls[0][0] as string)).toContain('include=creator');
	});

	it('attaches creators to the monsters it returns', async () => {
		mockFetchOnce({ data: [monster('m1', 'user-1')], included: [user] });

		const response = await searchMonsters();

		expect(response.data[0].creator?.displayName).toBe('(jao)');
	});
});

describe('getMonsterById', () => {
	it('asks the API to side-load the creator', async () => {
		const fetchMock = mockFetchOnce({ data: monster('m1', 'user-1'), included: [user] });

		await getMonsterById('m1');

		expect(fetchMock.mock.calls[0][0]).toContain('include=creator');
	});

	it('attaches the creator to the monster it returns', async () => {
		mockFetchOnce({ data: monster('m1', 'user-1'), included: [user] });

		const result = await getMonsterById('m1');

		expect(result.creator?.username).toBe('jao7371');
	});
});
