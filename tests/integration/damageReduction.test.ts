/**
 * Live regression tests for the damageReduction rule and the banked
 * damage-reduction expiry hook merged from dev.
 *
 * The rule pushes entries onto `actor.system.damageReductions` during data
 * prep; banked one-shot reductions are ActiveEffects carrying the
 * `bankedDamageReduction` flag, cleared by the expiry hook when a combat
 * ends. On Foundry V14 (as on V13) `Combat#started` is a derived getter and
 * the tracker's End Combat control deletes the combat document, so combat
 * deletion is the end-of-encounter signal this suite exercises — the hook's
 * `updateCombat {started: false}` branch has no core producer.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { purgeTestDocuments, ruleFeatureData, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Damage Reduction';

interface DamageReductionEntry {
	value: number;
	damageTypes: string[];
	mode?: 'flat' | 'half';
	label?: string;
}

interface ReductionActor {
	id: string;
	system: { damageReductions?: DamageReductionEntry[] };
	effects: { contents: Array<{ id: string; name: string }> };
	createEmbeddedDocuments(type: string, data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: string, ids: string[]): Promise<unknown>;
}

describe('damage reduction', () => {
	let actor: ReductionActor;
	const createdCombatIds = new Set<string>();

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as ReductionActor;
	}, 60_000);

	afterAll(async () => {
		for (const id of createdCombatIds) {
			await game.combats
				.get(id)
				?.delete()
				.catch((error) => console.error(error));
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	async function withRuleFeature(
		rules: Array<Record<string, unknown>>,
		body: () => Promise<void> | void,
	) {
		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Feature`, rules),
		]);
		try {
			await body();
		} finally {
			await actor.deleteEmbeddedDocuments('Item', [item.id]);
		}
	}

	const reductions = () => actor.system.damageReductions ?? [];

	test('flat and formula values land in system.damageReductions; dice values are skipped', async () => {
		expect(reductions()).toHaveLength(0);

		await withRuleFeature(
			[
				{ type: 'damageReduction', mode: 'flat', value: '2', label: 'Stoneskin' },
				{ type: 'damageReduction', mode: 'flat', value: '1 + 2' },
				{ type: 'damageReduction', mode: 'flat', value: '1d4', label: 'Dice Bank' },
			],
			() => {
				const entries = reductions();
				expect(entries).toHaveLength(2);
				expect(entries[0]).toMatchObject({ value: 2, damageTypes: [], label: 'Stoneskin' });
				expect(entries[1]).toMatchObject({ value: 3, damageTypes: [] });
				expect(entries.some((entry) => entry.label === 'Dice Bank')).toBe(false);
			},
		);

		expect(reductions()).toHaveLength(0);
	}, 30_000);

	test('half mode and damage-type scoping carry through', async () => {
		await withRuleFeature(
			[
				{ type: 'damageReduction', mode: 'half', damageTypes: ['fire'], label: 'Fire Ward' },
				{ type: 'damageReduction', mode: 'flat', value: '1', damageTypes: ['slashing'] },
			],
			() => {
				const entries = reductions();
				expect(entries).toHaveLength(2);
				expect(entries[0]).toMatchObject({ value: 0, mode: 'half', damageTypes: ['fire'] });
				expect(entries[1]).toMatchObject({ value: 1, damageTypes: ['slashing'] });
			},
		);
	}, 30_000);

	test('disabled and predicate-gated rules contribute nothing', async () => {
		await withRuleFeature(
			[
				{ type: 'damageReduction', mode: 'flat', value: '2', disabled: true },
				{
					type: 'damageReduction',
					mode: 'flat',
					value: '2',
					predicate: { $and: ['self:thisTagNeverExists'] },
				},
			],
			() => {
				expect(reductions()).toHaveLength(0);
			},
		);
	}, 30_000);

	/** Create a bank ActiveEffect directly, as addBankedDamageReduction would. */
	async function createBank(target: ReductionActor, value: number): Promise<string> {
		const [effect] = await target.createEmbeddedDocuments('ActiveEffect', [
			{
				name: `Damage Reduction (${value})`,
				img: 'icons/svg/shield.svg',
				disabled: false,
				flags: { [game.system.id]: { bankedDamageReduction: value } },
			},
		]);
		return effect.id;
	}

	const hasEffect = (target: ReductionActor, effectId: string) =>
		target.effects.contents.some((effect) => effect.id === effectId);

	test('banked reduction is cleared when the combat is deleted (End Combat)', async () => {
		const bankId = await createBank(actor, 8);
		expect(hasEffect(actor, bankId)).toBe(true);

		const combat = (await Combat.create({ active: true }))!;
		createdCombatIds.add(combat.id!);
		await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }]);
		await combat.startCombat();
		expect(combat.started).toBe(true);

		// End Combat in the tracker confirms and then deletes the document; the
		// expiry hook clears every combatant's bank from deleteCombat.
		await combat.delete();
		createdCombatIds.delete(combat.id!);

		await waitFor(() => !hasEffect(actor, bankId), 'the banked reduction effect to be deleted');
	}, 60_000);

	test('banks on actors outside the combat survive an encounter end', async () => {
		const bystander = (await Actor.create({
			name: `${TEST_PREFIX} Bystander`,
			type: 'character',
		})) as unknown as ReductionActor;
		const bystanderBankId = await createBank(bystander, 4);
		const combatantBankId = await createBank(actor, 5);

		const combat = (await Combat.create({ active: true }))!;
		createdCombatIds.add(combat.id!);
		await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }]);
		await combat.startCombat();
		await combat.delete();
		createdCombatIds.delete(combat.id!);

		await waitFor(() => !hasEffect(actor, combatantBankId), "the combatant's bank to be deleted");
		expect(hasEffect(bystander, bystanderBankId)).toBe(true);
	}, 60_000);
});
