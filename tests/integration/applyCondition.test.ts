/**
 * Live regression tests for the applyCondition rule merged from dev. They cover
 * trigger-driven condition application through the real dispatch machinery:
 * an hp drop firing onWound (a copy of an item effect, whose Lasts Until real
 * turn advancement reaches), and real combat turn advancement firing
 * onTurnStart/onTurnEnd. All dispatch runs through ruleEventDispatch, gated on
 * `automation.applyRuleEffects`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createCombatWith,
	getAutomationToggle,
	getRuleAutomationEnabled,
	purgeTestDocuments,
	ruleFeatureData,
	setAutomationToggle,
	setRuleAutomationEnabled,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Apply Condition';
const DERIVED_CONDITIONS_SETTING = 'automation.derivedConditions';

const nextTurnStart = {
	kind: 'turn',
	boundary: 'start',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

interface LiveEffect {
	id: string;
	name: string;
	origin: string | null;
	statuses: Set<string>;
	system: { lastsUntil: unknown[] };
}

interface ConditionActor {
	id: string;
	type: string;
	statuses: Set<string>;
	effects: {
		contents: LiveEffect[];
	};
	items: {
		get(id: string):
			| {
					effects: { contents: Array<{ id: string }> };
					update(changes: Record<string, unknown>): Promise<unknown>;
			  }
			| undefined;
	};
	createEmbeddedDocuments(
		type: 'Item',
		data: object[],
	): Promise<Array<{ id: string; uuid: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
}

describe('applyCondition rule', () => {
	let actor: ConditionActor;
	let originalAutoApply: boolean;
	let originalDerivedConditions: boolean;
	const createdCombatIds = new Set<string>();

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalAutoApply = getRuleAutomationEnabled();
		if (!originalAutoApply) await setRuleAutomationEnabled(true);
		originalDerivedConditions = getAutomationToggle(DERIVED_CONDITIONS_SETTING);
		if (!originalDerivedConditions) await setAutomationToggle(DERIVED_CONDITIONS_SETTING, true);

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
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		if (getAutomationToggle(DERIVED_CONDITIONS_SETTING) !== originalDerivedConditions) {
			await setAutomationToggle(DERIVED_CONDITIONS_SETTING, originalDerivedConditions);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** A feature with an applyCondition rule that names its own effect. */
	async function createFeatureWithEffect(
		name: string,
		rule: Record<string, unknown>,
		effect: Record<string, unknown>,
	) {
		const [created] = await actor.createEmbeddedDocuments('Item', [
			{
				...ruleFeatureData(name, [rule]),
				effects: [{ type: 'nimble', transfer: false, ...effect }],
			},
		]);
		const item = actor.items.get(created.id)!;
		await item.update({
			'system.rules': [{ ...rule, effectId: item.effects.contents[0]!.id }],
		});
		return created;
	}

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

	test('onWound applies a copy of the item effect when the actor becomes bloodied', async () => {
		const item = await createFeatureWithEffect(
			`${TEST_PREFIX} Concussive Wounds`,
			{ type: 'applyCondition', trigger: 'onWound', condition: 'dazed' },
			{ name: 'Concussed', statuses: ['dazed'], system: { lastsUntil: [nextTurnStart] } },
		);

		expect(actor.statuses.has('dazed')).toBe(false);
		await actor.update({ 'system.attributes.hp.value': 5 });
		await waitFor(() => actor.statuses.has('dazed'), 'dazed to be applied on wound');

		const effect = actor.effects.contents.find((candidate) => candidate.statuses.has('dazed'))!;
		expect(effect.name).toBe('Concussed');
		expect(effect.origin).toBe(item.uuid);
		expect(effect.system.lastsUntil).toHaveLength(1);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
		await clearStatus('dazed');
		// hampered was cascaded from dazed and auto-removes with it.
		await clearStatus('hampered');
		await actor.update({ 'system.attributes.hp.value': 10 });
		await settle(600);
	}, 60_000);

	test('the copy ends when real turns reach its Lasts Until', async () => {
		await actor.update({ 'system.attributes.hp.value': 10 });
		await settle(800);
		await clearStatus('slowed');
		await clearStatus('hampered');

		const npc = (await Actor.create({
			name: `${TEST_PREFIX} Goblin`,
			type: 'npc',
		})) as unknown as ConditionActor;
		const item = await createFeatureWithEffect(
			`${TEST_PREFIX} Slowing Wounds`,
			{ type: 'applyCondition', trigger: 'onWound', condition: 'slowed' },
			{ name: 'Slowing Wound', statuses: ['slowed'], system: { lastsUntil: [nextTurnStart] } },
		);

		const combat = await createCombatWith([
			{ actor: actor as unknown as Actor },
			{ actor: npc as unknown as Actor },
		]);
		createdCombatIds.add(combat.id!);
		await waitFor(() => combat.combatant?.actorId === actor.id, 'the character turn in round 1');
		const startRound = combat.round;

		await actor.update({ 'system.attributes.hp.value': 5 });
		await waitFor(() => actor.statuses.has('slowed'), 'slowed to be applied on wound');
		await waitFor(() => actor.statuses.has('hampered'), 'hampered to follow slowed');
		const effect = actor.effects.contents.find((candidate) => candidate.statuses.has('slowed'))!;
		expect(effect.system.lastsUntil).toHaveLength(1);

		await combat.nextTurn();
		await waitFor(() => combat.combatant?.actorId === npc.id, 'the npc turn');
		await settle(500);
		expect(actor.statuses.has('slowed')).toBe(true);

		await combat.nextTurn();
		await waitFor(
			() => combat.combatant?.actorId === actor.id && combat.round === startRound + 1,
			'the character turn in the next round',
		);
		await waitFor(
			() => !actor.effects.contents.some((candidate) => candidate.id === effect.id),
			'slowed to end at the character turn start',
		);
		expect(actor.statuses.has('slowed')).toBe(false);
		await waitFor(() => !actor.statuses.has('hampered'), 'hampered to be removed with slowed');

		await actor.update({ 'system.attributes.hp.value': 4 });
		await waitFor(() => actor.statuses.has('slowed'), 'slowed to be applied again on wound');

		await combat.delete();
		createdCombatIds.delete(combat.id!);
		await actor.deleteEmbeddedDocuments('Item', [item.id]);
		await clearStatus('slowed');
		await clearStatus('hampered');
		await actor.update({ 'system.attributes.hp.value': 10 });
		await settle(600);
	}, 90_000);

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
