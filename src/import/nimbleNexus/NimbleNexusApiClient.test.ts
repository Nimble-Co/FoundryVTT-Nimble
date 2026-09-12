import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMonsterById, searchMonsters } from './NimbleNexusApiClient.js';
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

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): string {
	return decodeURIComponent(fetchMock.mock.calls[0][0] as string);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('searchMonsters include handling', () => {
	it('asks the API to side-load creators', async () => {
		const fetchMock = mockFetchOnce({ data: [] });

		await searchMonsters();

		expect(requestedUrl(fetchMock)).toContain('include=creator');
	});

	it('keeps a caller-supplied include and adds creator to it', async () => {
		const fetchMock = mockFetchOnce({ data: [] });

		await searchMonsters({ include: ['families'] });

		expect(requestedUrl(fetchMock)).toContain('include=families,creator');
	});

	it('does not ask for creator twice', async () => {
		const fetchMock = mockFetchOnce({ data: [] });

		await searchMonsters({ include: ['creator'] });

		expect(requestedUrl(fetchMock)).toContain('include=creator');
	});
});

describe('searchMonsters creator resolution', () => {
	it('attaches the creator named by the relationship', async () => {
		mockFetchOnce({ data: [monster('m1', 'user-1')], included: [user] });

		const response = await searchMonsters();

		expect(response.data[0].creator).toEqual({ username: 'jao7371', displayName: '(jao)' });
	});

	it('shares one included creator across every monster that references it', async () => {
		mockFetchOnce({ data: [monster('m1', 'user-1'), monster('m2', 'user-1')], included: [user] });

		const response = await searchMonsters();

		expect(response.data.map((m) => m.creator?.username)).toEqual(['jao7371', 'jao7371']);
	});

	it('leaves the creator unset when the monster has no relationship', async () => {
		mockFetchOnce({ data: [monster('m1')], included: [user] });

		const response = await searchMonsters();

		expect(response.data[0].creator).toBeUndefined();
	});

	it('leaves the creator unset when the relationship data is null', async () => {
		mockFetchOnce({ data: [monster('m1', null)], included: [user] });

		const response = await searchMonsters();

		expect(response.data[0].creator).toBeUndefined();
	});

	it('leaves the creator unset when nothing was side-loaded', async () => {
		mockFetchOnce({ data: [monster('m1', 'user-1')] });

		const response = await searchMonsters();

		expect(response.data[0].creator).toBeUndefined();
	});

	it('ignores an included resource of another type that shares the id', async () => {
		const family: NimbleNexusIncludedResource = {
			type: 'families',
			id: 'user-1',
			attributes: { name: 'Goblins' },
		};

		mockFetchOnce({ data: [monster('m1', 'user-1')], included: [family] });

		const response = await searchMonsters();

		expect(response.data[0].creator).toBeUndefined();
	});

	it('coerces missing name fields to empty strings', async () => {
		const nameless: NimbleNexusIncludedResource = { type: 'users', id: 'user-1', attributes: {} };

		mockFetchOnce({ data: [monster('m1', 'user-1')], included: [nameless] });

		const response = await searchMonsters();

		expect(response.data[0].creator).toEqual({ username: '', displayName: '' });
	});

	it('does not keep the avatar url, which no surface renders', async () => {
		mockFetchOnce({ data: [monster('m1', 'user-1')], included: [user] });

		const response = await searchMonsters();

		expect(response.data[0].creator).not.toHaveProperty('imageUrl');
	});
});

describe('getMonsterById', () => {
	it('asks the API to side-load the creator', async () => {
		const fetchMock = mockFetchOnce({ data: monster('m1', 'user-1'), included: [user] });

		await getMonsterById('m1');

		expect(requestedUrl(fetchMock)).toContain('include=creator');
	});

	it('attaches the creator to the monster it returns', async () => {
		mockFetchOnce({ data: monster('m1', 'user-1'), included: [user] });

		const result = await getMonsterById('m1');

		expect(result.creator?.username).toBe('jao7371');
	});
});
