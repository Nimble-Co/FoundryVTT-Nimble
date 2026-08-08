/**
 * Live regression tests for the ancestry bonus split merged from dev: the
 * swappable trait is its own `ancestryBonus` item, an ancestry brings its
 * default one along, and swapping ancestries swaps the trait with it.
 *
 * The batch case is the V14-sensitive one. `nimbleAncestryBonusInBatch` is a
 * *custom* key on the create operation, and it only reaches `_preCreate`
 * because V14's `#preCreateDocumentArray` spreads unrecognised operation keys
 * into the options it forwards. That contract is invisible to type-checking and
 * to the unit suite, so it is asserted here against a real create.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Ancestry Bonus';

const ANCESTRY_PACK = 'nimble-ancestries';
const BONUS_PACK = 'nimble-ancestry-bonuses';

interface AncestryHostActor extends Actor {
	ancestry?: { id: string; name: string; system: { defaultBonus?: string } };
	ancestryBonus?: { id: string; name: string; _stats?: { compendiumSource?: string } };
}

/** Fetch a pack document by name, as the character builder does. */
async function packDocumentByName(packName: string, name: string) {
	const pack = game.packs.get(`${game.system.id}.${packName}`)!;
	const index = await pack.getIndex({ fields: ['system.defaultBonus'] });
	const entry = index.contents.find((candidate) => candidate.name === name);
	if (!entry) throw new Error(`${packName} has no document named "${name}"`);
	return (await pack.getDocument(entry._id))!;
}

describe('ancestry bonus items', () => {
	let actor: AncestryHostActor;
	let elf: Awaited<ReturnType<typeof packDocumentByName>>;
	let dwarf: Awaited<ReturnType<typeof packDocumentByName>>;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);

		elf = await packDocumentByName(ANCESTRY_PACK, 'Elf');
		dwarf = await packDocumentByName(ANCESTRY_PACK, 'Dwarf');

		actor = (await Actor.create({
			name: `${TEST_PREFIX} Hero`,
			type: 'character',
		})) as AncestryHostActor;
	}, 120_000);

	afterAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** Remove whatever ancestry/bonus the actor is carrying. */
	async function resetAncestry() {
		const ids = actor.items
			.filter((item) => item.type === 'ancestry' || item.type === 'ancestryBonus')
			.map((item) => item.id!);
		if (ids.length) await actor.deleteEmbeddedDocuments('Item', ids);
		await waitFor(() => !actor.ancestry && !actor.ancestryBonus, 'the actor to have no ancestry');
	}

	async function addAncestry(
		ancestry: Awaited<ReturnType<typeof packDocumentByName>>,
		operation: Record<string, unknown> = {},
	) {
		await actor.createEmbeddedDocuments(
			'Item',
			[ancestry.toObject() as Item.CreateData],
			operation as object as Item.Database.CreateOperation,
		);
		await settle(600);
	}

	/**
	 * Record ancestryBonus creates/deletes while a batch runs. End state alone
	 * cannot tell the flag apart: without it the default is created and then
	 * deleted by the chosen bonus, landing on the same single item. The
	 * difference is the churn, which is exactly what the flag exists to avoid.
	 */
	function recordBonusChurn() {
		const created: string[] = [];
		const deleted: string[] = [];
		const onCreate = (item: { type: string; name: string }) => {
			if (item.type === 'ancestryBonus') created.push(item.name);
		};
		const onDelete = (item: { type: string; name: string }) => {
			if (item.type === 'ancestryBonus') deleted.push(item.name);
		};

		Hooks.on('createItem', onCreate as never);
		Hooks.on('deleteItem', onDelete as never);

		return {
			created,
			deleted,
			stop() {
				Hooks.off('createItem', onCreate as never);
				Hooks.off('deleteItem', onDelete as never);
			},
		};
	}

	test('an ancestry brings its default bonus along', async () => {
		await resetAncestry();
		await addAncestry(elf);

		await waitFor(() => !!actor.ancestryBonus, "the Elf's default bonus to be created");

		const expected = (elf as unknown as { system: { defaultBonus: string } }).system.defaultBonus;
		expect(actor.ancestry?.name).toBe('Elf');
		expect(actor.ancestryBonus?._stats?.compendiumSource).toBe(expected);
	}, 120_000);

	test('swapping the ancestry swaps the bonus with it', async () => {
		await resetAncestry();
		await addAncestry(elf);
		await waitFor(() => !!actor.ancestryBonus, "the Elf's default bonus to be created");
		const elfBonusId = actor.ancestryBonus!.id;

		await addAncestry(dwarf);
		await waitFor(
			() => actor.ancestry?.name === 'Dwarf' && actor.ancestryBonus?.id !== elfBonusId,
			"the Dwarf's bonus to replace the Elf's",
		);

		const expected = (dwarf as unknown as { system: { defaultBonus: string } }).system.defaultBonus;
		expect(actor.ancestryBonus?._stats?.compendiumSource).toBe(expected);

		// Exactly one of each survives the swap; the outgoing trait is not left behind.
		expect(actor.items.filter((item) => item.type === 'ancestry').length).toBe(1);
		expect(actor.items.filter((item) => item.type === 'ancestryBonus').length).toBe(1);
	}, 120_000);

	test('a bonus created alongside the ancestry is kept instead of the default', async () => {
		await resetAncestry();

		// A bonus that is deliberately *not* Elf's default, standing in for a
		// player's pick in the character builder.
		const chosen = await packDocumentByName(BONUS_PACK, 'Optimistic');
		const elfDefault = (elf as unknown as { system: { defaultBonus: string } }).system.defaultBonus;
		expect(chosen.uuid).not.toBe(elfDefault);

		const churn = recordBonusChurn();
		try {
			await actor.createEmbeddedDocuments(
				'Item',
				[elf.toObject(), chosen.toObject()] as Item.CreateData[],
				{ nimbleAncestryBonusInBatch: true } as object as Item.Database.CreateOperation,
			);
			await settle(1500);
		} finally {
			churn.stop();
		}

		await waitFor(() => !!actor.ancestryBonus, 'the chosen bonus to be created');
		expect(actor.ancestryBonus?.name).toBe('Optimistic');
		expect(actor.items.filter((item) => item.type === 'ancestryBonus').length).toBe(1);

		// The flag reached `_preCreate`: the default was never built, so nothing
		// had to be deleted to make room for the player's pick.
		expect(churn.created).toEqual(['Optimistic']);
		expect(churn.deleted).toEqual([]);
	}, 120_000);

	test('without the batch flag the ancestry still creates its own default', async () => {
		await resetAncestry();
		const chosen = await packDocumentByName(BONUS_PACK, 'Optimistic');

		// Same two documents, no flag: the case the flag exists to avoid. It still
		// settles on the player's pick, so this is the control that proves the
		// assertions above are about the flag and not about the end state.
		const churn = recordBonusChurn();
		try {
			await actor.createEmbeddedDocuments('Item', [
				elf.toObject(),
				chosen.toObject(),
			] as Item.CreateData[]);
			await settle(1500);
		} finally {
			churn.stop();
		}

		await waitFor(() => !!actor.ancestryBonus, 'a bonus to survive the unflagged batch');
		expect(actor.ancestryBonus?.name).toBe('Optimistic');
		expect(actor.items.filter((item) => item.type === 'ancestryBonus').length).toBe(1);

		// The default was built and then thrown away again.
		expect(churn.created).toHaveLength(2);
		expect(churn.created).toContain('Optimistic');
		expect(churn.deleted).toHaveLength(1);
	}, 120_000);

	test('a directly created bonus replaces the one already worn', async () => {
		await resetAncestry();
		await addAncestry(elf);
		await waitFor(() => !!actor.ancestryBonus, "the Elf's default bonus to be created");
		const originalId = actor.ancestryBonus!.id;

		const replacement = await packDocumentByName(BONUS_PACK, 'Optimistic');
		await actor.createEmbeddedDocuments('Item', [replacement.toObject() as Item.CreateData]);

		await waitFor(
			() => actor.ancestryBonus?.id !== originalId,
			'the replacement bonus to take over',
		);
		expect(actor.ancestryBonus?.name).toBe('Optimistic');
		expect(actor.items.filter((item) => item.type === 'ancestryBonus').length).toBe(1);

		// The ancestry itself is untouched by a bonus swap.
		expect(actor.ancestry?.name).toBe('Elf');
	}, 120_000);
});
