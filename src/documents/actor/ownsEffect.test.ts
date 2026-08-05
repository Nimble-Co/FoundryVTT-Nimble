import { describe, expect, it } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

const ACTOR_ID = 'actor-1';

function ownsEffect(effect: unknown): boolean {
	const check = (NimbleBaseActor.prototype as unknown as { _ownsEffect(effect: unknown): boolean })
		._ownsEffect;
	return check.call({ id: ACTOR_ID } as unknown as InstanceType<typeof NimbleBaseActor>, effect);
}

describe('_ownsEffect', () => {
	it('claims effects applied directly to the actor', () => {
		expect(ownsEffect({ parent: { documentName: 'Actor', id: ACTOR_ID } })).toBe(true);
	});

	it('claims effects granted by one of the actor’s owned items', () => {
		expect(
			ownsEffect({ parent: { documentName: 'Item', id: 'item-1', parent: { id: ACTOR_ID } } }),
		).toBe(true);
	});

	it('ignores effects on another actor', () => {
		expect(ownsEffect({ parent: { documentName: 'Actor', id: 'actor-2' } })).toBe(false);
	});

	it('ignores effects on another actor’s item', () => {
		expect(
			ownsEffect({ parent: { documentName: 'Item', id: 'item-1', parent: { id: 'actor-2' } } }),
		).toBe(false);
	});

	it('ignores unowned effects and malformed payloads', () => {
		expect(ownsEffect({ parent: { documentName: 'Item', id: 'item-1' } })).toBe(false);
		expect(ownsEffect({ parent: null })).toBe(false);
		expect(ownsEffect({})).toBe(false);
		expect(ownsEffect(null)).toBe(false);
	});
});
