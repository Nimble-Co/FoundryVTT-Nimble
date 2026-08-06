import { describe, expect, it } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

type ActorStub = { id: string };

/** An unlinked token's synthetic actor shares the base actor's id. */
const actor: ActorStub = { id: 'actor-1' };
const tokenActor: ActorStub = { id: 'actor-1' };
const otherActor: ActorStub = { id: 'actor-2' };

function ownsEffect(effect: unknown, self: ActorStub = actor): boolean {
	const check = (NimbleBaseActor.prototype as unknown as { _ownsEffect(effect: unknown): boolean })
		._ownsEffect;
	return check.call(self as unknown as InstanceType<typeof NimbleBaseActor>, effect);
}

describe('_ownsEffect', () => {
	it('claims effects applied directly to the actor', () => {
		expect(ownsEffect({ parent: actor })).toBe(true);
	});

	it('claims effects granted by one of the actor’s owned items', () => {
		expect(ownsEffect({ parent: { id: 'item-1', parent: actor } })).toBe(true);
	});

	it('ignores effects on another actor', () => {
		expect(ownsEffect({ parent: otherActor })).toBe(false);
	});

	it('ignores effects on another actor’s item', () => {
		expect(ownsEffect({ parent: { id: 'item-1', parent: otherActor } })).toBe(false);
	});

	it('does not cross-fire between a world actor and a token actor sharing its id', () => {
		expect(ownsEffect({ parent: tokenActor })).toBe(false);
		expect(ownsEffect({ parent: { id: 'item-1', parent: tokenActor } })).toBe(false);
		// ...and the token's own subscriber still claims them.
		expect(ownsEffect({ parent: tokenActor }, tokenActor)).toBe(true);
		expect(ownsEffect({ parent: { id: 'item-1', parent: tokenActor } }, tokenActor)).toBe(true);
	});

	it('ignores unowned effects and malformed payloads', () => {
		expect(ownsEffect({ parent: { id: 'item-1' } })).toBe(false);
		expect(ownsEffect({ parent: null })).toBe(false);
		expect(ownsEffect({})).toBe(false);
		expect(ownsEffect(null)).toBe(false);
	});
});
