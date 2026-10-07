import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardCreature } from '#types/movement.js';
import { movementCardWhisper } from './movementCardWhisper.js';

const gm = { id: 'gm', isGM: true };
const assistant = { id: 'assistant', isGM: true };
const alice = { id: 'alice', isGM: false };
const bob = { id: 'bob', isGM: false };

const { OWNER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

function ownedBy(...owners: string[]): CardCreature {
	return {
		testUserPermission: (user: { id: string }, permission: number) =>
			permission === OWNER && owners.includes(user.id),
	} as unknown as CardCreature;
}

function postAs(user: { id: string } | null, users: unknown = [gm, assistant, alice, bob]) {
	vi.stubGlobal('game', { ...game, user, users });
}

describe('movementCardWhisper', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('goes to every GM and to the players who own the creature', () => {
		postAs(gm);
		expect(movementCardWhisper([ownedBy('alice')])).toEqual(['gm', 'assistant', 'alice']);
	});

	it('names the owner of each creature once', () => {
		postAs(gm);
		expect(movementCardWhisper([ownedBy('alice'), ownedBy('alice', 'bob')])).toEqual([
			'gm',
			'assistant',
			'alice',
			'bob',
		]);
	});

	it('goes to the GMs alone when no player owns a creature', () => {
		postAs(gm);
		expect(movementCardWhisper([ownedBy()])).toEqual(['gm', 'assistant']);
	});

	it('always names the user who posts the card', () => {
		postAs(bob);
		expect(movementCardWhisper([ownedBy('alice')])).toEqual(['gm', 'assistant', 'alice', 'bob']);
	});

	it('ignores a creature that is not there', () => {
		postAs(gm);
		expect(movementCardWhisper([null, undefined, ownedBy('alice')])).toEqual([
			'gm',
			'assistant',
			'alice',
		]);
	});

	it('skips a user with no id', () => {
		postAs(gm, [gm, { id: null, isGM: true }, alice]);
		expect(movementCardWhisper([ownedBy('alice')])).toEqual(['gm', 'alice']);
	});

	it('names only the author when the user list is not there', () => {
		postAs(alice, null);
		expect(movementCardWhisper([ownedBy('alice')])).toEqual(['alice']);
	});
});
