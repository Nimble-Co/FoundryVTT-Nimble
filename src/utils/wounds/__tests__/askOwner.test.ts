import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askOwner } from '../askOwner.js';

const OWNER = 3;

function user(id: string, extra: object = {}) {
	return { id, active: true, isGM: false, query: vi.fn(async () => true), ...extra };
}

function creature(owners: string[]) {
	return {
		uuid: 'Actor.hunter',
		testUserPermission: (who: { id: string }, level: number) =>
			level === OWNER && owners.includes(who.id),
	};
}

describe('askOwner', () => {
	const question = { kind: 'pending', name: 'Shield', count: 1 } as const;
	let gm: ReturnType<typeof user>;
	let confirm: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		gm = user('gm', { isGM: true });
		confirm = vi.fn(async () => true);
		vi.stubGlobal('CONST', { DOCUMENT_OWNERSHIP_LEVELS: { OWNER } });
		(foundry.applications as unknown as { api: object }).api = { DialogV2: { confirm } };
	});
	afterEach(() => vi.unstubAllGlobals());

	const withUsers = (self: object, ...others: object[]) => {
		(game as unknown as { users: object[] }).users = [self, ...others];
		(game as unknown as { user: object }).user = self;
	};

	it('asks the player who owns the creature, not the GM', async () => {
		const owner = user('owner');
		withUsers(gm, owner);

		await expect(askOwner(creature(['owner']) as never, question)).resolves.toBe(true);

		expect(owner.query).toHaveBeenCalledWith(
			expect.stringContaining('askOwner'),
			{ question },
			expect.objectContaining({ timeout: expect.any(Number) }),
		);
		expect(confirm).not.toHaveBeenCalled();
	});

	it('asks here when no player who owns the creature is online', async () => {
		withUsers(gm, user('owner', { active: false }));

		await expect(askOwner(creature(['owner']) as never, question)).resolves.toBe(true);

		expect(confirm).toHaveBeenCalledOnce();
	});

	it('asks here when this user is the owner', async () => {
		const owner = user('owner');
		withUsers(owner, gm);

		await askOwner(creature(['owner']) as never, question);

		expect(owner.query).not.toHaveBeenCalled();
		expect(confirm).toHaveBeenCalledOnce();
	});

	it('asks here when this user is one of two players who own the creature', async () => {
		const other = user('other');
		const self = user('self');
		withUsers(self, other, gm);
		(game as unknown as { users: object[] }).users = [other, self, gm];

		await askOwner(creature(['other', 'self']) as never, question);

		expect(other.query).not.toHaveBeenCalled();
		expect(confirm).toHaveBeenCalledOnce();
	});

	it('is a no when the owner does not answer', async () => {
		const owner = user('owner', { query: vi.fn(async () => Promise.reject(new Error('timeout'))) });
		withUsers(gm, owner);

		await expect(askOwner(creature(['owner']) as never, question)).resolves.toBe(false);
	});

	it('is a no when the dialog is closed', async () => {
		withUsers(gm);
		confirm.mockResolvedValue(null);

		await expect(askOwner(creature([]) as never, question)).resolves.toBe(false);
	});
});
