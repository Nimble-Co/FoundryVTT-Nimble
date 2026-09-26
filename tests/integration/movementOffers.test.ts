/**
 * Live regression tests for Movement Offers. A feature with a `move` effect
 * node stamps an offer on its card for each creature it applies to, and that
 * creature then carries the offer: its drag is labelled with the offered
 * movement action and names the offer, nothing stops a drag that goes further,
 * and the finished Movement is recorded on the card.
 *
 * The drag itself is a mouse gesture this in-page harness cannot perform, so
 * the label and the name are read from the seams Foundry asks during a drag,
 * and the recording is driven by real Movements of the token document carrying
 * the same options a drop would.
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
const TAG_KEY = 'nimbleMovementOffer';

interface OfferTag {
	messageId: string;
	offerId: string;
}

interface DraggableToken {
	_getDragConstrainOptions(): Record<string, unknown>;
	_getDragLeftDropUpdateOptions(): { constrainOptions?: Record<string, unknown> };
	_getDragMovementAction(): string;
}

interface StoredOffer {
	id: string;
	tokenUuid: string;
	spaces: number;
	state: 'open' | 'taken' | 'unused' | 'lapsed';
	movedSpaces: number | null;
}

interface OfferCardDocument extends ChatMessage {
	removeTarget(uuid: string): Promise<unknown>;
	addTargetedTokensAsTargets(): Promise<unknown>;
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
	let card: OfferCardDocument;

	function placeable(): DraggableToken {
		return canvas.tokens?.get(goblinToken.id!) as unknown as DraggableToken;
	}

	function offersOn(message: ChatMessage): StoredOffer[] {
		return (message.system as unknown as { movementOffers: StoredOffer[] }).movementOffers;
	}

	function moveNodeText(message: ChatMessage = card): string {
		return (messageNode(message.id!)?.querySelector('.nimble-move-node')?.textContent ?? '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function dropTag(): OfferTag | undefined {
		return placeable()._getDragLeftDropUpdateOptions().constrainOptions?.[TAG_KEY] as
			| OfferTag
			| undefined;
	}

	async function activateShove(): Promise<OfferCardDocument> {
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
		return message as OfferCardDocument;
	}

	/** Moves the goblin as a drop would: with the drag's action and constrain options. */
	async function moveGoblin(
		gx: number,
		{ action, tag }: { action?: string; tag?: OfferTag } = {},
	): Promise<void> {
		await goblinToken.move(
			{ x: gx * GRID_SIZE, y: 2 * GRID_SIZE, ...(action ? { action } : {}) } as never,
			{
				...(tag ? { constrainOptions: { [TAG_KEY]: tag } } : {}),
			} as never,
		);
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
		await settle(500);
		card = await activateShove();
	}, 60_000);

	afterAll(async () => {
		await combat?.delete().catch((error) => console.error(error));
		await clearTargets();
		await setAutomationToggle(OFFERS_SETTING, offersWereEnabled);
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the card stores the offer when it is posted, with nothing to click', () => {
		expect(offersOn(card)).toMatchObject([
			{ tokenUuid: goblinToken.uuid, spaces: 2, state: 'open', movedSpaces: null },
		]);
		expect(moveNodeText()).toContain(`Forced Movement - away from ${hero.name}`);
		expect(moveNodeText()).toContain(`${goblin.name} up to 2 spaces`);
		expect(moveNodeText()).not.toContain('chooses');
		expect(messageNode(card.id!)?.querySelectorAll('.nimble-move-node button')).toHaveLength(0);
	});

	test('the offered token drags under the offer, and nothing limits the drag', () => {
		expect(placeable()._getDragMovementAction()).toBe(FORCED_ACTION);
		expect(dropTag()).toEqual({ messageId: card.id, offerId: offersOn(card)[0].id });
		for (const options of [
			placeable()._getDragConstrainOptions(),
			placeable()._getDragLeftDropUpdateOptions().constrainOptions ?? {},
		]) {
			expect(options.maxDistance).toBeUndefined();
			expect(options.maxCost).toBeUndefined();
		}
	});

	test('the token ruler is the one that draws the offer', () => {
		const ruler = (canvas.tokens?.get(goblinToken.id!) as unknown as { ruler: object }).ruler;
		expect(ruler.constructor.name).toBe('NimbleTokenRuler');
	});

	test('a token carrying no offer drags as usual', () => {
		const heroPlaceable = canvas.tokens?.placeables.find(
			(token) => token.name === hero.name,
		) as unknown as DraggableToken;
		expect(heroPlaceable._getDragMovementAction()).not.toBe(FORCED_ACTION);
		expect(
			heroPlaceable._getDragLeftDropUpdateOptions().constrainOptions?.[TAG_KEY],
		).toBeUndefined();
	});

	test('a drop past the offer moves the whole way, and the card records the offer taken', async () => {
		await moveGoblin(8, { action: FORCED_ACTION, tag: dropTag() });
		await waitFor(() => offersOn(card)[0].state === 'taken', 'the offer to be recorded');
		// `x` follows the animation; the source holds where the Movement ended.
		expect(goblinToken._source.x, 'nothing should stop the token short').toBe(8 * GRID_SIZE);
		expect(offersOn(card)[0].movedSpaces).toBe(2);
		await waitFor(() => moveNodeText().includes('moved 2 of 2 spaces'), 'the result on the card');
	});

	test('the name settles the offer the drag was made under, even with a newer one open', async () => {
		const first = card;
		const tag = dropTag();
		const second = await activateShove();

		await moveGoblin(5, { action: FORCED_ACTION, tag });
		await waitFor(() => offersOn(first)[0].state === 'taken', 'the named offer to be recorded');
		expect(offersOn(second)[0].state).toBe('open');
	});

	test('a Movement made under no offer leaves the offer unused', async () => {
		await moveGoblin(5);
		await waitFor(() => offersOn(card)[0].state === 'unused', 'the offer to be left unused');
		await waitFor(() => moveNodeText().includes('moved on its own'), 'the unused note on the card');
		expect(placeable()._getDragMovementAction()).not.toBe(FORCED_ACTION);
	});

	test('removing the target withdraws its open offer, and adding it back makes a new one', async () => {
		await card.removeTarget(goblinToken.uuid!);
		await waitFor(() => offersOn(card).length === 0, 'the offer to be withdrawn');

		await targetToken(goblinToken);
		await card.addTargetedTokensAsTargets();
		await waitFor(() => offersOn(card).length === 1, 'the offer to be made again');
		expect(offersOn(card)[0]).toMatchObject({ spaces: 2, state: 'open' });
	});

	test('an offer still open when the turn ends lapses', async () => {
		await combat.nextTurn();
		await waitFor(() => offersOn(card)[0].state === 'lapsed', 'the offer to lapse');
		await waitFor(
			() => moveNodeText().includes('not taken before the turn ended'),
			'the lapse on the card',
		);
		expect(placeable()._getDragMovementAction()).not.toBe(FORCED_ACTION);
	});

	test('with Movement Offers off nothing is labelled', async () => {
		await setAutomationToggle(OFFERS_SETTING, false);
		expect(moveNodeText()).toContain(`${goblin.name} up to 2 spaces`);
		expect(placeable()._getDragMovementAction()).not.toBe(FORCED_ACTION);
		expect(dropTag()).toBeUndefined();
	});
});
