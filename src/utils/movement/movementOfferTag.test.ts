import { describe, expect, it } from 'vitest';
import { readMovementOfferTag, withMovementOfferTag } from './movementOfferTag.js';

const tag = { messageId: 'm1', offerId: 'n1.gob' };

describe('movement offer tag', () => {
	it('reads back the tag written into the drop options, beside core options', () => {
		const options = withMovementOfferTag({ ignoreWalls: false, ignoreCost: false }, tag);
		expect(options).toMatchObject({ ignoreWalls: false, ignoreCost: false });
		expect(readMovementOfferTag(options)).toEqual(tag);
	});

	it('survives the deep copy core makes of the options', () => {
		const copied = structuredClone(withMovementOfferTag(undefined, tag));
		expect(readMovementOfferTag(copied)).toEqual(tag);
	});

	it('is null for a Movement made under no offer, or a malformed tag', () => {
		expect(readMovementOfferTag(undefined)).toBeNull();
		expect(readMovementOfferTag({ ignoreWalls: true })).toBeNull();
		expect(readMovementOfferTag({ nimbleMovementOffer: { messageId: 'm1' } })).toBeNull();
	});
});
