/**
 * Real document round-trip against the live world database: create a character
 * actor, confirm Nimble's document class + data preparation ran, update it,
 * delete it. Regression-proofs the basic V14 document pipeline.
 */

import { afterAll, describe, expect, test } from 'vitest';

const TEST_ACTOR_NAME = 'V14 Integration Harness Actor';

describe('actor create/read/update/delete', () => {
	afterAll(async () => {
		// Clean up anything a failed run left behind, including earlier runs.
		const leftovers = game.actors.filter((actor) => actor.name === TEST_ACTOR_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
	});

	test('a character actor round-trips through the world database', async () => {
		const actor = await Actor.create({ name: TEST_ACTOR_NAME, type: 'character' });

		expect(actor).toBeDefined();
		expect(actor!.id).toBeTruthy();
		expect(actor!.type).toBe('character');

		// Read back through the world collection.
		expect(game.actors.get(actor!.id!)).toBe(actor);

		// Nimble's document class prepared the actor: NimbleBaseActor populates
		// `tags` during data preparation, and the character data model provides
		// hp attributes.
		const nimbleActor = actor as unknown as {
			tags: Set<string>;
			prepareData: () => void;
			system: { attributes: { hp: { value: number; max: number } } };
		};
		expect(nimbleActor.tags).toBeInstanceOf(Set);
		expect(typeof nimbleActor.system.attributes.hp.max).toBe('number');

		// The `tags` class-field initializer runs after the in-constructor
		// preparation pass and resets the set, so a freshly constructed actor has
		// empty tags until the next re-preparation (long-standing behavior, not
		// V14-specific). Re-prepare explicitly and assert the pipeline populates.
		nimbleActor.prepareData();
		expect([...nimbleActor.tags].some((tag) => tag.startsWith('disposition:'))).toBe(true);

		// Update round-trips.
		await actor!.update({ name: `${TEST_ACTOR_NAME} (Renamed)` });
		expect(actor!.name).toBe(`${TEST_ACTOR_NAME} (Renamed)`);

		// Delete removes it from the world collection.
		const id = actor!.id!;
		await actor!.delete();
		expect(game.actors.get(id)).toBeUndefined();
	});
});
