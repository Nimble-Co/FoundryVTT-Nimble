/**
 * Batch 3 (document/data API) regression tests against live V14:
 * - field deletion via foundry.data.operators.ForcedDeletion (RecordField + flags)
 * - compendium import stamps _stats.compendiumSource
 * - a real chat-card flow posts a system ChatMessage subtype
 */

import { afterAll, describe, expect, test } from 'vitest';

const TEST_ACTOR_NAME = 'V14 Data Ops Test Actor';

type RecordLike = Record<string, unknown>;

describe('V14 data operations', () => {
	const createdMessageIds: string[] = [];

	afterAll(async () => {
		const leftovers = game.actors.filter((actor) => actor.name === TEST_ACTOR_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
		const importedItems = game.items.filter((item) => item.name.startsWith('V14 Import Test'));
		for (const item of importedItems) {
			await item.delete().catch((error) => console.error(error));
		}
		for (const id of createdMessageIds) {
			await game.messages
				.get(id)
				?.delete()
				.catch((error) => console.error(error));
		}
	});

	test('ForcedDeletion removes a RecordField entry (system.attributes.hitDice)', async () => {
		const actor = await Actor.create({ name: TEST_ACTOR_NAME, type: 'character' });
		expect(actor).toBeDefined();

		await actor!.update({
			'system.attributes.hitDice.d8': { current: 2, origin: ['test'], total: 2 },
		} as RecordLike);
		let hitDice = (actor!.system as unknown as { attributes: { hitDice: RecordLike } }).attributes
			.hitDice;
		expect(hitDice.d8).toBeDefined();

		await actor!.update({
			'system.attributes.hitDice.d8': new foundry.data.operators.ForcedDeletion(),
		} as RecordLike);
		hitDice = (actor!.system as unknown as { attributes: { hitDice: RecordLike } }).attributes
			.hitDice;
		expect(hitDice.d8).toBeUndefined();
		// The deletion persisted to the database source, not just the in-memory copy.
		expect(
			(actor!.toObject().system as unknown as { attributes: { hitDice: RecordLike } }).attributes
				.hitDice.d8,
		).toBeUndefined();

		await actor!.delete();
	});

	test('ForcedDeletion removes a flag key', async () => {
		const actor = await Actor.create({ name: TEST_ACTOR_NAME, type: 'character' });
		expect(actor).toBeDefined();

		await actor!.update({
			[`flags.${game.system.id}.testPools`]: { alpha: 1, beta: 2 },
		} as RecordLike);
		let pools = foundry.utils.getProperty(
			actor!,
			`flags.${game.system.id}.testPools`,
		) as RecordLike;
		expect(pools.alpha).toBe(1);

		await actor!.update({
			[`flags.${game.system.id}.testPools.alpha`]: new foundry.data.operators.ForcedDeletion(),
		} as RecordLike);
		pools = foundry.utils.getProperty(actor!, `flags.${game.system.id}.testPools`) as RecordLike;
		expect(pools.alpha).toBeUndefined();
		expect(pools.beta).toBe(2);

		await actor!.delete();
	});

	test('compendium import stamps _stats.compendiumSource', async () => {
		const pack = game.packs.find(
			(p) => p.metadata.name === 'nimble-items' && p.documentName === 'Item',
		);
		expect(pack).toBeDefined();

		const index = await pack!.getIndex();
		const entry = index.contents[0];
		expect(entry).toBeDefined();

		// Use the data-level import path (WorldCollection#fromCompendium stamps
		// _stats.compendiumSource); importFromCompendium additionally activates
		// the sidebar UI, which is irrelevant here and flaky headless.
		const sourceDocument = await pack!.getDocument(entry!._id);
		const data = game.items.fromCompendium(
			// @ts-expect-error - the pack's generic document type is unknown at compile time.
			sourceDocument!,
		) as { name: string; _stats: { compendiumSource: string | null } };
		data.name = `V14 Import Test: ${entry!.name}`;

		const imported = (await Item.create(data as object as Item.CreateData)) as Item & {
			_stats: { compendiumSource: string | null };
		};

		expect(imported._stats.compendiumSource).toBe(
			`Compendium.${pack!.collection}.Item.${entry!._id}`,
		);

		await imported.delete();
	});

	test('a real chat-card flow posts a system ChatMessage subtype', async () => {
		const actor = await Actor.create({ name: TEST_ACTOR_NAME, type: 'character' });
		expect(actor).toBeDefined();

		const before = new Set(game.messages.keys());
		const nimbleActor = actor as unknown as {
			rollAbilityCheckToChat: (key: string, options?: object) => Promise<unknown>;
		};
		await nimbleActor.rollAbilityCheckToChat('strength', { skipRollDialog: true });

		const newMessages = game.messages.filter((m) => !before.has(m.id));
		expect(newMessages.length).toBeGreaterThan(0);
		const card = newMessages[0]!;
		createdMessageIds.push(card.id);
		expect(card.type).toBe('abilityCheck');

		await actor!.delete();
	});
});
