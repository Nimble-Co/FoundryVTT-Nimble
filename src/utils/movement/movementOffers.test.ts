import { describe, expect, it } from 'vitest';
import {
	buildMovementOfferId,
	type MovementOfferEntry,
	mergeMovementOfferEntry,
} from './movementOffers.js';

const entry: MovementOfferEntry = {
	id: 'm.n.t',
	nodeId: 'n',
	tokenUuid: 'Scene.s.Token.t',
	spaces: 4,
	used: true,
	usedBy: 'u1',
	movedSpaces: null,
	stopped: false,
};

describe('mergeMovementOfferEntry', () => {
	it('adds a new entry with defaults for what the patch omits', () => {
		const merged = mergeMovementOfferEntry([], { id: 'm.n.t', movedSpaces: 3, used: true });
		expect(merged).toEqual([
			{
				id: 'm.n.t',
				nodeId: '',
				tokenUuid: '',
				spaces: 0,
				used: true,
				usedBy: null,
				movedSpaces: 3,
				stopped: false,
			},
		]);
	});

	it('merges a result over a started entry without losing either side', () => {
		const merged = mergeMovementOfferEntry([entry], {
			id: entry.id,
			movedSpaces: 2,
			stopped: true,
		});
		expect(merged).toEqual([{ ...entry, movedSpaces: 2, stopped: true }]);
	});

	it('merges a late start over an early result', () => {
		const early = mergeMovementOfferEntry([], { id: entry.id, used: true, movedSpaces: 2 });
		const merged = mergeMovementOfferEntry(early, { ...entry, movedSpaces: undefined });
		expect(merged[0]).toMatchObject({ nodeId: 'n', spaces: 4, movedSpaces: 2, usedBy: 'u1' });
	});

	it('leaves other entries untouched', () => {
		const other = { ...entry, id: 'other' };
		const merged = mergeMovementOfferEntry([other, entry], { id: entry.id, stopped: true });
		expect(merged[0]).toBe(other);
	});
});

describe('buildMovementOfferId', () => {
	it('is stable for a message, node and token', () => {
		expect(buildMovementOfferId('m', 'n', 't')).toBe('m.n.t');
	});
});
