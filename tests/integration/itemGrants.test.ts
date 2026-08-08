/**
 * Live regression tests for the item-lifecycle document-writing rules:
 * grantItem resolves a compendium UUID during preCreate and creates the
 * granted item alongside its carrier (with dedupe via compendiumSource),
 * and maxHpBonus issues persistent hp-bonus updates on item add/remove.
 *
 * grantSpells and savingThrowRollMode are intentionally NOT covered here:
 * both are consumed exclusively by the character-creation / level-up
 * dialogs, so they have no runtime rule surface to exercise outside those
 * wizards.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { purgeTestDocuments, ruleFeatureData, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Item Grants';

interface GrantActor {
	id: string;
	system: { attributes: { hp: { bonus: number } } };
	items: {
		contents: Array<{
			id: string;
			name: string;
			_stats?: { compendiumSource?: string | null };
		}>;
	};
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
}

describe('item grant and lifecycle rules', () => {
	let actor: GrantActor;
	let grantedUuid: string;
	let grantedName: string;

	const grantedCopies = () =>
		actor.items.contents.filter((item) => item._stats?.compendiumSource === grantedUuid);

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as GrantActor;

		// Any real compendium item works as the grant target.
		const pack = game.packs.get(`${game.system.id}.nimble-items`)!;
		const index = await pack.getIndex();
		const entry = index.contents.find((candidate: any) => candidate.type === 'object')!;
		grantedUuid = `Compendium.${pack.collection}.Item.${entry._id}`;
		grantedName = entry.name!;
	}, 60_000);

	afterAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('grantItem creates the compendium item alongside its carrier', async () => {
		expect(grantedCopies()).toHaveLength(0);

		await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Carrier`, [
				{ type: 'grantItem', uuid: grantedUuid, allowDuplicate: false },
			]),
		]);

		await waitFor(() => grantedCopies().length === 1, 'the granted item to be created');
		expect(grantedCopies()[0]!.name).toBe(grantedName);
	}, 60_000);

	test('a second grant of the same source is deduped when allowDuplicate is false', async () => {
		await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Second Carrier`, [
				{ type: 'grantItem', uuid: grantedUuid, allowDuplicate: false },
			]),
		]);

		// The carrier itself is created; the grant is skipped.
		await waitFor(
			() => actor.items.contents.some((item) => item.name === `${TEST_PREFIX} Second Carrier`),
			'the second carrier to be created',
		);
		expect(grantedCopies()).toHaveLength(1);
	}, 60_000);

	test('maxHpBonus adjusts the persistent hp bonus on add and reverts on delete', async () => {
		const bonusBefore = actor.system.attributes.hp.bonus;

		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Tough`, [{ type: 'maxHpBonus', value: 5, perLevel: false }]),
		]);
		await waitFor(
			() => actor.system.attributes.hp.bonus === bonusBefore + 5,
			'the hp bonus to be applied',
		);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
		await waitFor(
			() => actor.system.attributes.hp.bonus === bonusBefore,
			'the hp bonus to be reverted',
		);
	}, 60_000);
});
