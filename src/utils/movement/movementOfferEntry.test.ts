import { describe, expect, it } from 'vitest';
import { buildMovementOfferId, mergeMovementOfferEntry } from './movementOfferEntry.js';

describe('buildMovementOfferId', () => {
	it('names the card, the node and the token', () => {
		expect(
			buildMovementOfferId({ messageId: 'm', nodeId: 'n', tokenUuid: 'Scene.s.Token.t' }),
		).toBe('m.n.t');
	});
});

describe('mergeMovementOfferEntry', () => {
	const taken = {
		id: 'm.n.t',
		nodeId: 'n',
		tokenUuid: 'Scene.s.Token.t',
		spaces: 2,
		used: true,
		usedBy: 'p1',
		movedSpaces: 1,
		stopped: true,
	};

	it('appends a new entry with defaults for what the patch leaves out', () => {
		expect(mergeMovementOfferEntry([], { id: 'm.n.t', spaces: 2 })).toEqual([
			{
				id: 'm.n.t',
				nodeId: '',
				tokenUuid: '',
				spaces: 2,
				used: false,
				usedBy: null,
				movedSpaces: null,
				stopped: false,
			},
		]);
	});

	it('updates an existing entry in place and leaves the others untouched', () => {
		const other = { ...taken, id: 'm.n.other' };
		const merged = mergeMovementOfferEntry([other, taken], { id: 'm.n.t', movedSpaces: 2 });
		expect(merged[0]).toBe(other);
		expect(merged[1]).toEqual({ ...taken, movedSpaces: 2 });
	});

	it('ignores undefined patch values so an earlier stamp survives a later partial one', () => {
		const merged = mergeMovementOfferEntry([taken], {
			id: 'm.n.t',
			usedBy: undefined,
			stopped: false,
		});
		expect(merged[0]).toEqual({ ...taken, stopped: false });
	});
});
