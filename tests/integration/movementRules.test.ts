/**
 * Live regression tests for the freeMove and movementTrigger rules. Features
 * carry the rules inline, so nothing here depends on pack content.
 *
 * freeMove: using the feature posts a Movement Offer card, the offered token
 * then drags as a Free Move, and a Movement made under the offer is recorded
 * on the card. movementTrigger: a finished Movement that agrees with the rule
 * posts a card that offers the item or only reminds the table.
 *
 * Token Movements are real Movements of the token documents; a drop is
 * reproduced with the drag's action and the offer tag, like the sibling
 * movementOffers suite.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	clearTargets,
	createViewedTestScene,
	GRID_SIZE,
	getAutomationToggle,
	messageNode,
	placeToken,
	purgeTestDocuments,
	setAutomationToggle,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Movement Rules';
const FREE_ACTION = `${game.system.id}Free`;
const TAG_KEY = 'nimbleMovementOffer';

const SETTINGS = [
	'automation.applyRuleEffects',
	'automation.movementTracking',
	'automation.movementOffers',
	'automation.resourceSpending',
] as const;

interface OfferTag {
	messageId: string;
	offerId: string;
}

interface DraggableToken {
	_getDragMovementAction(): string;
	_getDragLeftDropUpdateOptions(): { constrainOptions?: Record<string, unknown> };
}

interface StoredOffer {
	id: string;
	tokenUuid: string;
	spaces: number;
	state: 'open' | 'taken' | 'unused' | 'lapsed';
	movedSpaces: number | null;
}

interface ActivatableItem extends Item {
	activate(options: object): Promise<unknown>;
}

interface ChargePoolEntry {
	identifier: string;
	current: number;
}

function ruleBase(id: string, label: string, priority = 1) {
	return { disabled: false, id, identifier: '', label, predicate: {}, priority };
}

function chargePoolRule(identifier: string) {
	return {
		...ruleBase(`${identifier}-pool`, identifier),
		type: 'chargePool',
		identifier,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		recoveries: [],
	};
}

function freeMoveRule(id: string, overrides: Record<string, unknown> = {}) {
	return {
		...ruleBase(id, id, 2),
		type: 'freeMove',
		trigger: 'onActivation',
		poolIdentifier: '',
		distance: '3',
		recipient: 'self',
		within: 12,
		direction: 'any',
		ignoresDifficultTerrain: false,
		chargePoolIdentifier: '',
		...overrides,
	};
}

function movementTriggerRule(id: string, overrides: Record<string, unknown>) {
	return {
		...ruleBase(id, id, 2),
		type: 'movementTrigger',
		event: 'selfMoved',
		creature: 'any',
		kinds: ['regular', 'free', 'forced'],
		minSpaces: 0,
		spacesScope: 'thisTurn',
		geometry: 'any',
		reach: 1,
		minTargets: 1,
		observerScope: 'self',
		allyRadius: 6,
		payload: 'use',
		message: '',
		chargePoolIdentifier: '',
		...overrides,
	};
}

function featureData(name: string, rules: Array<Record<string, unknown>>) {
	return { name, type: 'feature', system: { rules } };
}

type FeatureData = ReturnType<typeof featureData>;

/**
 * Creates the features and returns them in the order given. The array that
 * createEmbeddedDocuments returns is not always in the order of its input.
 */
async function createFeatures(actor: Actor, features: FeatureData[]): Promise<Item[]> {
	const created = (await actor.createEmbeddedDocuments('Item', features as never[])) as Item[];
	return features.map((feature) => {
		const item = created.find((entry) => entry.name === feature.name);
		if (!item) throw new Error(`${feature.name} was not created`);
		return item;
	});
}

function messageIds(): Set<string> {
	return new Set(game.messages.contents.map((message) => message.id!));
}

function newMessages(before: Set<string>, type: string, actor: Actor): ChatMessage[] {
	return game.messages.contents.filter(
		(message) =>
			!before.has(message.id!) &&
			message.type === type &&
			(message.system as { actorName?: string }).actorName === actor.name,
	);
}

/** Runs `flow`, waits for a new card of `type` spoken by `actor`, and returns every such card. */
async function cardsFrom(
	type: string,
	actor: Actor,
	flow: () => Promise<unknown>,
): Promise<ChatMessage[]> {
	const before = messageIds();
	await flow();
	await waitFor(() => newMessages(before, type, actor).length > 0, `a ${type} card`);
	await settle(1000);
	return newMessages(before, type, actor);
}

/** Like `cardsFrom`, for flows that must post exactly one card. */
async function cardFrom(
	type: string,
	actor: Actor,
	flow: () => Promise<unknown>,
): Promise<ChatMessage> {
	const cards = await cardsFrom(type, actor, flow);
	expect(cards, `exactly one ${type} card`).toHaveLength(1);
	return cards[0];
}

/** Runs `flow` and returns the new cards of `type` after the chain has had time to post. */
async function cardsAfter(
	type: string,
	actor: Actor,
	flow: () => Promise<unknown>,
): Promise<ChatMessage[]> {
	const before = messageIds();
	await flow();
	await settle(2000);
	return newMessages(before, type, actor);
}

function offersOn(message: ChatMessage): StoredOffer[] {
	return (game.messages.get(message.id!)!.system as unknown as { movementOffers: StoredOffer[] })
		.movementOffers;
}

function cardText(message: ChatMessage): string {
	return (messageNode(message.id!)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function waitForRendered(message: ChatMessage, selector: string): Promise<void> {
	await waitFor(
		() => !!messageNode(message.id!)?.querySelector(selector),
		`${selector} on message ${message.id}`,
	);
}

function draggable(token: TokenDocument): DraggableToken {
	return canvas.tokens?.get(token.id!) as unknown as DraggableToken;
}

function dropTag(token: TokenDocument): OfferTag | undefined {
	return draggable(token)._getDragLeftDropUpdateOptions().constrainOptions?.[TAG_KEY] as
		| OfferTag
		| undefined;
}

function poolCurrent(actor: Actor, item: Item, identifier: string): number | undefined {
	const pools = foundry.utils.getProperty(
		actor.items.get(item.id!)!,
		`flags.${game.system.id}.chargePools`,
	) as Record<string, ChargePoolEntry> | undefined;
	return Object.values(pools ?? {}).find((entry) => entry.identifier === identifier)?.current;
}

function use(item: Item): Promise<unknown> {
	return (item as ActivatableItem).activate({ fastForward: true });
}

type Waypoint = [gx: number, gy: number];

/** A Movement through the given grid spaces, as a drop would make it. */
async function moveToken(
	token: TokenDocument,
	waypoints: Waypoint[],
	{ action, tag }: { action?: string; tag?: OfferTag } = {},
): Promise<void> {
	await token.move(
		waypoints.map(([gx, gy]) => ({
			x: gx * GRID_SIZE,
			y: gy * GRID_SIZE,
			...(action ? { action } : {}),
		})) as never,
		(tag ? { constrainOptions: { [TAG_KEY]: tag } } : {}) as never,
	);
	await settle(700);
}

/** Puts a token somewhere without a Movement that counts. */
async function displace(token: TokenDocument, [gx, gy]: Waypoint): Promise<void> {
	await token.move({ x: gx * GRID_SIZE, y: gy * GRID_SIZE, action: 'displace' } as never);
	await settle(500);
}

/** Pool flags seed on a sync, so nudge the actor and wait for the pool to show its charge. */
async function seedPool(actor: Actor, item: Item, identifier: string): Promise<void> {
	await actor.update({ 'system.details.notes': `${TEST_PREFIX} staging` } as never);
	await waitFor(() => poolCurrent(actor, item, identifier) === 1, `the ${identifier} pool to seed`);
}

describe('movement rules', () => {
	const settingsBefore = new Map<string, boolean>();
	const combats: Combat[] = [];

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		for (const key of SETTINGS) {
			settingsBefore.set(key, getAutomationToggle(key));
			await setAutomationToggle(key, true);
		}
		ui.sidebar.expand?.();
		ui.sidebar.changeTab?.('chat', 'primary');
		await settle(300);
	});

	afterAll(async () => {
		for (const combat of combats) await combat.delete().catch((error) => console.error(error));
		await clearTargets();
		for (const [key, value] of settingsBefore) await setAutomationToggle(key, value);
		await purgeTestDocuments(TEST_PREFIX);
	});

	describe('freeMove', () => {
		let hero: Actor;
		let heroToken: TokenDocument;
		let nearAllyToken: TokenDocument;
		let farAllyToken: TokenDocument;
		let dash: Item;
		let rally: Item;
		let burst: Item;
		let dashCard: ChatMessage;

		beforeAll(async () => {
			hero = (await Actor.create({ name: `${TEST_PREFIX} Scout`, type: 'character' }))!;
			const nearAlly = (await Actor.create({ name: `${TEST_PREFIX} Near Ally`, type: 'npc' }))!;
			const farAlly = (await Actor.create({ name: `${TEST_PREFIX} Far Ally`, type: 'npc' }))!;
			[dash, rally, burst] = await createFeatures(hero, [
				featureData(`${TEST_PREFIX} Dash`, [freeMoveRule('dash-free-move')]),
				featureData(`${TEST_PREFIX} Rally`, [
					freeMoveRule('rally-free-move', {
						distance: '2',
						recipient: 'selfAndAllies',
						within: 2,
					}),
				]),
				featureData(`${TEST_PREFIX} Burst`, [
					chargePoolRule('burst-use'),
					freeMoveRule('burst-free-move', {
						distance: '2',
						chargePoolIdentifier: 'burst-use',
					}),
				]),
			]);
			await seedPool(hero, burst, 'burst-use');

			const scene = await createViewedTestScene(`${TEST_PREFIX} Free Move Scene`);
			const friendly = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
			heroToken = await placeToken(scene, {
				name: hero.name,
				actor: hero,
				gx: 2,
				gy: 2,
				disposition: friendly,
				actorLink: true,
			});
			nearAllyToken = await placeToken(scene, {
				name: nearAlly.name,
				actor: nearAlly,
				gx: 2,
				gy: 4,
				disposition: friendly,
				actorLink: true,
			});
			farAllyToken = await placeToken(scene, {
				name: farAlly.name,
				actor: farAlly,
				gx: 8,
				gy: 2,
				disposition: friendly,
				actorLink: true,
			});
			await clearTargets();
		}, 60_000);

		test('using the feature posts an offer card with one open Free Move for the user token', async () => {
			const card = await cardFrom('movementOffer', hero, () => use(dash));
			dashCard = card;
			expect(offersOn(card)).toMatchObject([
				{ tokenUuid: heroToken.uuid, spaces: 3, state: 'open', movedSpaces: null },
			]);

			await waitForRendered(card, '.nimble-move-node');
			const text = cardText(card);
			expect(text).toContain(`used ${dash.name}`);
			expect(text).toContain('Free Move - up to 3 spaces');
			expect(text).not.toContain('chooses where');
		});

		test('the token carries the offer, and a Movement made under it is recorded as taken', async () => {
			const card = dashCard;
			expect(draggable(heroToken)._getDragMovementAction()).toBe(FREE_ACTION);
			const tag = dropTag(heroToken);
			expect(tag).toEqual({ messageId: card.id, offerId: offersOn(card)[0].id });

			await moveToken(heroToken, [[4, 2]], { action: FREE_ACTION, tag });
			await waitFor(() => offersOn(card)[0].state === 'taken', 'the offer to be recorded taken');
			expect(offersOn(card)[0].movedSpaces).toBe(2);
			await waitFor(
				() => cardText(card).includes(`${hero.name} moved 2 of 3 spaces.`),
				'the result on the card',
			);
			expect(draggable(heroToken)._getDragMovementAction()).not.toBe(FREE_ACTION);
		});

		test('selfAndAllies offers to the user and to an ally in range, not to an ally out of range', async () => {
			await displace(heroToken, [2, 2]);
			const card = await cardFrom('movementOffer', hero, () => use(rally));
			const offered = offersOn(card).map((offer) => offer.tokenUuid);
			expect(offered).toHaveLength(2);
			expect(offered).toEqual(expect.arrayContaining([heroToken.uuid, nearAllyToken.uuid]));
			expect(offered).not.toContain(farAllyToken.uuid);

			await waitForRendered(card, '.nimble-move-node');
			expect(cardText(card)).toContain(nearAllyToken.name);
			expect(cardText(card)).toContain('up to 2 spaces');
			expect(cardText(card)).not.toContain(farAllyToken.name);
			expect(draggable(nearAllyToken)._getDragMovementAction()).toBe(FREE_ACTION);
			expect(draggable(farAllyToken)._getDragMovementAction()).not.toBe(FREE_ACTION);
		});

		test('a charge-limited offer spends its one charge, and the next use offers nothing', async () => {
			expect(poolCurrent(hero, burst, 'burst-use')).toBe(1);
			const card = await cardFrom('movementOffer', hero, () => use(burst));
			expect(offersOn(card)).toMatchObject([{ tokenUuid: heroToken.uuid, spaces: 2 }]);
			await waitFor(() => poolCurrent(hero, burst, 'burst-use') === 0, 'the charge to be spent');

			const before = messageIds();
			const offerCards = await cardsAfter('movementOffer', hero, () => use(burst));
			const featureCards = newMessages(before, 'feature', hero);
			expect(featureCards, 'the feature itself is still used').toHaveLength(1);
			expect(offerCards).toHaveLength(0);
			expect(poolCurrent(hero, burst, 'burst-use')).toBe(0);
		});
	});

	describe('movementTrigger', () => {
		let hero: Actor;
		let goblin: Actor;
		let heroToken: TokenDocument;
		let goblinToken: TokenDocument;
		let lash: Item;
		let rampage: Item;

		beforeAll(async () => {
			hero = (await Actor.create({ name: `${TEST_PREFIX} Warden`, type: 'character' }))!;
			goblin = (await Actor.create({ name: `${TEST_PREFIX} Goblin`, type: 'npc' }))!;
			[lash, rampage] = await createFeatures(hero, [
				featureData(`${TEST_PREFIX} Lash`, [
					movementTriggerRule('lash-trigger', {
						event: 'creatureMoved',
						creature: 'enemy',
						geometry: 'enteredReach',
						reach: 1,
						payload: 'use',
					}),
				]),
				featureData(`${TEST_PREFIX} Rampage`, [
					chargePoolRule('rampage-use'),
					movementTriggerRule('rampage-trigger', {
						event: 'selfMoved',
						creature: 'any',
						minSpaces: 4,
						spacesScope: 'thisTurn',
						geometry: 'endsAdjacent',
						reach: 1,
						payload: 'reminder',
						message: '{mover} moved {spaces} spaces, {spacesMovedThisTurn} this turn.',
						chargePoolIdentifier: 'rampage-use',
					}),
				]),
			]);
			await seedPool(hero, rampage, 'rampage-use');

			const scene = await createViewedTestScene(`${TEST_PREFIX} Trigger Scene`);
			heroToken = await placeToken(scene, {
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
				gx: 8,
				gy: 2,
				disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
				actorLink: true,
			});

			// Spaces Moved This Turn is only counted in a started combat.
			const combat = (await Combat.create({ active: true, scene: scene.id } as Combat.CreateData))!;
			combats.push(combat);
			await combat.createEmbeddedDocuments('Combatant', [
				{ actorId: hero.id, tokenId: heroToken.id, sceneId: scene.id, type: 'character' },
				{ actorId: goblin.id, tokenId: goblinToken.id, sceneId: scene.id, type: 'npc' },
			] as Combatant.CreateData[]);
			await combat.startCombat();
			await settle(500);
		}, 60_000);

		test('an enemy that moves but stays out of Reach posts nothing', async () => {
			const cards = await cardsAfter('movementTrigger', hero, () =>
				moveToken(goblinToken, [[6, 2]]),
			);
			expect(cards).toHaveLength(0);
		});

		test('an enemy that moves next to the user posts a card that names it and lets the user use the item', async () => {
			await displace(goblinToken, [6, 2]);
			const card = await cardFrom('movementTrigger', hero, () => moveToken(goblinToken, [[3, 2]]));
			await waitForRendered(card, '.nimble-movement-trigger-card');
			const text = cardText(card);
			expect(text).toContain(lash.name);
			expect(text).toContain(`${goblin.name} moved. You can use this item now.`);
			expect(text).toContain(`Creatures: ${goblin.name}`);
		});

		test('the Use button targets exactly the enemy and uses the item', async () => {
			await displace(goblinToken, [6, 2]);
			const [card] = await cardsFrom('movementTrigger', hero, () =>
				moveToken(goblinToken, [[3, 2]]),
			);
			await waitForRendered(card, '.nimble-movement-trigger-card button');
			const buttons = messageNode(card.id!)!.querySelectorAll<HTMLButtonElement>(
				'.nimble-movement-trigger-card button',
			);
			expect(buttons).toHaveLength(1);
			expect(buttons[0].textContent).toContain(`Use ${lash.name}`);

			await targetToken(heroToken);
			const before = messageIds();
			buttons[0].click();
			await waitFor(
				() =>
					newMessages(before, 'feature', hero).some(
						(message) =>
							foundry.utils.getProperty(message, `flags.${game.system.id}.itemUuid`) === lash.uuid,
					),
				'the Lash activation card',
			);

			expect([...game.user!.targets].map((token) => token.id)).toEqual([goblinToken.id]);
			const activation = newMessages(before, 'feature', hero).find(
				(message) =>
					foundry.utils.getProperty(message, `flags.${game.system.id}.itemUuid`) === lash.uuid,
			)!;
			expect((activation.system as unknown as { targets: string[] }).targets).toEqual([
				goblinToken.uuid,
			]);
			await clearTargets();
		});

		test('a short move next to a creature posts no reminder', async () => {
			await displace(goblinToken, [5, 2]);
			await heroToken.clearMovementHistory();
			await settle(500);
			const cards = await cardsAfter('movementTrigger', hero, () => moveToken(heroToken, [[4, 2]]));
			expect(cards).toHaveLength(0);
			expect(poolCurrent(hero, rampage, 'rampage-use')).toBe(1);
		});

		test('a move that brings this turn to 4 spaces and ends adjacent posts a reminder and spends the charge', async () => {
			const card = await cardFrom('movementTrigger', hero, () =>
				moveToken(heroToken, [
					[4, 4],
					[4, 2],
				]),
			);
			await waitForRendered(card, '.nimble-movement-trigger-card');
			const text = cardText(card);
			expect(text).toContain(rampage.name);
			expect(text).toContain(`${hero.name} moved 4 spaces, 6 this turn.`);
			expect(text).toContain(`Creatures: ${goblin.name}`);
			expect(
				messageNode(card.id!)!.querySelectorAll('.nimble-movement-trigger-card button'),
			).toHaveLength(0);
			await waitFor(
				() => poolCurrent(hero, rampage, 'rampage-use') === 0,
				'the Rampage charge to be spent',
			);
		});

		test('with the charge spent a further qualifying move posts nothing', async () => {
			const cards = await cardsAfter('movementTrigger', hero, () =>
				moveToken(heroToken, [
					[4, 3],
					[4, 2],
				]),
			);
			expect(cards).toHaveLength(0);
		});
	});
});
