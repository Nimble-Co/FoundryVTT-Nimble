/**
 * Live regression tests for Movement Offers. A feature with a `move` effect
 * node makes an offer to each creature it applies to, and that creature then
 * carries the offer: its drag reports the offered limit and the offered
 * movement action, and the finished Movement is recorded on the card.
 *
 * The drag itself is a mouse gesture this in-page harness cannot perform, so
 * the limit and the action are read from the seams Foundry asks during a drag,
 * and the recording is driven by real Movements of the token document.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
	clearTargets,
	createViewedTestScene,
	GRID_SIZE,
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
const FORCED_ACTION = `${game.system.id}Forced`;

interface DraggableToken {
	_getDragConstrainOptions(): { maxDistance?: number; maxCost?: number };
	_getDragLeftDropUpdateOptions(): { constrainOptions?: { maxDistance?: number } };
	_getDragMovementAction(): string;
}

interface OfferEntry {
	tokenUuid: string;
	spaces: number;
	used: boolean;
	movedSpaces: number | null;
	stopped: boolean;
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
	let combat: Combat;
	let card: ChatMessage;

	function placeable(): DraggableToken {
		return canvas.tokens?.get(goblinToken.id!) as unknown as DraggableToken;
	}

	function offers(): OfferEntry[] {
		return (card.system as unknown as { movementOffers: OfferEntry[] }).movementOffers;
	}

	function moveNodeText(): string {
		return (messageNode(card.id!)?.querySelector('.nimble-move-node')?.textContent ?? '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	async function activateShove(): Promise<ChatMessage> {
		await targetToken(goblinToken);
		const message = await messageFromFlow('feature', () =>
			(feature as unknown as { activate: (o: object) => Promise<unknown> }).activate({
				fastForward: true,
			}),
		);
		expect(message, 'the shove should post a card').toBeTruthy();
		await waitFor(
			() => !!messageNode(message!.id!)?.querySelector('.nimble-move-node'),
			'the move node on the card',
		);
		return message!;
	}

	async function moveGoblin(x: number, y: number, action?: string): Promise<void> {
		await goblinToken.move({ x, y, ...(action ? { action } : {}) } as never);
		await settle(700);
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
		// A started combat is what makes Foundry record Movement history, which
		// the drop limit has to account for.
		combat = (await Combat.create({ active: true, scene: scene.id } as Combat.CreateData))!;
		await combat.createEmbeddedDocuments('Combatant', [
			{ actorId: goblin.id, tokenId: goblinToken.id, sceneId: scene.id, type: 'npc' },
		] as Combatant.CreateData[]);
		await combat.startCombat();

		ui.sidebar.changeTab?.('chat', 'primary');
		await settle(300);
	}, 60_000);

	beforeEach(async () => {
		await setAutomationToggle(OFFERS_SETTING, true);
		await goblinToken.update({ x: 3 * GRID_SIZE, y: 2 * GRID_SIZE });
		card = await activateShove();
	}, 60_000);

	afterAll(async () => {
		await combat?.delete().catch((error) => console.error(error));
		await clearTargets();
		await setAutomationToggle(OFFERS_SETTING, offersWereEnabled);
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the card states the offer, with nothing to click', () => {
		expect(moveNodeText()).toContain(`${goblin.name}: up to 2 spaces away from ${hero.name}`);
		expect(moveNodeText()).toContain(`${hero.name} chooses where.`);
		expect(messageNode(card.id!)?.querySelectorAll('.nimble-move-node button')).toHaveLength(0);
	});

	test('the offered token drags under the offer', () => {
		// The scene measures one space as one unit, so the cap is the spaces offered.
		expect(placeable()._getDragConstrainOptions()).toMatchObject({ maxDistance: 2 });
		expect(placeable()._getDragMovementAction()).toBe(FORCED_ACTION);
	});

	test('a token carrying no offer drags as usual', () => {
		const heroPlaceable = canvas.tokens?.placeables.find(
			(token) => token.name === hero.name,
		) as unknown as DraggableToken;
		expect(heroPlaceable._getDragConstrainOptions().maxDistance).toBeUndefined();
		expect(heroPlaceable._getDragMovementAction()).not.toBe(FORCED_ACTION);
	});

	test('the drop limit carries what the token already moved this turn', async () => {
		// Take the standing offer, so the token has Movement history, then let the
		// feature offer again.
		await moveGoblin(5 * GRID_SIZE, 2 * GRID_SIZE, FORCED_ACTION);
		await waitFor(() => offers().some((entry) => entry.used), 'the first offer to be recorded');
		card = await activateShove();

		const moved = (
			goblinToken.measureMovementPath(goblinToken.movementHistory as never) as {
				distance: number;
			}
		).distance;
		expect(moved, 'the token should have recorded history to account for').toBeGreaterThan(0);

		// Foundry measures the preview from the drag's own origin and the drop
		// across the history and the new path together, so the two differ.
		expect(placeable()._getDragConstrainOptions()).toMatchObject({ maxDistance: 2 });
		expect(placeable()._getDragLeftDropUpdateOptions().constrainOptions?.maxDistance).toBe(
			2 + moved,
		);
	});

	test('a forced Movement is recorded on the card as the offer being taken', async () => {
		await moveGoblin(5 * GRID_SIZE, 2 * GRID_SIZE, FORCED_ACTION);
		await waitFor(() => offers().some((entry) => entry.used), 'the offer to be recorded');

		const entry = offers().at(-1)!;
		expect(entry.tokenUuid).toBe(goblinToken.uuid);
		expect(entry.spaces).toBe(2);
		expect(entry.movedSpaces).toBe(2);
		await waitFor(() => moveNodeText().includes('moved 2 of 2 spaces'), 'the result on the card');
	});

	test('the offer is spent unused when the creature moves on its own instead', async () => {
		await moveGoblin(5 * GRID_SIZE, 2 * GRID_SIZE);
		await waitFor(() => offers().some((entry) => entry.used), 'the offer to be spent');

		expect(offers().at(-1)!.movedSpaces).toBeNull();
		await waitFor(
			() => moveNodeText().includes('moved on its own'),
			'the unused note on the card',
		);
		// Spent, so a later Movement is no longer limited.
		expect(placeable()._getDragConstrainOptions().maxDistance).toBeUndefined();
		expect(placeable()._getDragMovementAction()).not.toBe(FORCED_ACTION);
	});

	test('with Movement Offers off nothing is limited or labelled', async () => {
		await setAutomationToggle(OFFERS_SETTING, false);
		expect(moveNodeText()).toContain('up to 2 spaces away from');
		expect(placeable()._getDragConstrainOptions().maxDistance).toBeUndefined();
		expect(placeable()._getDragMovementAction()).not.toBe(FORCED_ACTION);
	});
});
