import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync } from '../../../tests/helpers.js';

const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();

vi.stubGlobal('Hooks', {
	on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
		handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		return 1;
	}),
	once: vi.fn(),
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn((event: string, ...args: unknown[]) => {
		for (const handler of handlers.get(event) ?? []) handler(...args);
		return true;
	}),
});

const activeGm = { id: 'gm' };
vi.stubGlobal('game', {
	settings: { get: vi.fn(() => true) },
	user: { id: 'gm', isGM: true },
	users: { activeGM: activeGm },
});

const documents = new Map<string, unknown>();
vi.stubGlobal(
	'fromUuidSync',
	vi.fn((uuid: string) => documents.get(uuid) ?? null),
);

import registerRuleEventDispatch from '../ruleEventDispatch.js';
import { registerSaveResolvedHooks } from '../saveResolved.js';

interface TestCard {
	id: string;
	type: string;
	system: Record<string, unknown>;
	rolls: Array<{ total: number; terms: unknown[] }>;
	update: Mock;
}

function roll(d20: number, total: number) {
	return { total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] };
}

function createSaver() {
	const rule = { onSaveResolved: vi.fn().mockResolvedValue(undefined) };
	const actor = { rules: [rule] };
	documents.set('Actor.saver', actor);
	return { actor, rule };
}

/** A card whose `update` writes the changes back, as the document does. */
function createCard(overrides: Partial<TestCard> = {}, system: Record<string, unknown> = {}) {
	const card: TestCard = {
		id: 'card',
		type: 'savingThrow',
		system: { saveKey: 'dexterity', actorUuid: 'Actor.saver', dc: 14, ...system },
		rolls: [roll(5, 8)],
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				card.system[path.replace(/^system\./, '')] = value;
			}
		}),
		...overrides,
	};
	return card;
}

function emit(event: string, card: TestCard): void {
	for (const handler of handlers.get(event) ?? []) handler(card, {}, {}, 'gm');
}

describe('saveResolved hook', () => {
	beforeAll(() => {
		registerRuleEventDispatch();
		registerSaveResolvedHooks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		documents.clear();
		activeGm.id = 'gm';
	});

	it('fires for a known failed result, with the card id', async () => {
		const { actor, rule } = createSaver();
		const card = createCard();

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).toHaveBeenCalledTimes(1);
		expect(rule.onSaveResolved).toHaveBeenCalledWith({
			actor,
			saveType: 'dexterity',
			outcome: 'fail',
			messageId: 'card',
		});
		expect(card.system.reportedSaveResult).toBe('failed');
	});

	it('fires pass for a total that meets the DC', async () => {
		const { rule } = createSaver();

		emit('createChatMessage', createCard({ rolls: [roll(10, 14)] }));
		await flushAsync();

		expect(rule.onSaveResolved).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'pass' }));
	});

	it('fires nothing and stores nothing with no result', async () => {
		const { rule } = createSaver();
		const card = createCard({ rolls: [roll(5, 8)] }, { dc: null });

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).not.toHaveBeenCalled();
		expect(card.update).not.toHaveBeenCalled();
	});

	it('does not fire again on a write that leaves the result the same', async () => {
		const { rule } = createSaver();
		const card = createCard();
		emit('createChatMessage', card);
		await flushAsync();

		card.rolls = [roll(6, 9)];
		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).toHaveBeenCalledTimes(1);
		expect(card.update).toHaveBeenCalledTimes(1);
	});

	it('fires again when a later write changes the result', async () => {
		const { rule } = createSaver();
		const card = createCard();
		emit('createChatMessage', card);
		await flushAsync();

		card.rolls = [roll(15, 18)];
		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).toHaveBeenCalledTimes(2);
		expect(rule.onSaveResolved).toHaveBeenLastCalledWith(
			expect.objectContaining({ outcome: 'pass', messageId: 'card' }),
		);
	});

	it('does not fire for a card that stored the result before a reload', async () => {
		const { rule } = createSaver();
		const card = createCard({}, { reportedSaveResult: 'failed' });

		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).not.toHaveBeenCalled();
		expect(card.update).not.toHaveBeenCalled();
	});

	it('does not lose a result that changes while the last one is being written', async () => {
		const { rule } = createSaver();
		const card = createCard();
		const write = card.update.getMockImplementation() as (c: object) => Promise<void>;
		card.update.mockImplementationOnce(async (changes: Record<string, unknown>) => {
			card.rolls = [roll(15, 18)];
			emit('updateChatMessage', card);
			await write(changes);
		});

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved.mock.calls.map(([context]) => context.outcome)).toEqual([
			'fail',
			'pass',
		]);
	});

	it('fires once when a write lands before the stored result is back', async () => {
		const { rule } = createSaver();
		const card = createCard();

		emit('createChatMessage', card);
		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).toHaveBeenCalledTimes(1);
	});

	it('fires nothing when the stored result could not be written', async () => {
		const { rule } = createSaver();
		const card = createCard();
		card.update.mockResolvedValueOnce(undefined);

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).not.toHaveBeenCalled();
		expect(card.update).toHaveBeenCalledTimes(1);
	});

	it('does not fire on a client that is not the active GM', async () => {
		const { rule } = createSaver();
		activeGm.id = 'other-gm';
		const card = createCard();

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).not.toHaveBeenCalled();
		expect(card.update).not.toHaveBeenCalled();
	});

	it('ignores other check cards', async () => {
		const { rule } = createSaver();
		const card = createCard({ type: 'skillCheck' }, { skillKey: 'arcana' });

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).not.toHaveBeenCalled();
	});

	it('finds the actor through the token when the card has no actor uuid', async () => {
		const { actor, rule } = createSaver();
		documents.set('Scene.s.Token.t', { actor });
		const card = createCard({}, { actorUuid: null, tokenUuid: 'Scene.s.Token.t' });

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onSaveResolved).toHaveBeenCalledTimes(1);
	});

	it('fires and stores nothing when no actor can be found', async () => {
		const card = createCard({}, { actorUuid: 'Actor.gone' });

		emit('createChatMessage', card);
		await flushAsync();

		expect(card.update).not.toHaveBeenCalled();
	});
});
