import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rollSaveWithOwner } from '../rollSaveWithOwner.js';

const OWNER = 3;

function user(id: string, extra: object = {}) {
	return { id, active: true, isGM: false, isSelf: false, query: vi.fn(async () => true), ...extra };
}

function actor(owners: string[]) {
	return {
		uuid: 'Actor.target',
		testUserPermission: (who: { id: string }, level: number) =>
			level === OWNER && owners.includes(who.id),
		rollSavingThrowToChat: vi.fn(async () => ({ id: 'card' })),
	};
}

describe('rollSaveWithOwner', () => {
	const options = { dc: 13, cardFlags: { a: 1 } };
	let gm: ReturnType<typeof user>;

	beforeEach(() => {
		gm = user('gm', { isGM: true, isSelf: true });
		vi.stubGlobal('CONST', { DOCUMENT_OWNERSHIP_LEVELS: { OWNER } });
	});
	afterEach(() => vi.unstubAllGlobals());

	const withUsers = (...users: object[]) => {
		(game as unknown as { users: object[]; user: object }).users = [gm, ...users];
		(game as unknown as { user: object }).user = gm;
	};

	it('rolls here, with the dialog, for a creature with no player online', async () => {
		withUsers(user('player'), user('owner', { active: false }));
		const target = actor(['gm', 'owner']);

		await expect(rollSaveWithOwner(target as never, 'strength', options)).resolves.toBe(true);

		expect(target.rollSavingThrowToChat).toHaveBeenCalledWith('strength', options);
		expect(target.rollSavingThrowToChat.mock.calls[0]).not.toContainEqual(
			expect.objectContaining({ skipRollDialog: true }),
		);
	});

	it('asks the player who owns the creature to roll', async () => {
		const owner = user('owner');
		withUsers(owner);
		const target = actor(['gm', 'owner']);

		await expect(rollSaveWithOwner(target as never, 'strength', options)).resolves.toBe(true);

		expect(owner.query).toHaveBeenCalledWith(
			expect.stringContaining('rollSave'),
			{ actorUuid: 'Actor.target', saveKey: 'strength', options },
			expect.objectContaining({ timeout: expect.any(Number) }),
		);
		expect(target.rollSavingThrowToChat).not.toHaveBeenCalled();
	});

	it('says no when the dialog is closed with no roll', async () => {
		withUsers();
		const target = actor(['gm']);
		target.rollSavingThrowToChat.mockResolvedValue(null as never);

		await expect(rollSaveWithOwner(target as never, 'strength', options)).resolves.toBe(false);
	});
});
