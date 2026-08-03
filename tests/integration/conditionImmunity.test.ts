/**
 * Live regression tests for the conditionImmunity rule and its guard hooks:
 * the immunity set blocks both the linked-condition cascade (applying prone
 * normally auto-applies hampered via the automatic-conditions document
 * hooks) and rule-driven application through nimble.preApplyCondition.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	getRuleAutomationEnabled,
	purgeTestDocuments,
	ruleFeatureData,
	setRuleAutomationEnabled,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Condition Immunity';

interface ImmunityActor {
	id: string;
	statuses: Set<string>;
	system: { conditionImmunities?: Set<string> };
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
}

describe('conditionImmunity rule', () => {
	let immune: ImmunityActor;
	let control: ImmunityActor;
	let originalAutoApply: boolean;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalAutoApply = getRuleAutomationEnabled();
		if (!originalAutoApply) await setRuleAutomationEnabled(true);

		immune = (await Actor.create({
			name: `${TEST_PREFIX} Immune`,
			type: 'character',
		})) as unknown as ImmunityActor;
		control = (await Actor.create({
			name: `${TEST_PREFIX} Control`,
			type: 'character',
		})) as unknown as ImmunityActor;
		for (const actor of [immune, control]) {
			await actor.update({
				'system.attributes.hp.max': 10,
				'system.attributes.hp.value': 10,
			});
		}

		await immune.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Unshakeable`, [
				{ type: 'conditionImmunity', conditions: ['hampered', 'dazed'] },
			]),
		]);
	}, 60_000);

	afterAll(async () => {
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the immunity set is populated during live data prep', () => {
		expect(immune.system.conditionImmunities?.has('hampered')).toBe(true);
		expect(immune.system.conditionImmunities?.has('dazed')).toBe(true);
		expect(control.system.conditionImmunities?.has('hampered') ?? false).toBe(false);
	});

	test('the linked-condition cascade skips immune conditions', async () => {
		// prone normally auto-applies hampered through the automatic-conditions
		// document hooks. The control actor proves the cascade is live...
		await control.toggleStatusEffect('prone', { active: true });
		await waitFor(() => control.statuses.has('hampered'), "the control actor's cascade");

		// ...and the immune actor is skipped by the same path.
		await immune.toggleStatusEffect('prone', { active: true });
		await waitFor(() => immune.statuses.has('prone'), 'prone to land on the immune actor');
		await settle(1500);
		expect(immune.statuses.has('hampered')).toBe(false);
	}, 60_000);

	test('rule-driven application is blocked by nimble.preApplyCondition', async () => {
		const [item] = await immune.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Concussive Wounds`, [
				{ type: 'applyCondition', trigger: 'onWound', condition: 'dazed' },
			]),
		]);

		await immune.update({ 'system.attributes.hp.value': 5 });
		await settle(1500);
		expect(immune.statuses.has('dazed')).toBe(false);

		await immune.deleteEmbeddedDocuments('Item', [item.id]);
	}, 60_000);
});
