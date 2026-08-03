/**
 * Live regression tests for the roll-mode rules merged from dev:
 * `skillRollMode` mutates `system.skills.<key>.defaultRollMode` and
 * `initiativeRollMode` mutates `system.attributes.initiative.defaultRollMode`
 * during data prep. Real document round-trips prove the rules run inside
 * Foundry V14's preparation cycle, not just in the mocked unit harness.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	getRuleAutomationEnabled,
	purgeTestDocuments,
	ruleFeatureData,
	setRuleAutomationEnabled,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Roll Mode';

interface RollModeActor {
	id: string;
	system: {
		skills: Record<string, { defaultRollMode: number }>;
		attributes: { initiative: { defaultRollMode: number }; hp: { value: number; max: number } };
	};
	items: { get(id: string): Item | undefined };
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Array<{ id: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	rollSkillCheck(
		skill: string,
		options: Record<string, unknown>,
	): Promise<{ rollData: { rollFormula: string } }>;
}

describe('roll-mode rules', () => {
	let actor: RollModeActor;
	let originalAutoApply: boolean;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		// Keep rule automation out of the picture so hp swings don't fire
		// condition/trigger side effects beyond the always-on health-state sync.
		originalAutoApply = getRuleAutomationEnabled();
		if (originalAutoApply) await setRuleAutomationEnabled(false);
		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as RollModeActor;
		// Classless characters keep their stored hp values (class derivation
		// early-returns), and a blank character starts at 0/0.
		await actor.update({
			'system.attributes.hp.max': 10,
			'system.attributes.hp.value': 10,
		});
	}, 60_000);

	afterAll(async () => {
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** Embed a feature carrying `rules`, run `body`, always delete the feature. */
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

	test('skillRollMode adjust applies to the named skill only and seeds the roll', async () => {
		expect(actor.system.skills.stealth.defaultRollMode).toBe(0);

		await withRuleFeature(
			[{ type: 'skillRollMode', skills: ['stealth'], mode: 'adjust', value: 1 }],
			async () => {
				expect(actor.system.skills.stealth.defaultRollMode).toBe(1);
				expect(actor.system.skills.perception.defaultRollMode).toBe(0);

				const { rollData } = await actor.rollSkillCheck('stealth', { skipRollDialog: true });
				expect(rollData.rollFormula).toMatch(/2d20kh/);
			},
		);

		expect(actor.system.skills.stealth.defaultRollMode).toBe(0);
	}, 30_000);

	test('adjust rules stack and set mode overrides the adjusted total', async () => {
		await withRuleFeature(
			[
				{ type: 'skillRollMode', skills: ['stealth'], mode: 'adjust', value: 1 },
				{ type: 'skillRollMode', skills: ['stealth'], mode: 'adjust', value: 1 },
			],
			() => {
				expect(actor.system.skills.stealth.defaultRollMode).toBe(2);
			},
		);

		// The set rule runs after the adjusts (higher priority = later), so it
		// wins regardless of what they accumulated.
		await withRuleFeature(
			[
				{ type: 'skillRollMode', skills: ['stealth'], mode: 'adjust', value: 1 },
				{ type: 'skillRollMode', skills: ['stealth'], mode: 'set', value: -2, priority: 99 },
			],
			() => {
				expect(actor.system.skills.stealth.defaultRollMode).toBe(-2);
			},
		);
	}, 30_000);

	test("the 'all' sentinel applies to every configured skill", async () => {
		await withRuleFeature(
			[{ type: 'skillRollMode', skills: ['all'], mode: 'adjust', value: 1 }],
			() => {
				for (const key of Object.keys(CONFIG.NIMBLE.skills)) {
					expect(actor.system.skills[key]?.defaultRollMode, `skill "${key}"`).toBe(1);
				}
			},
		);
	}, 30_000);

	test('disabled rules contribute nothing', async () => {
		await withRuleFeature(
			[{ type: 'skillRollMode', skills: ['stealth'], mode: 'adjust', value: 3, disabled: true }],
			() => {
				expect(actor.system.skills.stealth.defaultRollMode).toBe(0);
			},
		);
	}, 30_000);

	test('predicate gating flips live with actor state', async () => {
		await withRuleFeature(
			[
				{
					type: 'skillRollMode',
					skills: ['stealth'],
					mode: 'adjust',
					value: 1,
					predicate: { $and: ['self:bloodied'] },
				},
			],
			async () => {
				// At full HP the bloodied predicate fails.
				expect(actor.system.skills.stealth.defaultRollMode).toBe(0);

				// The hp-ratio half of the bloodied tag applies in the same cycle.
				await actor.update({ 'system.attributes.hp.value': 5 });
				expect(actor.system.skills.stealth.defaultRollMode).toBe(1);

				// Healing clears the ratio immediately, but the system's health-state
				// sync also mirrors bloodied into a status effect and removes it
				// asynchronously — poll until it converges.
				await actor.update({ 'system.attributes.hp.value': 10 });
				await waitFor(
					() => actor.system.skills.stealth.defaultRollMode === 0,
					'the bloodied gate to release after healing',
				);
			},
		);
	}, 30_000);

	test('initiativeRollMode set and adjust mutate the initiative roll mode', async () => {
		expect(actor.system.attributes.initiative.defaultRollMode).toBe(0);

		await withRuleFeature([{ type: 'initiativeRollMode', mode: 'adjust', value: 1 }], () => {
			expect(actor.system.attributes.initiative.defaultRollMode).toBe(1);
		});

		await withRuleFeature(
			[
				{ type: 'initiativeRollMode', mode: 'adjust', value: 1 },
				{ type: 'initiativeRollMode', mode: 'set', value: -1, priority: 99 },
			],
			() => {
				expect(actor.system.attributes.initiative.defaultRollMode).toBe(-1);
			},
		);

		await withRuleFeature(
			[{ type: 'initiativeRollMode', mode: 'adjust', value: 2, disabled: true }],
			() => {
				expect(actor.system.attributes.initiative.defaultRollMode).toBe(0);
			},
		);
	}, 30_000);
});
