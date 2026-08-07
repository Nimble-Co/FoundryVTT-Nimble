import { describe, expect, it } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

type ActorStub = { id: string };

/** An unlinked token's synthetic actor shares the base actor's id. */
const actor: ActorStub = { id: 'actor-1' };
const tokenActor: ActorStub = { id: 'actor-1' };
const otherActor: ActorStub = { id: 'actor-2' };

function owns(doc: unknown, self: ActorStub = actor): boolean {
	const check = (
		NimbleBaseActor.prototype as unknown as { _ownsEmbeddedDocument(doc: unknown): boolean }
	)._ownsEmbeddedDocument;
	return check.call(self as unknown as InstanceType<typeof NimbleBaseActor>, doc);
}

describe('_ownsEmbeddedDocument', () => {
	it('claims the actor’s own items', () => {
		expect(owns({ parent: actor })).toBe(true);
	});

	it('claims effects applied directly to the actor', () => {
		expect(owns({ parent: actor })).toBe(true);
	});

	it('claims effects granted by one of the actor’s owned items', () => {
		expect(owns({ parent: { id: 'item-1', parent: actor } })).toBe(true);
	});

	it('ignores documents on another actor', () => {
		expect(owns({ parent: otherActor })).toBe(false);
	});

	it('ignores effects on another actor’s item', () => {
		expect(owns({ parent: { id: 'item-1', parent: otherActor } })).toBe(false);
	});

	it('does not cross-fire between a world actor and a token actor sharing its id', () => {
		expect(owns({ parent: tokenActor })).toBe(false);
		expect(owns({ parent: { id: 'item-1', parent: tokenActor } })).toBe(false);
		// ...and the token's own subscriber still claims them.
		expect(owns({ parent: tokenActor }, tokenActor)).toBe(true);
		expect(owns({ parent: { id: 'item-1', parent: tokenActor } }, tokenActor)).toBe(true);
	});

	it('ignores unowned documents and malformed payloads', () => {
		expect(owns({ parent: { id: 'item-1' } })).toBe(false);
		expect(owns({ parent: null })).toBe(false);
		expect(owns({})).toBe(false);
		expect(owns(null)).toBe(false);
	});
});
