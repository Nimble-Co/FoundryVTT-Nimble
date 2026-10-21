import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createViewedTestScene,
	placeToken,
	purgeTestDocuments,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Inline Rolls';
const LEVEL_ROLL = '<p>[[/r 1d1+@level]]</p>';

interface SheetDocument {
	sheet: {
		render(force: boolean): Promise<unknown>;
		close(): Promise<unknown>;
		element: HTMLElement;
	};
}

async function clickInlineRoll(root: () => HTMLElement | null | undefined) {
	await waitFor(() => !!root()?.querySelector('a.inline-roll'), 'inline roll link');
	const anchor = root()!.querySelector<HTMLAnchorElement>('a.inline-roll')!;
	const formula = anchor.dataset.formula;
	const errors: string[] = [];
	const onError = (event: PromiseRejectionEvent) =>
		errors.push(String(event.reason?.message ?? event.reason));
	window.addEventListener('unhandledrejection', onError);
	const created = new Promise<ChatMessage | null>((resolve) => {
		const id = Hooks.once('createChatMessage', (message: ChatMessage) => resolve(message));
		setTimeout(() => {
			Hooks.off('createChatMessage', id);
			resolve(null);
		}, 3_000);
	});
	anchor.click();
	const message = await created;
	window.removeEventListener('unhandledrejection', onError);
	return { formula, total: message?.rolls?.[0]?.total ?? null, errors };
}

async function createLevelFourHelm() {
	const actor = (await Actor.create({
		name: `${TEST_PREFIX} Hero`,
		type: 'character',
		system: { classData: { levels: ['x', 'x', 'x', 'x'] } },
	})) as Actor;
	expect((actor.getRollData() as { level: number }).level).toBe(4);
	const [item] = await actor.createEmbeddedDocuments('Item', [
		{
			name: `${TEST_PREFIX} Helm`,
			type: 'object',
			system: { description: { public: LEVEL_ROLL }, activation: { showDescription: true } },
		},
	]);
	return item as unknown as SheetDocument & { activate(): Promise<unknown> };
}

describe('inline rolls and save enrichers', () => {
	const sheets: SheetDocument[] = [];

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		for (const token of canvas?.tokens?.controlled ?? []) token.release();
	}, 60_000);

	afterAll(async () => {
		for (const doc of sheets) await doc.sheet.close().catch(() => {});
		await purgeTestDocuments(TEST_PREFIX);
	});

	test.each(['luck', 'constructor'])('[[/savingThrow save=%s]] stays as text', async (save) => {
		const tag = `[[/savingThrow save=${save}]]`;
		const html = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			`<p>${tag}</p>`,
		);
		expect(html).toContain(tag);
	});

	test('[[/savingThrow]] on a sheet rolls the save for the selected token', async () => {
		const scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		const actor = (await Actor.create({
			name: `${TEST_PREFIX} Saver`,
			type: 'npc',
		})) as unknown as Actor & SheetDocument;
		await actor.createEmbeddedDocuments('Item', [
			{
				name: `${TEST_PREFIX} Breath`,
				type: 'monsterFeature',
				system: { description: '<p>[[/savingThrow save=dex dc=12]]</p>' },
			},
		]);
		const token = await placeToken(scene, {
			name: `${TEST_PREFIX} Saver`,
			actor,
			gx: 3,
			gy: 3,
			disposition: -1,
			actorLink: true,
		});
		canvas.tokens!.get(token.id!)!.control({ releaseOthers: true });
		sheets.push(actor);
		await actor.sheet.render(true);

		const selector = 'button[data-enricher-type="savingthrow"]';
		await waitFor(() => !!actor.sheet.element?.querySelector(selector), 'save button');
		const button = actor.sheet.element.querySelector<HTMLButtonElement>(selector)!;
		expect(button.textContent?.trim()).toBe('DC 12 DEX save');

		const before = new Set(game.messages.contents.map((m) => m.id));
		button.click();
		const findRollButton = () =>
			[...foundry.applications.instances.values()]
				.find((app) => app.title?.includes('Configure') && app.title.includes(actor.name!))
				?.element?.querySelector<HTMLButtonElement>('.nimble-sheet__footer button');
		await waitFor(() => !!findRollButton(), 'save roll dialog');
		findRollButton()!.click();
		await waitFor(() => game.messages.contents.some((m) => !before.has(m.id)), 'save chat card');
		const card = game.messages.contents.find((m) => !before.has(m.id)) as unknown as {
			system: { actorName?: string; saveKey?: string };
		};
		expect({ actorName: card.system.actorName, saveKey: card.system.saveKey }).toEqual({
			actorName: actor.name,
			saveKey: 'dexterity',
		});
		await settle(200);
	});

	test('@level on an owned item sheet rolls with the character level', async () => {
		const item = await createLevelFourHelm();
		sheets.push(item);
		await item.sheet.render(true);

		const result = await clickInlineRoll(() => item.sheet.element);
		expect(result).toEqual({ formula: expect.any(String), total: 5, errors: [] });
	});

	test('@level in an item chat card rolls with the character level', async () => {
		const item = await createLevelFourHelm();
		const before = new Set(game.messages.contents.map((m) => m.id));
		await item.activate();
		await waitFor(() => game.messages.contents.some((m) => !before.has(m.id)), 'item chat card');
		const card = game.messages.contents.find((m) => !before.has(m.id))!;
		const userCharacter = game.user.character?.name ?? null;

		const result = await clickInlineRoll(() =>
			document.querySelector<HTMLElement>(`#chat [data-message-id="${card.id}"]`),
		);
		expect({ ...result, userCharacter }).toEqual({
			formula: expect.any(String),
			total: 5,
			errors: [],
			userCharacter,
		});
	});

	test('@level on an open NPC sheet follows a level change', async () => {
		const actor = (await Actor.create({
			name: `${TEST_PREFIX} Growing Monster`,
			type: 'npc',
			system: { details: { level: '2' } },
		})) as unknown as Actor & SheetDocument;
		await actor.createEmbeddedDocuments('Item', [
			{ name: `${TEST_PREFIX} Bite`, type: 'monsterFeature', system: { description: LEVEL_ROLL } },
		]);
		sheets.push(actor);
		await actor.sheet.render(true);
		await waitFor(() => !!actor.sheet.element?.querySelector('a.inline-roll'), 'inline roll link');

		await (
			actor as unknown as { update(changes: Record<string, unknown>): Promise<unknown> }
		).update({
			'system.details.level': '7',
		});
		await settle(500);

		const result = await clickInlineRoll(() => actor.sheet.element);
		expect(result).toEqual({ formula: expect.any(String), total: 8, errors: [] });
	});

	test('@level on an NPC sheet rolls with the monster level', async () => {
		const actor = (await Actor.create({
			name: `${TEST_PREFIX} Monster`,
			type: 'npc',
			system: { details: { level: '5' } },
		})) as unknown as Actor & SheetDocument;
		await actor.createEmbeddedDocuments('Item', [
			{ name: `${TEST_PREFIX} Claw`, type: 'monsterFeature', system: { description: LEVEL_ROLL } },
		]);
		sheets.push(actor);
		await actor.sheet.render(true);

		const result = await clickInlineRoll(() => actor.sheet.element);
		expect(result).toEqual({ formula: expect.any(String), total: 6, errors: [] });
	});
});
