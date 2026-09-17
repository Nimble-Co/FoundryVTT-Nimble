/**
 * Live regression tests for Movement Offers: a feature with a `move` effect
 * node puts a Move button on its chat card, a real click on that button starts
 * a constrained movement plan on the canvas for the recipient token, and the
 * Movement Offers toggle turns the button into plain text.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	clearTargets,
	createViewedTestScene,
	getAutomationToggle,
	messageFromFlow,
	messageNode,
	placeToken,
	purgeTestDocuments,
	setAutomationToggle,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Movement Offers';
const OFFERS_SETTING = 'automation.movementOffers';

interface PlanningLayer {
	_movementPlanningContext: {
		object: { id: string };
		allowedActions: string[] | null;
		direct: boolean;
		maxDistance: number;
		maxCost: number;
	} | null;
	_cancelMovementPlanning(): void;
}

function planningLayer(): PlanningLayer {
	return canvas.tokens as unknown as PlanningLayer;
}

function moveNodeText(messageId: string): string {
	return (messageNode(messageId)?.querySelector('.nimble-move-node')?.textContent ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

function moveButton(messageId: string): HTMLButtonElement | null {
	const buttons =
		messageNode(messageId)?.querySelectorAll<HTMLButtonElement>('.nimble-move-node button') ?? [];
	return [...buttons].find((button) => (button.textContent ?? '').includes('Move (up to')) ?? null;
}

function shoveFeatureData(name: string) {
	return {
		name,
		type: 'feature',
		system: {
			activation: {
				cost: { type: 'action', quantity: 1 },
				targets: { attackType: 'reach', count: 1 },
				effects: [
					{
						id: 'shove',
						type: 'move',
						kind: 'forced',
						recipient: 'targets',
						distance: '2',
						distanceBySize: {},
						ignoreDifficultTerrain: true,
						direction: 'away',
						chooser: 'source',
						parentNode: null,
						parentContext: null,
					},
				],
			},
		},
	};
}

describe('movement offers', () => {
	let hero: Actor;
	let goblin: Actor;
	let goblinToken: TokenDocument;
	let feature: Item;
	let offersWereEnabled: boolean;

	async function activateShove(): Promise<ChatMessage> {
		await targetToken(goblinToken);
		const message = await messageFromFlow('feature', () =>
			(feature as unknown as { activate: (o: object) => Promise<unknown> }).activate({
				fastForward: true,
			}),
		);
		expect(message).toBeTruthy();
		await waitFor(
			() => !!messageNode(message!.id!)?.querySelector('.nimble-move-node'),
			'move node',
		);
		return message!;
	}

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		offersWereEnabled = getAutomationToggle(OFFERS_SETTING);
		await setAutomationToggle(OFFERS_SETTING, true);

		hero = (await Actor.create({ name: `${TEST_PREFIX} Hero`, type: 'character' }))!;
		goblin = (await Actor.create({ name: `${TEST_PREFIX} Goblin`, type: 'npc' }))!;
		[feature] = (await hero.createEmbeddedDocuments('Item', [
			shoveFeatureData(`${TEST_PREFIX} Shove`),
		] as never[])) as unknown as Item[];
		const scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		await placeToken(scene, {
			name: hero.name,
			actor: hero,
			gx: 2,
			gy: 2,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		goblinToken = await placeToken(scene, {
			name: goblin.name,
			actor: goblin,
			gx: 3,
			gy: 2,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			actorLink: true,
		});
		ui.sidebar.changeTab?.('chat', 'primary');
		await settle(300);
	}, 60_000);

	afterAll(async () => {
		planningLayer()._cancelMovementPlanning();
		await clearTargets();
		await setAutomationToggle(OFFERS_SETTING, offersWereEnabled);
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the card offers the push to the target with the distance and a Move button', async () => {
		const message = await activateShove();
		expect(moveNodeText(message.id!)).toContain(
			`${goblin.name}: up to 2 spaces away from ${hero.name}`,
		);
		expect(moveNodeText(message.id!)).toContain(`${hero.name} chooses where.`);
		expect(moveButton(message.id!)).not.toBeNull();
	});

	test('clicking Move starts a straight, two-space forced plan on the target token', async () => {
		const message = await activateShove();
		moveButton(message.id!)!.click();
		await waitFor(() => !!planningLayer()._movementPlanningContext, 'movement planning context');

		const context = planningLayer()._movementPlanningContext!;
		expect(context.object.id).toBe(goblinToken.id);
		expect(context.allowedActions).toEqual(['nimbleForced']);
		expect(context.direct).toBe(true);
		expect(context.maxDistance).toBe(2);
		expect(context.maxCost).toBe(Number.POSITIVE_INFINITY);

		// Escape on the canvas dismisses the plan; the card keeps its button.
		planningLayer()._cancelMovementPlanning();
		await settle(500);
		expect(planningLayer()._movementPlanningContext).toBeNull();
		expect(moveButton(message.id!)).not.toBeNull();
		expect(
			(message.system as unknown as { movementOffers: unknown[] }).movementOffers,
		).toHaveLength(0);
	});

	test('with Movement Offers off the card shows the distance as text only', async () => {
		await setAutomationToggle(OFFERS_SETTING, false);
		const message = await activateShove();
		expect(moveNodeText(message.id!)).toContain('up to 2 spaces away from');
		expect(moveButton(message.id!)).toBeNull();
		await setAutomationToggle(OFFERS_SETTING, true);
	});
});
