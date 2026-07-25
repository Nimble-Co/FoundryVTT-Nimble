/**
 * Live regression tests for the toggleEffect rule (and its modifyToggle
 * companion) merged from dev: activating the owning item creates a real
 * backing ActiveEffect, the configured tags feed sibling rules' predicates
 * through live data prep, turn-off triggers delete the effect (with chat
 * announcement), modifyToggle suppresses configured turn-offs, and deleting
 * the owning item cleans up the stranded effect.
 *
 * Trigger dispatch runs through ruleEventDispatch, which is gated on the
 * `automation.autoApplyConditions` world setting — enabled for this suite.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	getAutoApplyConditions,
	purgeTestDocuments,
	ruleFeatureData,
	setAutoApplyConditions,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Toggle Effect';
const TOGGLE_RULE_ID = 'test-rage-toggle';

interface ToggleEffectLike {
	id: string;
	name: string;
	disabled: boolean;
	origin: string | null;
	getFlag(scope: string, key: string): unknown;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

interface ToggleActor {
	id: string;
	tags: Set<string>;
	system: { skills: Record<string, { bonus: number }> };
	effects: { contents: ToggleEffectLike[] };
	items: { get(id: string): Item | undefined };
	createEmbeddedDocuments(
		type: 'Item',
		data: object[],
	): Promise<Array<{ id: string; uuid: string }>>;
	deleteEmbeddedDocuments(type: 'Item', ids: string[]): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
	/** Character-only: runs the rest flow and fires the `rest` rule hook. */
	triggerRest(options: { restType: 'field' | 'safe'; skipChatCard: boolean }): Promise<void>;
}

describe('toggleEffect rule', () => {
	let actor: ToggleActor;
	let toggleItemId: string;
	let toggleItemUuid: string;
	let originalAutoApply: boolean;

	const backingEffects = () =>
		actor.effects.contents.filter(
			(effect) => effect.getFlag(game.system.id, 'toggleEffectRuleId') === TOGGLE_RULE_ID,
		);

	async function activateToggle() {
		const item = actor.items.get(toggleItemId)!;
		await (item as unknown as { activate(options: object): Promise<unknown> }).activate({
			fastForward: true,
		});
	}

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalAutoApply = getAutoApplyConditions();
		if (!originalAutoApply) await setAutoApplyConditions(true);

		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as ToggleActor;
		await actor.update({
			'system.attributes.hp.max': 10,
			'system.attributes.hp.value': 10,
		});

		const [toggleItem] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Rage`, [
				{
					type: 'toggleEffect',
					id: TOGGLE_RULE_ID,
					label: 'Test Rage',
					tags: ['test-raging'],
					turnOff: ['onRest'],
				},
			]),
		]);
		toggleItemId = toggleItem.id;
		toggleItemUuid = toggleItem.uuid;

		// A sibling bonus gated on the toggle's tag, to prove the tag reaches
		// live data prep while the backing effect is enabled.
		await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Fury Bonus`, [
				{
					type: 'skillBonus',
					value: '2',
					skills: ['might'],
					predicate: { $and: ['test-raging'] },
				},
			]),
		]);
	}, 60_000);

	afterAll(async () => {
		if (getAutoApplyConditions() !== originalAutoApply) {
			await setAutoApplyConditions(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('activating the owning item creates the backing effect and its tags feed data prep', async () => {
		expect(backingEffects()).toHaveLength(0);
		expect(actor.system.skills.might.bonus).toBe(0);

		await activateToggle();
		await waitFor(() => backingEffects().length === 1, 'the backing effect to be created');

		const effect = backingEffects()[0]!;
		expect(effect.name).toBe('Test Rage');
		expect(effect.origin).toBe(toggleItemUuid);
		expect(effect.getFlag(game.system.id, 'toggleEffectItemId')).toBe(toggleItemId);

		await waitFor(
			() => actor.tags.has('test-raging') && actor.system.skills.might.bonus === 2,
			'the toggle tag to gate the sibling bonus on',
		);
	}, 60_000);

	test('re-activating while on does not duplicate the effect', async () => {
		await activateToggle();
		await settle(800);
		expect(backingEffects()).toHaveLength(1);
	}, 60_000);

	test('disabling the backing effect suspends the tag; re-enabling restores it', async () => {
		const effect = backingEffects()[0]!;

		await effect.update({ disabled: true });
		await waitFor(
			() => !actor.tags.has('test-raging') && actor.system.skills.might.bonus === 0,
			'the tag and bonus to drop while disabled',
		);

		await effect.update({ disabled: false });
		await waitFor(
			() => actor.system.skills.might.bonus === 2,
			'the bonus to return when re-enabled',
		);
	}, 60_000);

	test('modifyToggle suppresses a configured turn-off trigger', async () => {
		const [modifierItem] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Deep Rage`, [
				{
					type: 'modifyToggle',
					toggleIdentifier: TOGGLE_RULE_ID,
					suppressTurnOff: ['onRest'],
				},
			]),
		]);

		await actor.triggerRest({ restType: 'field', skipChatCard: true });
		await settle(1200);
		expect(backingEffects(), 'the suppressed rest must not end the toggle').toHaveLength(1);

		await actor.deleteEmbeddedDocuments('Item', [modifierItem.id]);
	}, 60_000);

	test('a turn-off trigger deletes the effect and announces the end', async () => {
		expect(backingEffects()).toHaveLength(1);
		const messagesBefore = game.messages.contents.length;

		await actor.triggerRest({ restType: 'field', skipChatCard: true });
		await waitFor(() => backingEffects().length === 0, 'the rest turn-off to delete the effect');
		await waitFor(
			() =>
				game.messages.contents
					.slice(messagesBefore)
					.some((message) => (message.content ?? '').includes('Test Rage')),
			'the end announcement chat message',
		);

		// The tag-driven bonus falls away with the effect.
		await waitFor(() => actor.system.skills.might.bonus === 0, 'the bonus to drop');
	}, 60_000);

	test('deleting the owning item cleans up a live backing effect', async () => {
		await activateToggle();
		await waitFor(() => backingEffects().length === 1, 'the backing effect to be re-created');

		await actor.deleteEmbeddedDocuments('Item', [toggleItemId]);
		await waitFor(
			() => backingEffects().length === 0,
			'the effect to be removed with its owning item',
		);
	}, 60_000);
});
