/**
 * Live regression tests for the predicate-timing guardrails merged from dev:
 * the health tags (`self:fullHp`, `self:bloodied`) are computed early enough
 * for prePrepareData-phase rules to predicate on them in the same
 * preparation cycle, and a prePrepareData-phase rule that predicates on a
 * late key (ability scores) warns once per item on the console.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import {
	getAutoApplyConditions,
	purgeTestDocuments,
	ruleFeatureData,
	setAutoApplyConditions,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Predicate Timing';

interface PredicateActor {
	id: string;
	tags: Set<string>;
	system: {
		skills: Record<string, { bonus: number }>;
		attributes: { hp: { value: number; max: number } };
	};
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

describe('predicate timing', () => {
	let actor: PredicateActor;
	let originalAutoApply: boolean;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		// Keep rule automation out of the picture so hp swings don't fire
		// condition/trigger side effects beyond the always-on health-state sync.
		originalAutoApply = getAutoApplyConditions();
		if (originalAutoApply) await setAutoApplyConditions(false);
		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as PredicateActor;
		await actor.update({
			'system.attributes.hp.max': 10,
			'system.attributes.hp.value': 10,
		});
	}, 60_000);

	afterAll(async () => {
		if (getAutoApplyConditions() !== originalAutoApply) {
			await setAutoApplyConditions(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('a prePrepareData rule predicating on a late key warns once per item', async () => {
		const warnSpy = vi.spyOn(console, 'warn');
		const isLateKeyWarning = (call: unknown[]) =>
			typeof call[0] === 'string' && call[0].includes('computed after prePrepareData');

		// A numeric speedBonus applies in prePrepareData; `strength` is an
		// ability-score key, which only exists in the domain after that phase.
		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Misconfigured`, [
				{ type: 'speedBonus', value: '2', predicate: { $and: ['strength'] } },
			]),
		]);
		await settle(300);

		const warnings = warnSpy.mock.calls.filter(isLateKeyWarning);
		expect(warnings.length).toBeGreaterThanOrEqual(1);
		expect(warnings[0]![0]).toContain('strength');

		// Further preparation cycles must not repeat the warning (deduped by
		// item uuid + rule type + keys).
		const countAfterCreate = warnings.length;
		await actor.update({ 'system.attributes.hp.value': 9 });
		await actor.update({ 'system.attributes.hp.value': 10 });
		await settle(300);
		expect(warnSpy.mock.calls.filter(isLateKeyWarning).length).toBe(countAfterCreate);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
	}, 30_000);

	test('self:fullHp is available to data-prep rules in the same cycle', async () => {
		expect(actor.tags.has('self:fullHp')).toBe(true);

		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Silent When Healthy`, [
				{
					type: 'skillBonus',
					value: '3',
					skills: ['stealth'],
					predicate: { $and: ['self:fullHp'] },
				},
			]),
		]);

		expect(actor.system.skills.stealth.bonus).toBe(3);

		// The bonus must flip in the same preparation pass as the hp change —
		// no second nudge update.
		await actor.update({ 'system.attributes.hp.value': 4 });
		expect(actor.tags.has('self:fullHp')).toBe(false);
		expect(actor.system.skills.stealth.bonus).toBe(0);

		await actor.update({ 'system.attributes.hp.value': 10 });
		expect(actor.tags.has('self:fullHp')).toBe(true);
		expect(actor.system.skills.stealth.bonus).toBe(3);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
	}, 30_000);

	test('self:bloodied is available to data-prep rules in the same cycle', async () => {
		const [item] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Cornered Fighter`, [
				{
					type: 'skillBonus',
					value: '2',
					skills: ['might'],
					predicate: { $and: ['self:bloodied'] },
				},
			]),
		]);

		// The previous test dipped below half HP; the health-state sync mirrors
		// bloodied into a status effect asynchronously, so wait for convergence
		// before asserting the clean baseline.
		await waitFor(() => !actor.tags.has('self:bloodied'), 'the bloodied status sync to settle');
		expect(actor.system.skills.might.bonus).toBe(0);

		// Exactly half HP is bloodied via the hp ratio, in the same cycle as the
		// update — no status round-trip needed.
		await actor.update({ 'system.attributes.hp.value': 5 });
		expect(actor.tags.has('self:bloodied')).toBe(true);
		expect(actor.system.skills.might.bonus).toBe(2);

		// Healing clears the ratio immediately, but the mirrored status is
		// removed asynchronously — poll until the tag drops.
		await actor.update({ 'system.attributes.hp.value': 10 });
		await waitFor(
			() => actor.system.skills.might.bonus === 0,
			'the bloodied bonus to clear after healing',
		);

		await actor.deleteEmbeddedDocuments('Item', [item.id]);
	}, 30_000);
});
