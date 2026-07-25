/**
 * Live regression tests for the applyCondition rule merged from dev:
 * trigger-driven condition application through the real dispatch machinery —
 * an hp drop firing onWound (with an ActiveEffect duration patch), and real
 * combat turn advancement firing onTurnStart/onTurnEnd. All dispatch runs
 * through ruleEventDispatch, gated on `automation.autoApplyConditions`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createCombatWith,
	getAutoApplyConditions,
	purgeTestDocuments,
	ruleFeatureData,
	setAutoApplyConditions,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Apply Condition';

interface ConditionActor {
	id: string;
	type: string;
	statuses: Set<string>;
	effects: {
		contents: Array<{
			id: string;
			statuses: Set<string>;
			duration: { value: number | null; units: string };
		}>;
	};
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
}

describe('applyCondition rule', () => {
	let actor: ConditionActor;
	let originalAutoApply: boolean;
	const createdCombatIds = new Set<string>();

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalAutoApply = getAutoApplyConditions();
		if (!originalAutoApply) await setAutoApplyConditions(true);

		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as ConditionActor;
		await actor.update({
			'system.attributes.hp.max': 10,
			'system.attributes.hp.value': 10,
		});
	}, 60_000);

	afterAll(async () => {
		for (const id of createdCombatIds) {
			await game.combats
				.get(id)
				?.delete()
				.catch((error) => console.error(error));
		}
		if (getAutoApplyConditions() !== originalAutoApply) {
			await setAutoApplyConditions(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	/**
	 * Clear a status, tolerating the linked-condition auto-removal racing the
	 * explicit toggle (hampered auto-removes when its last source condition
	 * clears; a concurrent delete of the same effect throws server-side).
	 */
	async function clearStatus(statusId: string) {
		if (actor.statuses.has(statusId)) {
			await actor.toggleStatusEffect(statusId, { active: false }).catch(() => {});
		}
		await waitFor(() => !actor.statuses.has(statusId), `${statusId} to clear`);
	}

	test('onWound applies the condition when the actor becomes bloodied, with duration', async () => {
		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Concussive Wounds`, [
				{
					type: 'applyCondition',
					trigger: 'onWound',
					condition: 'dazed',
					duration: { rounds: 2 },
				},
			]),
		]);

		expect(actor.statuses.has('dazed')).toBe(false);
		await actor.update({ 'system.attributes.hp.value': 5 });
		await waitFor(() => actor.statuses.has('dazed'), 'dazed to be applied on wound');

		// The rule patches the created effect's duration after application. It
		// still writes the legacy `{rounds}` shape, which core V14 migrates to
		// the new `{value, units}` duration schema — assert the migrated form.
		const effect = actor.effects.contents.find((candidate) => candidate.statuses.has('dazed'))!;
		await waitFor(
			() => effect.duration.value === 2 && effect.duration.units === 'rounds',
			'the duration patch to land',
		);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
		await clearStatus('dazed');
		// hampered was cascaded from dazed and auto-removes with it.
		await clearStatus('hampered');
		await actor.update({ 'system.attributes.hp.value': 10 });
		await settle(600);
	}, 60_000);

	test('onTurnStart and onTurnEnd fire from real combat turn advancement', async () => {
		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Turn Triggers`, [
				{ type: 'applyCondition', trigger: 'onTurnStart', condition: 'slowed' },
				{ type: 'applyCondition', trigger: 'onTurnEnd', condition: 'grappled' },
			]),
		]);

		const combat = await createCombatWith([{ actor: actor as unknown as Actor }]);
		createdCombatIds.add(combat.id!);
		expect(actor.statuses.has('slowed')).toBe(false);
		expect(actor.statuses.has('grappled')).toBe(false);

		// With a single combatant, advancing the round replays their turn
		// boundary: onTurnEnd for the outgoing turn, onTurnStart for the next.
		await combat.nextRound();
		await waitFor(() => actor.statuses.has('grappled'), 'the turn-end condition');
		await waitFor(() => actor.statuses.has('slowed'), 'the turn-start condition');

		await combat.delete();
		createdCombatIds.delete(combat.id!);
		await actor.deleteEmbeddedDocuments('Item', [item.id]);
		for (const status of ['slowed', 'grappled', 'hampered']) await clearStatus(status);
	}, 90_000);

	test('an already-present condition is not duplicated by a second trigger', async () => {
		// Reset to a known baseline regardless of earlier test outcomes: full
		// hp (so the drop below is a real change) and no lingering statuses.
		await actor.update({ 'system.attributes.hp.value': 10 });
		await settle(800);
		await clearStatus('dazed');
		await clearStatus('hampered');

		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Repeat Wounds`, [
				{ type: 'applyCondition', trigger: 'onWound', condition: 'dazed' },
			]),
		]);

		await actor.update({ 'system.attributes.hp.value': 5 });
		await waitFor(() => actor.statuses.has('dazed'), 'dazed to be applied');
		const countAfterFirst = actor.effects.contents.filter((effect) =>
			effect.statuses.has('dazed'),
		).length;

		// A second qualifying hp drop while still bloodied re-fires the
		// trigger; the rule short-circuits on the existing status.
		await actor.update({ 'system.attributes.hp.value': 4 });
		await settle(1200);
		expect(actor.effects.contents.filter((effect) => effect.statuses.has('dazed')).length).toBe(
			countAfterFirst,
		);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
	}, 60_000);
});
