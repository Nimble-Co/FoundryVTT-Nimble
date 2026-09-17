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
				...taken,
				used: false,
				usedBy: null,
				movedSpaces: null,
				stopped: false,
				nodeId: '',
				tokenUuid: '',
			},
		]);
	});

	it('updates an existing entry in place and ignores undefined patch values', () => {
		const other = { ...taken, id: 'm.n.other' };
		expect(
			mergeMovementOfferEntry([other, taken], { id: 'm.n.t', movedSpaces: 2, usedBy: undefined }),
		).toEqual([other, { ...taken, movedSpaces: 2 }]);
	});
});
