import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	applyMarkEffect,
	findMarkEffectIds,
	MARK_TARGET_ITEM_FLAG,
	type MarkEffectTarget,
	registerMarkTargetSocketListener,
	removeMarkEffect,
} from './markTargetEffects.js';

interface MockEffect {
	id: string;
	getFlag: (scope: string, key: string) => unknown;
}

function markEffect(id: string, itemUuid: string): MockEffect {
	return {
		id,
		getFlag: (_scope: string, key: string) =>
			key === MARK_TARGET_ITEM_FLAG ? itemUuid : undefined,
	};
}

function createTarget(uuid: string, isOwner: boolean, effects: MockEffect[] = []) {
	const target: MarkEffectTarget & {
		createEmbeddedDocuments: ReturnType<typeof vi.fn>;
		deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
	} = {
		uuid,
		isOwner,
		effects,
		createEmbeddedDocuments: vi.fn(async () => undefined),
		deleteEmbeddedDocuments: vi.fn(async () => undefined),
	};
	return target;
}

const markData = {
	name: 'Marked (Aldric)',
	statuses: ['marked'],
	origin: 'Item.hunters-mark',
	flags: { [SYSTEM_ID]: { [MARK_TARGET_ITEM_FLAG]: 'Item.hunters-mark' } },
};

type Game = {
	user: { id: string; isGM: boolean };
	users?: unknown;
	socket?: unknown;
};

let originalGame: unknown;

beforeEach(() => {
	originalGame = (globalThis as { game?: unknown }).game;
});

afterEach(() => {
	(globalThis as { game?: unknown }).game = originalGame;
	vi.restoreAllMocks();
});

function setGame(game: Game) {
	(globalThis as { game?: unknown }).game = game;
}

describe('findMarkEffectIds', () => {
	it('returns only the ids stamped with the given item uuid', () => {
		const target = createTarget('Actor.goblin', true, [
			markEffect('Effect.mine', 'Item.hunters-mark'),
			markEffect('Effect.other', 'Item.someone-else'),
		]);
		expect(findMarkEffectIds(target, 'Item.hunters-mark')).toEqual(['Effect.mine']);
	});
});

describe('applyMarkEffect', () => {
	it('creates the effect directly when this client owns the target', async () => {
		setGame({ user: { id: 'player', isGM: false } });
		const target = createTarget('Actor.goblin', true);

		await applyMarkEffect({
			target,
			sourceItemUuid: 'Item.hunters-mark',
			effectData: markData,
		});

		expect(target.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
		const [type, data] = target.createEmbeddedDocuments.mock.calls[0];
		expect(type).toBe('ActiveEffect');
		expect(data[0]).toMatchObject({ statuses: ['marked'], origin: 'Item.hunters-mark' });
	});

	it('does not stack a second marker this item already applied', async () => {
		setGame({ user: { id: 'gm', isGM: true } });
		const target = createTarget('Actor.goblin', false, [
			markEffect('Effect.existing', 'Item.hunters-mark'),
		]);

		await applyMarkEffect({
			target,
			sourceItemUuid: 'Item.hunters-mark',
			effectData: markData,
		});

		expect(target.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('relays to the GM when this client can neither own the target nor is GM', async () => {
		const emit = vi.fn();
		setGame({ user: { id: 'player', isGM: false }, socket: { emit } });
		const target = createTarget('Actor.goblin', false);

		await applyMarkEffect({
			target,
			sourceItemUuid: 'Item.hunters-mark',
			effectData: markData,
		});

		expect(target.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(emit).toHaveBeenCalledTimes(1);
		const [channel, payload] = emit.mock.calls[0];
		expect(channel).toBe(`system.${SYSTEM_ID}`);
		expect(payload).toMatchObject({
			type: 'markTarget.applyEffect',
			userId: 'player',
			targetUuid: 'Actor.goblin',
			sourceItemUuid: 'Item.hunters-mark',
			effectData: markData,
		});
	});
});

describe('removeMarkEffect', () => {
	it('deletes only this item’s marker effects directly when owned', async () => {
		setGame({ user: { id: 'player', isGM: false } });
		const target = createTarget('Actor.goblin', true, [
			markEffect('Effect.mine', 'Item.hunters-mark'),
			markEffect('Effect.other', 'Item.someone-else'),
		]);

		await removeMarkEffect({ target, sourceItemUuid: 'Item.hunters-mark' });

		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['Effect.mine']);
	});

	it('is a no-op when no marker from this item exists', async () => {
		setGame({ user: { id: 'gm', isGM: true } });
		const target = createTarget('Actor.goblin', false, [
			markEffect('Effect.other', 'Item.someone-else'),
		]);

		await removeMarkEffect({ target, sourceItemUuid: 'Item.hunters-mark' });

		expect(target.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('relays to the GM when the client cannot modify the target', async () => {
		const emit = vi.fn();
		setGame({ user: { id: 'player', isGM: false }, socket: { emit } });
		const target = createTarget('Actor.goblin', false);

		await removeMarkEffect({ target, sourceItemUuid: 'Item.hunters-mark' });

		expect(target.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(emit).toHaveBeenCalledWith(`system.${SYSTEM_ID}`, {
			type: 'markTarget.removeEffect',
			userId: 'player',
			targetUuid: 'Actor.goblin',
			sourceItemUuid: 'Item.hunters-mark',
		});
	});
});

describe('registerMarkTargetSocketListener (GM side)', () => {
	// The listener is registered once per process; capture its callback the first time.
	let handler: (payload: unknown) => void;

	function installSocket() {
		let captured: ((payload: unknown) => void) | undefined;
		const on = vi.fn((_channel: string, cb: (payload: unknown) => void) => {
			captured = cb;
		});
		setGame({
			user: { id: 'gm', isGM: true },
			users: {
				activeGM: { id: 'gm' },
				get: (id: string) => (id === 'player' ? { id, isGM: false } : null),
			},
			socket: { on },
		});
		registerMarkTargetSocketListener();
		// After the first registration the module short-circuits; reuse the saved handler.
		if (captured) handler = captured;
		return { on };
	}

	beforeEach(() => {
		installSocket();
	});

	it('applies a relayed request when the requesting user owns the marking item', async () => {
		const target = createTarget('Actor.goblin', false);
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => target);
		(globalThis as { fromUuidSync?: unknown }).fromUuidSync = vi.fn(() => ({
			actor: { testUserPermission: () => true },
		}));

		handler({
			type: 'markTarget.applyEffect',
			userId: 'player',
			targetUuid: 'Actor.goblin',
			sourceItemUuid: 'Item.hunters-mark',
			effectData: markData,
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(target.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
	});

	it('ignores a relayed request when the requesting user does not own the marking item', async () => {
		const target = createTarget('Actor.goblin', false);
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => target);
		(globalThis as { fromUuidSync?: unknown }).fromUuidSync = vi.fn(() => ({
			actor: { testUserPermission: () => false },
		}));

		handler({
			type: 'markTarget.applyEffect',
			userId: 'player',
			targetUuid: 'Actor.goblin',
			sourceItemUuid: 'Item.hunters-mark',
			effectData: markData,
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(target.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('deletes this item’s markers on a relayed remove request', async () => {
		const target = createTarget('Actor.goblin', false, [
			markEffect('Effect.mine', 'Item.hunters-mark'),
		]);
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => target);
		(globalThis as { fromUuidSync?: unknown }).fromUuidSync = vi.fn(() => ({
			actor: { testUserPermission: () => true },
		}));

		handler({
			type: 'markTarget.removeEffect',
			userId: 'player',
			targetUuid: 'Actor.goblin',
			sourceItemUuid: 'Item.hunters-mark',
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['Effect.mine']);
	});

	it('ignores payloads for unrelated request types', async () => {
		const target = createTarget('Actor.goblin', false);
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => target);

		handler({ type: 'advanceCombatTurn', combatId: 'x' });
		await Promise.resolve();
		await Promise.resolve();

		expect(target.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(target.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
