import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { SYSTEM_ID } from '#system';

const mocks = vi.hoisted(() => ({ applyConditionToActor: vi.fn() }));

vi.mock('#utils/applyConditionToActor.ts', () => ({ default: mocks.applyConditionToActor }));

import ConditionNodeTestHarness from './ConditionNode.testHarness.svelte';

const { applyConditionToActor } = mocks;

/**
 * The card records its targets as token uuids, so anything registered here
 * stands for a document the card can resolve.
 */
const documentsByUuid = new Map<string, unknown>();

function createTokenWithActor(uuid: string, actorName: string) {
	const actor = { uuid: `Actor.${actorName}`, name: actorName };
	documentsByUuid.set(uuid, { uuid, actor });
	return actor;
}

function createMessage(targets: string[], flags: Record<string, unknown> = {}) {
	const message = {
		id: 'message-1',
		flags: { [SYSTEM_ID]: flags },
		system: { targets },
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

function conditionNode() {
	return { id: 'condition-1', type: 'condition', condition: 'dazed' };
}

let previousConditions: unknown;
let previousDescriptions: unknown;
let previousCanvas: unknown;
let previousActors: unknown;
let previousUser: unknown;

beforeEach(() => {
	applyConditionToActor.mockReset().mockResolvedValue(null);
	documentsByUuid.clear();

	// Application is GM-only, so the tests exercising it run as a GM.
	previousUser = (game as { user?: unknown }).user;
	(game as { user?: unknown }).user = { id: 'gm-user', isGM: true };

	previousConditions = CONFIG.NIMBLE.conditions;
	previousDescriptions = CONFIG.NIMBLE.conditionDescriptions;
	CONFIG.NIMBLE.conditions = { dazed: 'Dazed' } as typeof CONFIG.NIMBLE.conditions;
	CONFIG.NIMBLE.conditionDescriptions = {
		dazed: 'Dazed description',
	} as typeof CONFIG.NIMBLE.conditionDescriptions;

	// The button must ignore the canvas selection, so give it a tempting one.
	previousCanvas = (globalThis as { canvas?: unknown }).canvas;
	(globalThis as { canvas?: unknown }).canvas = {
		tokens: { controlled: [{ actor: { uuid: 'Actor.bystander', name: 'Bystander' } }] },
	};

	previousActors = (game as { actors?: unknown }).actors;
	(game as { actors?: unknown }).actors = { get: (id: string) => documentsByUuid.get(id) ?? null };

	vi.stubGlobal('fromUuid', async (uuid: string) => documentsByUuid.get(uuid) ?? null);
});

afterEach(() => {
	CONFIG.NIMBLE.conditions = previousConditions as typeof CONFIG.NIMBLE.conditions;
	CONFIG.NIMBLE.conditionDescriptions =
		previousDescriptions as typeof CONFIG.NIMBLE.conditionDescriptions;
	(globalThis as { canvas?: unknown }).canvas = previousCanvas;
	(game as { actors?: unknown }).actors = previousActors;
	(game as { user?: unknown }).user = previousUser;
	vi.unstubAllGlobals();
});

async function clickConditionButton() {
	await fireEvent.click(screen.getByRole('button', { name: /apply condition/i }));
}

describe('ConditionNode', () => {
	it("applies the condition to the card's targets, not the canvas selection", async () => {
		const first = createTokenWithActor('Scene.s.Token.a', 'First');
		const second = createTokenWithActor('Scene.s.Token.b', 'Second');

		render(ConditionNodeTestHarness, {
			props: {
				messageDocument: createMessage(['Scene.s.Token.a', 'Scene.s.Token.b']),
				node: conditionNode(),
			},
		});

		await clickConditionButton();

		await waitFor(() => expect(applyConditionToActor).toHaveBeenCalledTimes(2));
		expect(applyConditionToActor.mock.calls.map((call) => call[0])).toEqual([first, second]);
		expect(applyConditionToActor.mock.calls.every((call) => call[1] === 'dazed')).toBe(true);
	});

	it('applies nothing when the card has no targets, even with tokens selected', async () => {
		render(ConditionNodeTestHarness, {
			props: { messageDocument: createMessage([]), node: conditionNode() },
		});

		await clickConditionButton();
		await Promise.resolve();

		expect(applyConditionToActor).not.toHaveBeenCalled();
	});

	it('keeps applying to the remaining targets when one target is refused', async () => {
		createTokenWithActor('Scene.s.Token.a', 'First');
		createTokenWithActor('Scene.s.Token.b', 'Second');
		applyConditionToActor
			.mockRejectedValueOnce(new Error('lacks permission'))
			.mockResolvedValueOnce(null);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(ConditionNodeTestHarness, {
			props: {
				messageDocument: createMessage(['Scene.s.Token.a', 'Scene.s.Token.b']),
				node: conditionNode(),
			},
		});

		await clickConditionButton();

		await waitFor(() => expect(applyConditionToActor).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
		consoleError.mockRestore();
	});

	it('renders an inert chip for players, with no way to apply the condition', async () => {
		(game as { user?: unknown }).user = { id: 'player-user', isGM: false };
		createTokenWithActor('Scene.s.Token.a', 'First');

		render(ConditionNodeTestHarness, {
			props: {
				messageDocument: createMessage(['Scene.s.Token.a']),
				node: conditionNode(),
			},
		});

		expect(screen.queryByRole('button', { name: /apply condition/i })).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Dazed' }));
		await Promise.resolve();

		expect(applyConditionToActor).not.toHaveBeenCalled();
	});

	it('escapes a GM-supplied condition name in the tooltip markup', async () => {
		// Custom condition names are free-form GM text and the tooltip is built as an HTML string,
		// so an unescaped `<` would truncate the heading and swallow the description.
		CONFIG.NIMBLE.conditions = { dazed: 'Hex <3 Bane' } as typeof CONFIG.NIMBLE.conditions;
		createTokenWithActor('Scene.s.Token.a', 'First');

		render(ConditionNodeTestHarness, {
			props: { messageDocument: createMessage(['Scene.s.Token.a']), node: conditionNode() },
		});

		const tooltip =
			screen.getByRole('button', { name: /apply condition/i }).getAttribute('data-tooltip') ?? '';

		expect(tooltip).toContain('Hex &lt;3 Bane');
		expect(tooltip).toContain('Dazed description');
	});

	it('falls back to the id when the card outlives the condition it names', async () => {
		// Activation-effect nodes carry no choices validation, so a card can still name a custom
		// condition the GM has since removed.
		CONFIG.NIMBLE.conditions = {} as typeof CONFIG.NIMBLE.conditions;
		CONFIG.NIMBLE.conditionDescriptions = {} as typeof CONFIG.NIMBLE.conditionDescriptions;
		createTokenWithActor('Scene.s.Token.a', 'First');

		render(ConditionNodeTestHarness, {
			props: { messageDocument: createMessage(['Scene.s.Token.a']), node: conditionNode() },
		});

		const chip = screen.getByRole('button', { name: /apply condition/i });
		expect(chip).toHaveTextContent('dazed');
		expect(chip.getAttribute('data-tooltip')).toContain('dazed');
	});

	it("names the card's item as the source of the condition", async () => {
		createTokenWithActor('Scene.s.Token.a', 'First');
		const sourceActor = { uuid: 'Actor.attacker', name: 'Attacker' };
		documentsByUuid.set('Item.feature', { uuid: 'Item.feature', actor: sourceActor });

		render(ConditionNodeTestHarness, {
			props: {
				messageDocument: createMessage(['Scene.s.Token.a'], {
					itemUuid: 'Item.feature',
					actorId: 'attacker-id',
				}),
				node: conditionNode(),
			},
		});

		await clickConditionButton();

		await waitFor(() =>
			expect(applyConditionToActor).toHaveBeenCalledWith(
				expect.anything(),
				'dazed',
				expect.objectContaining({
					sourceItem: expect.objectContaining({ uuid: 'Item.feature' }),
					sourceActor,
				}),
			),
		);
	});

	it('falls back to the card actor when the item no longer resolves', async () => {
		createTokenWithActor('Scene.s.Token.a', 'First');
		const sourceActor = { uuid: 'Actor.attacker', name: 'Attacker' };
		documentsByUuid.set('attacker-id', sourceActor);

		render(ConditionNodeTestHarness, {
			props: {
				messageDocument: createMessage(['Scene.s.Token.a'], {
					itemUuid: 'Item.deleted',
					actorId: 'attacker-id',
				}),
				node: conditionNode(),
			},
		});

		await clickConditionButton();

		await waitFor(() =>
			expect(applyConditionToActor).toHaveBeenCalledWith(
				expect.anything(),
				'dazed',
				expect.objectContaining({ sourceItem: null, sourceActor }),
			),
		);
	});
});
