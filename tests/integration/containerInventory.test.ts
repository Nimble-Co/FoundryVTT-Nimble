/**
 * Live regression tests for container inventory against V14. The unit suite
 * asserts that the lifecycle hooks call `update` with the right arguments; these
 * assert what actually reaches the database:
 * - deleting a container clears the persisted `containerId` of what it held
 * - declining the confirmation leaves the container and its contents alone
 * - a matching stack folds into the one already carried instead of adding a row
 * - stacks in different containers stay separate rows
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Container Inventory';

interface StoredItem {
	id: string;
	name: string;
	type: string;
	system: { containerId: string; quantity: number };
	toObject(): { system: { containerId: string; quantity: number } };
}

interface ContainerActor {
	id: string;
	items: {
		get(id: string): StoredItem | undefined;
		filter(fn: (item: StoredItem) => boolean): StoredItem[];
		contents: StoredItem[];
	};
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<StoredItem[]>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
}

function objectData(name: string, system: Record<string, unknown> = {}) {
	return {
		name: `${TEST_PREFIX} ${name}`,
		type: 'object',
		system: { objectSizeType: 'slots', slotsRequired: 1, ...system },
	};
}

function containerData(name: string) {
	return objectData(name, { container: { enabled: true, slotCostMode: 'ignore' } });
}

/**
 * `_preDelete` asks before emptying a stocked container, so a live delete would
 * otherwise sit on an open dialog forever. Answers from `answer` without
 * rendering one, and stays installed through cleanup, which deletes containers too.
 */
function stubDeletePrompt(answer: () => boolean): () => void {
	const api = foundry.applications.api.DialogV2 as unknown as {
		confirm: (...args: unknown[]) => Promise<boolean>;
	};
	const original = api.confirm;

	api.confirm = async () => answer();

	return () => {
		api.confirm = original;
	};
}

describe('container inventory', () => {
	let actor: ContainerActor;
	let restorePrompt: () => void;
	let promptAnswer = true;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		restorePrompt = stubDeletePrompt(() => promptAnswer);
		actor = (await Actor.create({
			name: `${TEST_PREFIX} Carrier`,
			type: 'character',
		})) as unknown as ContainerActor;
	}, 60_000);

	afterEach(async () => {
		// A test that declined must not leave cleanup unable to bin its container.
		promptAnswer = true;

		const ids = actor.items.contents.map((item) => item.id);
		if (ids.length) await actor.deleteEmbeddedDocuments('Item', ids);
		await settle();
	});

	afterAll(async () => {
		restorePrompt();
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('deleting a container frees what it held', async () => {
		const [bag] = await actor.createEmbeddedDocuments('Item', [containerData('Bag')]);
		const [armor] = await actor.createEmbeddedDocuments('Item', [
			objectData('Plate Armor', { containerId: bag.id, slotsRequired: 4 }),
		]);

		expect(actor.items.get(armor.id)?.toObject().system.containerId).toBe(bag.id);

		promptAnswer = true;
		await actor.deleteEmbeddedDocuments('Item', [bag.id]);
		await settle();

		const survivor = actor.items.get(armor.id);
		expect(survivor).toBeDefined();
		// The database source, not just the prepared copy.
		expect(survivor!.toObject().system.containerId).toBe('');
		expect(actor.items.get(bag.id)).toBeUndefined();
	});

	test('declining the prompt leaves the container and its contents in place', async () => {
		const [bag] = await actor.createEmbeddedDocuments('Item', [containerData('Kept Bag')]);
		const [armor] = await actor.createEmbeddedDocuments('Item', [
			objectData('Kept Armor', { containerId: bag.id }),
		]);

		promptAnswer = false;
		await actor.deleteEmbeddedDocuments('Item', [bag.id]);
		await settle();

		expect(actor.items.get(bag.id)).toBeDefined();
		expect(actor.items.get(armor.id)?.toObject().system.containerId).toBe(bag.id);
	});

	test('an empty container deletes without asking', async () => {
		const [bag] = await actor.createEmbeddedDocuments('Item', [containerData('Empty Bag')]);

		// Declining would keep it, so its absence proves nothing asked.
		promptAnswer = false;
		await actor.deleteEmbeddedDocuments('Item', [bag.id]);
		await settle();

		expect(actor.items.get(bag.id)).toBeUndefined();
	});

	test('a matching stack raises the carried quantity instead of adding a row', async () => {
		const [arrows] = await actor.createEmbeddedDocuments('Item', [
			objectData('Arrows', { objectSizeType: 'stackable', quantity: 5, stackSize: 20 }),
		]);

		await actor.createEmbeddedDocuments('Item', [
			objectData('Arrows', { objectSizeType: 'stackable', quantity: 1, stackSize: 20 }),
		]);

		// `_preCreate` folds the stack in without awaiting the write it starts.
		await waitFor(
			() => actor.items.get(arrows.id)?.toObject().system.quantity === 6,
			'the carried stack to absorb the new one',
		);

		expect(actor.items.filter((item) => item.name === `${TEST_PREFIX} Arrows`)).toHaveLength(1);
	});

	test('a stack inside a container stays separate from the loose one', async () => {
		const [quiver] = await actor.createEmbeddedDocuments('Item', [containerData('Quiver')]);
		await actor.createEmbeddedDocuments('Item', [
			objectData('Bolts', { objectSizeType: 'stackable', quantity: 5, stackSize: 20 }),
		]);

		await actor.createEmbeddedDocuments('Item', [
			objectData('Bolts', {
				objectSizeType: 'stackable',
				quantity: 1,
				stackSize: 20,
				containerId: quiver.id,
			}),
		]);
		await settle();

		const rows = actor.items.filter((item) => item.name === `${TEST_PREFIX} Bolts`);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.toObject().system.quantity).sort()).toEqual([1, 5]);
		expect(rows.map((row) => row.toObject().system.containerId).sort()).toEqual(['', quiver.id]);
	});
});
