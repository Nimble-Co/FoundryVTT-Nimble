/**
 * Live regression tests for the toggleEffect rule (and its modifyToggle
 * companion): activating the owning item creates a copy of the item's effect,
 * the configured tags feed sibling rules' predicates through live data prep,
 * the copy's Lasts Until ends it (with the ended-effects chat line),
 * modifyToggle drops a moment from a new copy, and deleting the owning item
 * cleans up the stranded effect.
 *
 * Trigger dispatch runs through ruleEventDispatch, which is gated on the
 * `automation.applyRuleEffects` world setting — enabled for this suite.
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

const TEST_PREFIX = 'V14 Toggle Effect';
const TOGGLE_RULE_ID = 'test-rage-toggle';

const restMoment = {
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: 'holder',
	event: 'rest',
	effectName: '',
};

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
	items: {
		get(id: string):
			| (Item & {
					effects: { contents: Array<{ id: string }> };
					update(changes: Record<string, unknown>): Promise<unknown>;
			  })
			| undefined;
	};
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
		originalAutoApply = getRuleAutomationEnabled();
		if (!originalAutoApply) await setRuleAutomationEnabled(true);

		actor = (await Actor.create({
			name: `${TEST_PREFIX} Actor`,
			type: 'character',
		})) as unknown as ToggleActor;
		await actor.update({
			'system.attributes.hp.max': 10,
			'system.attributes.hp.value': 10,
		});

		const toggleRule = {
			type: 'toggleEffect',
			id: TOGGLE_RULE_ID,
			label: 'Test Rage',
			tags: ['test-raging'],
		};
		const [toggleItem] = await actor.createEmbeddedDocuments('Item', [
			{
				...ruleFeatureData(`${TEST_PREFIX} Rage`, [toggleRule]),
				effects: [
					{
						name: 'Test Raging',
						type: 'nimble',
						transfer: false,
						system: { lastsUntil: [restMoment] },
					},
				],
			},
		]);
		toggleItemId = toggleItem.id;
		toggleItemUuid = toggleItem.uuid;
		const item = actor.items.get(toggleItemId)!;
		await item.update({
			'system.rules': [{ ...toggleRule, effectId: item.effects.contents[0]!.id }],
		});

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
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('activating the owning item creates the backing effect and its tags feed data prep', async () => {
		expect(backingEffects()).toHaveLength(0);
		expect(actor.system.skills.might.bonus).toBe(0);

		await activateToggle();
		await waitFor(() => backingEffects().length === 1, 'the backing effect to be created');

		const effect = backingEffects()[0]!;
		expect(effect.name, 'a copy of the item effect').toBe('Test Raging');
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

	test('the Lasts Until of the copy ends the toggle, with the ended-effects chat line', async () => {
		expect(backingEffects()).toHaveLength(1);
		const messagesBefore = game.messages.contents.length;

		await actor.triggerRest({ restType: 'field', skipChatCard: true });
		await waitFor(() => backingEffects().length === 0, 'the rest moment to end the effect');
		await waitFor(
			() =>
				game.messages.contents
					.slice(messagesBefore)
					.some((message) => (message as { type?: string }).type === 'effectsEnded'),
			'the ended-effects chat message',
		);

		await waitFor(() => actor.system.skills.might.bonus === 0, 'the bonus to drop');
	}, 60_000);

	test('modifyToggle drops a moment from the next copy', async () => {
		const [modifierItem] = await actor.createEmbeddedDocuments('Item', [
			ruleFeatureData(`${TEST_PREFIX} Deep Rage`, [
				{
					type: 'modifyToggle',
					toggleIdentifier: TOGGLE_RULE_ID,
					dropMoments: ['rest'],
				},
			]),
		]);

		await activateToggle();
		await waitFor(() => backingEffects().length === 1, 'the copy without the rest moment');
		await actor.triggerRest({ restType: 'field', skipChatCard: true });
		await settle(1200);
		expect(backingEffects(), 'the dropped rest moment must not end the toggle').toHaveLength(1);

		await actor.deleteEmbeddedDocuments('Item', [modifierItem.id]);
	}, 60_000);

	test('deleting the owning item cleans up a live backing effect', async () => {
		expect(backingEffects()).toHaveLength(1);

		await actor.deleteEmbeddedDocuments('Item', [toggleItemId]);
		await waitFor(
			() => backingEffects().length === 0,
			'the effect to be removed with its owning item',
		);
	}, 60_000);
});
