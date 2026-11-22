import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	registerPartyStashSocketListener,
	requestItemTransfer,
	requestPartyCurrency,
} from '../requestItemTransfer.ts';

interface ItemData {
	_id: string;
	name: string;
	type: string;
	system?: Record<string, unknown>;
}

interface HeldDoc extends ItemData {
	toObject: () => ItemData;
	update: ReturnType<typeof vi.fn>;
}

function doc(data: ItemData): HeldDoc {
	return {
		...data,
		toObject: () => structuredClone(data),
		update: vi.fn(async () => undefined),
	};
}

function character(id: string, name: string, items: ItemData[], owns: boolean) {
	const docs = items.map(doc);
	const byId = new Map(docs.map((item) => [item._id, item]));
	return {
		id,
		name,
		type: 'character',
		isOwner: owns,
		testUserPermission: (user: { id?: string }) => owns && user.id === id,
		items: {
			get: (itemId: string) => byId.get(itemId),
			[Symbol.iterator]: () => byId.values(),
		},
		createEmbeddedDocuments: vi.fn(async () => undefined),
		deleteEmbeddedDocuments: vi.fn(async () => undefined),
		docs,
	};
}

const users = new Map([
	['gm', { id: 'gm', name: 'Guide', isGM: true }],
	['ada', { id: 'ada', name: 'Ada', isGM: false }],
	['spy', { id: 'spy', name: 'Spy', isGM: false }],
]);

const socket = {
	on: vi.fn(),
	emit: vi.fn(),
};

let listener: ((payload: unknown) => void) | undefined;
let stash = { currency: { gp: 0, sp: 0, cp: 0 }, items: [] as ItemData[] };
const settings = {
	get: () => structuredClone(stash),
	set: vi.fn(async (_scope: string, _key: string, value: typeof stash) => {
		stash = value;
	}),
};

const gameRecord = () => game as unknown as Record<string, unknown>;
const saved: Record<string, unknown> = {};
let originalCreate: typeof ChatMessage.create | undefined;

beforeEach(() => {
	stash = { currency: { gp: 0, sp: 0, cp: 0 }, items: [] };
	settings.set.mockClear();
	socket.emit.mockClear();
	vi.mocked(ui.notifications.warn).mockClear();
	for (const key of ['user', 'users', 'actors', 'settings', 'socket'] as const) {
		if (!(key in saved)) saved[key] = gameRecord()[key];
	}
	socket.on.mockImplementation((_event: string, callback: (payload: unknown) => void) => {
		listener = callback;
	});
	gameRecord().socket = socket;
	registerPartyStashSocketListener();
	originalCreate ??= ChatMessage.create;
	ChatMessage.create = vi.fn(async () => undefined) as typeof ChatMessage.create;
});

afterEach(() => {
	Object.assign(gameRecord(), saved);
	if (originalCreate) ChatMessage.create = originalCreate;
});

function useWorld(
	userId: string,
	activeGmId: string | null,
	actors: ReturnType<typeof character>[],
) {
	const byId = new Map(actors.map((actor) => [actor.id, actor]));
	Object.assign(gameRecord(), {
		user: users.get(userId),
		users: {
			get: (id: string) => users.get(id) ?? null,
			activeGM: activeGmId ? { id: activeGmId } : null,
		},
		actors: {
			get: (id: string) => byId.get(id) ?? null,
			[Symbol.iterator]: () => byId.values(),
		},
		settings,
		socket,
	});
}

describe('requestItemTransfer', () => {
	it('listens once', () => {
		socket.on.mockImplementation((_event: string, callback: (payload: unknown) => void) => {
			listener = callback;
		});
		gameRecord().socket = socket;
		registerPartyStashSocketListener();
		registerPartyStashSocketListener();
		expect(socket.on).toHaveBeenCalledTimes(1);
	});

	it('lets the active GM create the object at the destination before deleting it', async () => {
		const torch = {
			_id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 1, equipped: true },
		};
		const ada = character('ada', 'Ada', [torch], true);
		const bob = character('bob', 'Bob', [], false);
		const calls: string[] = [];
		ada.deleteEmbeddedDocuments.mockImplementation(async () => {
			calls.push('delete');
		});
		bob.createEmbeddedDocuments.mockImplementation(async () => {
			calls.push('create');
		});
		useWorld('gm', 'gm', [ada, bob]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'torch',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'bob' },
		});

		expect(calls).toEqual(['create', 'delete']);
		expect(bob.createEmbeddedDocuments).toHaveBeenCalledWith(
			'Item',
			[
				expect.objectContaining({
					_id: 'torch',
					system: expect.objectContaining({ equipped: false, containerId: '' }),
				}),
			],
			{ keepId: true },
		);
		expect(socket.emit).not.toHaveBeenCalled();
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				user: 'gm',
				content: expect.stringContaining('Guide gave Torch to Bob'),
			}),
		);
	});

	it('moves a container before its contents', async () => {
		const pack = {
			_id: 'pack',
			name: 'Pack',
			type: 'object',
			system: { container: { enabled: true }, equipped: true },
		};
		const rope = { _id: 'rope', name: 'Rope', type: 'object', system: { containerId: 'pack' } };
		const ada = character('ada', 'Ada', [pack, rope], true);
		const bob = character('bob', 'Bob', [], false);
		useWorld('gm', null, [ada, bob]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'pack',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'bob' },
		});

		expect(bob.createEmbeddedDocuments).toHaveBeenNthCalledWith(
			1,
			'Item',
			[expect.objectContaining({ _id: 'pack' })],
			{ keepId: true },
		);
		expect(bob.createEmbeddedDocuments).toHaveBeenNthCalledWith(
			2,
			'Item',
			[
				expect.objectContaining({
					_id: 'rope',
					system: expect.objectContaining({ containerId: 'pack' }),
				}),
			],
			{ keepId: true },
		);
	});

	it('reduces a stack and creates the part that leaves', async () => {
		const torch = {
			_id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 5, objectSizeType: 'stackable' },
		};
		const ada = character('ada', 'Ada', [torch], true);
		const bob = character('bob', 'Bob', [], false);
		useWorld('gm', 'gm', [ada, bob]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'torch',
			quantity: 2,
			destination: { kind: 'actor', actorId: 'bob' },
		});

		expect(ada.docs[0]?.update).toHaveBeenCalledWith({ 'system.quantity': 3 });
		expect(ada.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(bob.createEmbeddedDocuments).toHaveBeenCalledWith(
			'Item',
			[
				expect.objectContaining({
					system: expect.objectContaining({ quantity: 2, equipped: false }),
				}),
			],
			{ keepId: true },
		);
	});

	it('takes an object out of the stash for a player who owns a character', async () => {
		stash.items = [{ _id: 'gem', name: 'Gem', type: 'object', system: { quantity: 1 } }];
		const ada = character('ada', 'Ada', [], true);
		useWorld('gm', 'gm', [ada]);

		listener?.({
			type: 'partyStash',
			op: 'move',
			userId: 'ada',
			source: 'stash',
			sourceActorId: 'ada',
			itemId: 'gem',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'ada' },
		});
		await vi.waitFor(() => expect(ada.createEmbeddedDocuments).toHaveBeenCalled());

		expect(stash.items).toEqual([]);
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				user: 'ada',
				content: expect.stringContaining('Ada gave Gem to Ada'),
			}),
		);
	});

	it('does nothing for a user who owns neither the source nor a character', async () => {
		const torch = { _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 1 } };
		const ada = character('ada', 'Ada', [torch], false);
		const bob = character('bob', 'Bob', [], false);
		useWorld('gm', 'gm', [ada, bob]);

		listener?.({
			type: 'partyStash',
			op: 'move',
			userId: 'spy',
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'torch',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'bob' },
		});
		await Promise.resolve();

		expect(bob.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(ada.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('refuses to hand an object to the character who already has it', async () => {
		const torch = { _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 1 } };
		const ada = character('ada', 'Ada', [torch], true);
		useWorld('gm', 'gm', [ada]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'torch',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'ada' },
		});

		expect(ada.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(ada.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('sends the move to the active GM when this client is not one', async () => {
		useWorld('ada', 'gm', []);

		await expect(
			requestItemTransfer({
				source: 'stash',
				sourceActorId: 'ada',
				itemId: 'gem',
				quantity: 1,
				destination: { kind: 'actor', actorId: 'ada' },
			}),
		).resolves.toBe(true);

		expect(socket.emit).toHaveBeenCalledWith(
			expect.stringContaining('system.'),
			expect.objectContaining({ type: 'partyStash', op: 'move', userId: 'ada' }),
		);
	});

	it('warns when no GM is online', async () => {
		useWorld('ada', null, []);

		await expect(
			requestItemTransfer({
				source: 'actor',
				sourceActorId: 'ada',
				itemId: 'torch',
				quantity: 1,
				destination: { kind: 'stash' },
			}),
		).resolves.toBe(false);

		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(socket.emit).not.toHaveBeenCalled();
	});
});

describe('requestPartyCurrency', () => {
	it('sets one coin for someone who can take from the stash, and ignores anyone else', async () => {
		const ada = character('ada', 'Ada', [], true);
		useWorld('gm', 'gm', [ada]);

		listener?.({ type: 'partyStash', op: 'currency', userId: 'ada', coin: 'gp', value: 9 });
		await vi.waitFor(() => expect(stash.currency.gp).toBe(9));

		settings.set.mockClear();
		listener?.({ type: 'partyStash', op: 'currency', userId: 'spy', coin: 'gp', value: 1 });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(stash.currency.gp).toBe(9);
		expect(settings.set).not.toHaveBeenCalled();

		await requestPartyCurrency('sp', 4);
		expect(stash.currency.sp).toBe(4);
	});
});
