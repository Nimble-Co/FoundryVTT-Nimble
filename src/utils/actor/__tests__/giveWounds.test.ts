import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { giveWounds, takeBackWounds, woundsGiven } from '../giveWounds.js';

const query = vi.fn();
let previousUsers: unknown;

function hero(value: number, { isOwner = true, max = 6 } = {}) {
	const actor = {
		uuid: 'Actor.tessa',
		name: 'Tessa',
		isOwner,
		system: { attributes: { wounds: { value, max } } },
		update: vi.fn(async (data: Record<string, unknown>) => {
			actor.system.attributes.wounds.value = data['system.attributes.wounds.value'] as number;
			return actor;
		}),
	};
	return actor;
}

beforeEach(() => {
	const g = game as unknown as { users: unknown };
	previousUsers = g.users;
	query.mockReset().mockResolvedValue({ actorName: 'Tessa', before: 1, after: 2 });
	g.users = { activeGM: { query } };
});

afterEach(() => {
	(game as unknown as { users: unknown }).users = previousUsers;
});

describe('giveWounds', () => {
	it('adds the Wounds to the track of a creature the user owns', async () => {
		const actor = hero(1);

		const record = await giveWounds(actor, 2);

		expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 3 });
		expect(record).toEqual({ actorName: 'Tessa', before: 1, after: 3 });
		expect(query).not.toHaveBeenCalled();
	});

	it('stops at the max, and still reports a creature whose track is full', async () => {
		const nearlyFull = hero(5);
		expect(await giveWounds(nearlyFull, 3)).toEqual({ actorName: 'Tessa', before: 5, after: 6 });
		expect(nearlyFull.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 6 });

		const full = hero(6);
		expect(await giveWounds(full, 1)).toEqual({ actorName: 'Tessa', before: 6, after: 6 });
		expect(full.update).not.toHaveBeenCalled();
	});

	it('changes nothing on a creature with no Wound track, and says so', async () => {
		const kobold = {
			uuid: 'Actor.kobold',
			name: 'Kobold',
			isOwner: false,
			system: { attributes: { hp: { value: 5 } } },
			update: vi.fn(),
		};

		expect(await giveWounds(kobold, 1)).toEqual({ actorName: 'Kobold', noTrack: true });
		expect(kobold.update).not.toHaveBeenCalled();
		expect(query).not.toHaveBeenCalled();
	});

	it('asks the active GM to give the Wounds to a creature the user does not own', async () => {
		const actor = hero(1, { isOwner: false });

		const record = await giveWounds(actor, 1);

		expect(actor.update).not.toHaveBeenCalled();
		expect(query).toHaveBeenCalledWith(expect.stringMatching(/\.giveWounds$/), {
			actorUuid: 'Actor.tessa',
			amount: 1,
		});
		expect(record).toEqual({ actorName: 'Tessa', before: 1, after: 2 });
	});

	it('gives nothing back when no GM is online to take the request', async () => {
		(game as unknown as { users: unknown }).users = { activeGM: null };

		expect(await giveWounds(hero(1, { isOwner: false }), 1)).toBeNull();
	});

	it('gives no Wound for an amount under 1', async () => {
		const actor = hero(1);

		expect(await giveWounds(actor, 0)).toBeNull();
		expect(actor.update).not.toHaveBeenCalled();
	});
});

describe('takeBackWounds', () => {
	it('takes the Wounds off, never below 0', async () => {
		const actor = hero(2);
		await takeBackWounds(actor, 1);
		expect(actor.update).toHaveBeenLastCalledWith({ 'system.attributes.wounds.value': 1 });

		await takeBackWounds(actor, 3);
		expect(actor.update).toHaveBeenLastCalledWith({ 'system.attributes.wounds.value': 0 });
	});

	it('reads what a gain gave: none for a full track or no track', () => {
		expect(woundsGiven({ actorName: 'Tessa', before: 5, after: 6 })).toBe(1);
		expect(woundsGiven({ actorName: 'Tessa', before: 6, after: 6 })).toBe(0);
		expect(woundsGiven({ actorName: 'Kobold', noTrack: true })).toBe(0);
		expect(woundsGiven(null)).toBe(0);
	});
});
