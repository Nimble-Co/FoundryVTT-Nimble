import { describe, expect, it } from 'vitest';
import {
	readMovementOfferTag,
	tagDragMovements,
	withMovementOfferTag,
} from './movementOfferTag.js';

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

describe('tagDragMovements', () => {
	const shared = { ignoreWalls: false, ignoreCost: false };
	type DragMovement = { waypoints: unknown[]; planned: boolean; constrainOptions?: object };
	const movement = (): Record<string, DragMovement> => ({
		a: { waypoints: [], planned: false },
		b: { waypoints: [], planned: false },
	});

	it("gives each dragged token its own offer's tag", () => {
		const other = { messageId: 'm2', offerId: 'n2.hob' };
		const tagged = tagDragMovements(movement(), shared, (id) => (id === 'a' ? tag : other));
		expect(readMovementOfferTag(tagged.a.constrainOptions)).toEqual(tag);
		expect(readMovementOfferTag(tagged.b.constrainOptions)).toEqual(other);
		expect(tagged.a.constrainOptions).toMatchObject(shared);
	});

	it('leaves a token with no offer on the shared options, with no tag', () => {
		const tagged = tagDragMovements(movement(), shared, (id) => (id === 'a' ? tag : null));
		expect(tagged.b).not.toHaveProperty('constrainOptions');
		expect(readMovementOfferTag(tagged.a.constrainOptions)).toEqual(tag);
		expect(readMovementOfferTag(shared)).toBeNull();
	});

	it("keeps a token's own constrain options when it already has them", () => {
		const own = movement();
		own.a.constrainOptions = { ignoreWalls: true };
		const tagged = tagDragMovements(own, shared, () => tag);
		expect(tagged.a.constrainOptions).toEqual({ ignoreWalls: true, nimbleMovementOffer: tag });
	});
});
