/**
 * Batch 7 (final QA) regression tests: every Nimble ChatMessage subtype is
 * created and renders through renderChatMessageHTML into the live chat log on
 * Foundry V14.
 *
 * Types whose producers are plain document methods are driven through the real
 * flow (rolls, item activation, rests, level-up summary). Types whose only
 * producers live inside interactive dialogs or combat UI flows (assessAction,
 * moveAction, reaction, chargeAdjustment, minionGroupAttack) are created with
 * the same message shape their producer builds — that still exercises the V14
 * subtype data model and the card's Svelte mount, which is what this suite
 * certifies.
 *
 * Note: system.json declares `boon` and `damage` ChatMessage subtypes, but
 * neither has a data model, card component, or producer (a boon activation
 * posts a `base` message). They are vestigial declarations, so this suite
 * covers the 14 registered subtypes.
 *
 * RestManager is imported from source into the live page: it has no module
 * state and operates purely on the actor passed to it, so the /@fs copy
 * behaves identically to the bundled one.
 */

import { afterAll, describe, expect, test } from 'vitest';
import { RestManager } from '../../src/managers/RestManager.ts';

const TEST_ACTOR_NAME = 'V14 Chat Card Test Actor';

const testedTypes = new Set<string>();
const createdMessageIds = new Set<string>();

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function expectCardRendered(message: ChatMessage | null | undefined, type: string) {
	expect(message, `a ${type} message should be created`).toBeTruthy();
	expect(message!.type, `message should have the ${type} subtype`).toBe(type);
	createdMessageIds.add(message!.id!);
	testedTypes.add(type);

	// renderChatMessageHTML mounts the card component asynchronously.
	await settle(700);
	const node = document.querySelector(`#chat [data-message-id="${message!.id}"]`);
	expect(node, `the ${type} card should be in the chat log DOM`).toBeTruthy();
	expect(
		node!.querySelector('[class*="nimble"]'),
		`the ${type} card should mount its Svelte component`,
	).toBeTruthy();
}

/** Run a flow that posts to chat and return the first new message of `type`. */
async function messageFromFlow(type: string, flow: () => Promise<unknown>) {
	const before = new Set(game.messages.contents.map((message) => message.id));
	await flow();
	await settle(800);
	return game.messages.contents.find((message) => !before.has(message.id) && message.type === type);
}

async function importPackItem(actor: Actor, packName: string, predicate: (entry: any) => boolean) {
	const pack = game.packs.get(`${game.system.id}.${packName}`)!;
	const index = await pack.getIndex({ fields: ['system.activation.template'] });
	const entry = index.contents.find(predicate);
	expect(entry, `${packName} should contain a matching document`).toBeTruthy();
	const doc = (await pack.getDocument(entry!._id))!;
	const [item] = await actor.createEmbeddedDocuments('Item', [doc.toObject() as Item.CreateData]);
	return item!;
}

describe('chat message cards', () => {
	let actor: Actor;

	afterAll(async () => {
		await ChatMessage.deleteDocuments([...createdMessageIds]).catch((error) =>
			console.error(error),
		);
		const leftovers = game.actors.filter((a) => a.name === TEST_ACTOR_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
	});

	test('roll cards: abilityCheck, savingThrow, skillCheck', async () => {
		actor = (await Actor.create({ name: TEST_ACTOR_NAME, type: 'character' }))!;

		await expectCardRendered(
			await (actor as any).rollAbilityCheckToChat('strength', { skipRollDialog: true }),
			'abilityCheck',
		);
		await expectCardRendered(
			await (actor as any).rollSavingThrowToChat('will', { skipRollDialog: true }),
			'savingThrow',
		);
		await expectCardRendered(
			await (actor as any).rollSkillCheckToChat('perception', { skipRollDialog: true }),
			'skillCheck',
		);
	}, 60_000);

	test('activation cards: spell, object, feature', async () => {
		const spell = await importPackItem(actor, 'nimble-spells', (e) => e.type === 'spell');
		await expectCardRendered(
			await messageFromFlow('spell', () => (spell as any).activate({ fastForward: true })),
			'spell',
		);

		const object = await importPackItem(actor, 'nimble-items', (e) => e.type === 'object');
		await expectCardRendered(
			await messageFromFlow('object', () => (object as any).activate({ fastForward: true })),
			'object',
		);

		const feature = await importPackItem(
			actor,
			'nimble-class-features',
			(e) => e.type === 'feature',
		);
		await expectCardRendered(
			await messageFromFlow('feature', () => (feature as any).activate({ fastForward: true })),
			'feature',
		);
	}, 120_000);

	test('rest cards: fieldRest, safeRest', async () => {
		// Give the actor wounds so a safe rest has something to recover (a blank
		// character's hp max is 0, so hp cannot serve as the recovery source).
		await actor.update({ 'system.attributes.wounds.value': 2 } as Record<string, unknown>);

		await expectCardRendered(
			await messageFromFlow('fieldRest', () =>
				new RestManager(actor as never, { restType: 'field', skipChatCard: false }).rest(),
			),
			'fieldRest',
		);
		await expectCardRendered(
			await messageFromFlow('safeRest', () =>
				new RestManager(actor as never, { restType: 'safe', skipChatCard: false }).rest(),
			),
			'safeRest',
		);
	}, 60_000);

	test('level-up summary card', async () => {
		await expectCardRendered(
			await (actor as any).outputLevelUpSummary(
				{ currentClassLevel: 2, takeAverageHp: true },
				undefined,
			),
			'levelUpSummary',
		);
	}, 30_000);

	test('dialog-produced cards render from their producer data shapes', async () => {
		// Shapes mirror AssessActionDialog, executeMoveAction,
		// buildReactionChatData, the charge system, and
		// buildNcsGroupAttackChatData respectively.
		const producerShapedData: Record<string, Record<string, unknown>> = {
			assessAction: {
				actorName: actor.name,
				actorType: actor.type,
				permissions: 3,
				rollMode: 0,
				skillKey: 'perception',
				dc: 10,
				isSuccess: true,
				optionTitle: 'Assess',
				resultMessage: 'You learn something useful.',
				target: null,
				targetName: null,
			},
			moveAction: { actorName: actor.name, speed: 6 },
			reaction: {
				actorName: actor.name,
				actorType: actor.type,
				image: actor.img,
				permissions: 3,
				rollMode: 0,
				reactionType: 'defend',
			},
			chargeAdjustment: {
				pools: [{ label: 'Charges', previousValue: 2, newValue: 1, icon: '' }],
				itemName: 'Test Item',
			},
			minionGroupAttack: {
				actorName: actor.name,
				actorType: 'minion',
				image: 'icons/svg/mystery-man.svg',
				permissions: 3,
				rollMode: 0,
				targets: [],
				groupLabel: 'Test Group',
				targetName: '1 target',
				totalDamage: 3,
				rows: [],
				skippedMembers: [],
				unsupportedWarnings: [],
			},
		};

		for (const [type, system] of Object.entries(producerShapedData)) {
			const message = await ChatMessage.create({
				author: game.user?.id,
				speaker: ChatMessage.getSpeaker({ actor }),
				type,
				system,
			} as unknown as ChatMessage.CreateData);
			await expectCardRendered(message, type);
		}
	}, 120_000);

	test('every registered ChatMessage subtype is covered by this suite', () => {
		const registered = Object.keys(CONFIG.ChatMessage.dataModels ?? {}).filter(
			(type) => type !== 'base',
		);
		expect(registered.length).toBeGreaterThan(0);
		for (const type of registered) {
			expect(testedTypes, `subtype "${type}" has no card test`).toContain(type);
		}
	});
});
