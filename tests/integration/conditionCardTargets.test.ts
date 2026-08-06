/**
 * Live regression tests for applying a condition from a chat card, merged from
 * dev: the card's condition chip applies to the *card's* targets (not the
 * clicking user's canvas selection) and records what caused it.
 *
 * These also pin the V14 adaptation of that path. Core's `toggleStatusEffect`
 * changed in V14 to create from `effect.toObject()` rather than the effect
 * itself, because `updateDuration` assigns a *derived* duration object over the
 * live field. Creating from the document would clean `label`/`remaining`/an
 * `Infinity` value into stored data, which only a real database round-trip can
 * demonstrate.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	clearTargets,
	createViewedTestScene,
	messageFromFlow,
	messageNode,
	placeToken,
	purgeTestDocuments,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Condition Card';

/** A roll-less feature whose card carries a single condition chip. */
function conditionFeatureData(name: string, condition: string, targetCount = 1) {
	return {
		name,
		type: 'feature',
		system: {
			activation: {
				cost: { type: 'action', quantity: 1 },
				targets: { attackType: 'reach', count: targetCount },
				effects: [
					{
						id: 'cond',
						type: 'condition',
						condition,
						parentNode: null,
						parentContext: null,
					},
				],
			},
		},
	};
}

/** Click the card's condition chip the way a GM does. */
async function clickConditionChip(messageId: string): Promise<void> {
	let button: HTMLButtonElement | null = null;
	await waitFor(() => {
		button =
			messageNode(messageId)?.querySelector<HTMLButtonElement>(
				'.nimble-button[data-enricher-type="condition"]',
			) ?? null;
		return button !== null;
	}, `condition chip on message ${messageId}`);

	button!.click();
	await settle(800);
}

describe('applying a condition from a chat card', () => {
	let sourceActor: Actor;
	let targetActor: Actor;
	let bystanderActor: Actor;
	let scene: Scene;
	let targetToken_: TokenDocument;
	let bystanderToken: TokenDocument;
	let feature: Item;
	let multiTargetFeature: Item;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);

		sourceActor = (await Actor.create({
			name: `${TEST_PREFIX} Caster`,
			type: 'character',
		}))!;
		targetActor = (await Actor.create({
			name: `${TEST_PREFIX} Target`,
			type: 'character',
		}))!;
		bystanderActor = (await Actor.create({
			name: `${TEST_PREFIX} Bystander`,
			type: 'character',
		}))!;

		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);

		// actorLink so token writes reach the base actor these tests assert on.
		await placeToken(scene, {
			name: `${TEST_PREFIX} Caster Token`,
			actor: sourceActor,
			gx: 1,
			gy: 1,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		targetToken_ = await placeToken(scene, {
			name: `${TEST_PREFIX} Target Token`,
			actor: targetActor,
			gx: 3,
			gy: 1,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			actorLink: true,
		});
		bystanderToken = await placeToken(scene, {
			name: `${TEST_PREFIX} Bystander Token`,
			actor: bystanderActor,
			gx: 5,
			gy: 1,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			actorLink: true,
		});

		const [created, createdMulti] = await sourceActor.createEmbeddedDocuments('Item', [
			conditionFeatureData(`${TEST_PREFIX} Dazing Strike`, 'dazed') as Item.CreateData,
			conditionFeatureData(`${TEST_PREFIX} Dazing Burst`, 'dazed', 2) as Item.CreateData,
		]);
		feature = created!;
		multiTargetFeature = createdMulti!;
	}, 120_000);

	afterAll(async () => {
		await clearTargets();
		await purgeTestDocuments(TEST_PREFIX);
	});

	/** Post a card whose recorded targets are exactly `tokens`. */
	async function postCardTargeting(tokens: TokenDocument[], item: Item = feature) {
		await clearTargets();
		// `targetToken` releases others, so only the last would remain; add the rest.
		for (const [index, token] of tokens.entries()) {
			const placeable = canvas.tokens?.get(token.id!);
			placeable?.setTarget(true, { releaseOthers: index === 0 });
		}
		await settle(300);

		const message = await messageFromFlow('feature', () =>
			(item as unknown as { activate(options: object): Promise<unknown> }).activate({}),
		);
		if (!message) throw new Error('activation posted no feature card');
		return message;
	}

	async function clearCondition(actor: Actor, statusId: string) {
		const typed = actor as unknown as {
			statuses: Set<string>;
			toggleStatusEffect(id: string, options: { active: boolean }): Promise<unknown>;
		};
		if (typed.statuses.has(statusId)) {
			await typed.toggleStatusEffect(statusId, { active: false }).catch(() => {});
		}
		await waitFor(() => !typed.statuses.has(statusId), `${statusId} to clear from ${actor.name}`);
	}

	test('applies to the card targets and records the causing item as the origin', async () => {
		const message = await postCardTargeting([targetToken_]);

		expect((targetActor as unknown as { statuses: Set<string> }).statuses.has('dazed')).toBe(false);

		await clickConditionChip(message.id!);
		await waitFor(
			() => (targetActor as unknown as { statuses: Set<string> }).statuses.has('dazed'),
			'dazed to reach the card target',
		);

		const effect = (
			targetActor as unknown as {
				effects: { contents: Array<{ statuses: Set<string>; origin: string | null }> };
			}
		).effects.contents.find((candidate) => candidate.statuses.has('dazed'))!;

		// The item is what the card names as the cause, not the caster.
		expect(effect.origin).toBe(feature.uuid);

		await clearCondition(targetActor, 'dazed');
	}, 120_000);

	test('stores a clean duration, without the derived fields V14 adds when prepared', async () => {
		const message = await postCardTargeting([targetToken_]);
		await clickConditionChip(message.id!);
		await waitFor(
			() => (targetActor as unknown as { statuses: Set<string> }).statuses.has('dazed'),
			'dazed to reach the card target',
		);

		const effect = (
			targetActor as unknown as {
				effects: {
					contents: Array<{ statuses: Set<string>; toObject(): Record<string, unknown> }>;
				};
			}
		).effects.contents.find((candidate) => candidate.statuses.has('dazed'))!;

		// `_source` is what round-tripped through the database. A document created
		// from its prepared self would carry `updateDuration`'s derived output here.
		const storedDuration = (effect.toObject().duration ?? {}) as Record<string, unknown>;
		for (const derivedKey of ['label', 'remaining', 'secondsRemaining']) {
			expect(storedDuration).not.toHaveProperty(derivedKey);
		}
		expect(storedDuration.seconds === Infinity).toBe(false);

		await clearCondition(targetActor, 'dazed');
	}, 120_000);

	test('ignores creatures the card did not target', async () => {
		const message = await postCardTargeting([targetToken_]);
		await clickConditionChip(message.id!);
		await waitFor(
			() => (targetActor as unknown as { statuses: Set<string> }).statuses.has('dazed'),
			'dazed to reach the card target',
		);

		// The bystander is on the scene and adjacent in the turn order, but was
		// never a target of this card.
		expect((bystanderActor as unknown as { statuses: Set<string> }).statuses.has('dazed')).toBe(
			false,
		);

		await clearCondition(targetActor, 'dazed');
	}, 120_000);

	test('applies to every target on a multi-target card', async () => {
		const message = await postCardTargeting([targetToken_, bystanderToken], multiTargetFeature);
		await clickConditionChip(message.id!);

		await waitFor(
			() =>
				(targetActor as unknown as { statuses: Set<string> }).statuses.has('dazed') &&
				(bystanderActor as unknown as { statuses: Set<string> }).statuses.has('dazed'),
			'dazed to reach both card targets',
		);

		await clearCondition(targetActor, 'dazed');
		await clearCondition(bystanderActor, 'dazed');
	}, 120_000);

	test('a second click does not stack a duplicate effect', async () => {
		const message = await postCardTargeting([targetToken_]);
		await clickConditionChip(message.id!);
		await waitFor(
			() => (targetActor as unknown as { statuses: Set<string> }).statuses.has('dazed'),
			'dazed to reach the card target',
		);

		const countOf = () =>
			(
				targetActor as unknown as { effects: { contents: Array<{ statuses: Set<string> }> } }
			).effects.contents.filter((effect) => effect.statuses.has('dazed')).length;
		const afterFirst = countOf();

		await clickConditionChip(message.id!);
		await settle(1200);

		expect(countOf()).toBe(afterFirst);

		await clearCondition(targetActor, 'dazed');
	}, 120_000);
});
