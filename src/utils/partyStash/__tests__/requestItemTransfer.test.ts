import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	registerPartyStashSocketListener,
	requestCurrencyTransfer,
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

function character(
	id: string,
	name: string,
	items: ItemData[],
	owns: boolean,
	coins: { gp: number; sp: number; cp: number } = { gp: 0, sp: 0, cp: 0 },
) {
	const docs = items.map(doc);
	const byId = new Map(docs.map((item) => [item._id, item]));
	const currency = { ...coins };
	return {
		id,
		name,
		type: 'character',
		isOwner: owns,
		system: { currency },
		testUserPermission: (user: { id?: string }) => owns && user.id === id,
		items: {
			get: (itemId: string) => byId.get(itemId),
			[Symbol.iterator]: () => byId.values(),
		},
		update: vi.fn(async (data: Record<string, number>) => {
			if ('system.currency.gp' in data) currency.gp = data['system.currency.gp'] ?? 0;
			if ('system.currency.sp' in data) currency.sp = data['system.currency.sp'] ?? 0;
			if ('system.currency.cp' in data) currency.cp = data['system.currency.cp'] ?? 0;
		}),
		createEmbeddedDocuments: vi.fn(async (_name: string, data: { _id?: string }[]) =>
			(data ?? []).map((item) => ({ id: item._id })),
		),
		deleteEmbeddedDocuments: vi.fn(async () => undefined),
		docs,
	};
}

const users = new Map<
	string,
	{ id: string; name: string; isGM: boolean; role?: number; active?: boolean }
>([
	['gm', { id: 'gm', name: 'Guide', isGM: true, role: 4 }],
	['ada', { id: 'ada', name: 'Ada', isGM: false, role: 1 }],
	['spy', { id: 'spy', name: 'Spy', isGM: false, role: 1 }],
	['bob', { id: 'bob', name: 'Bob', isGM: false, role: 1, active: true }],
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
			[Symbol.iterator]: () => users.values(),
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
		bob.createEmbeddedDocuments.mockImplementation(
			async (_name: string, data: { _id?: string }[]) => {
				calls.push('create');
				return (data ?? []).map((item) => ({ id: item._id }));
			},
		);
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

	it('keeps the source when the destination creates nothing', async () => {
		const torch = { _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 3 } };
		const ada = character('ada', 'Ada', [torch], true);
		const bob = character('bob', 'Bob', [], false);
		bob.createEmbeddedDocuments.mockResolvedValue([]);
		useWorld('gm', 'gm', [ada, bob]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'torch',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'bob' },
		});

		expect(ada.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
	});

	it('drops a partial create and keeps the source when the rest does not land', async () => {
		const pack = {
			_id: 'pack',
			name: 'Pack',
			type: 'object',
			system: { container: { enabled: true } },
		};
		const rope = { _id: 'rope', name: 'Rope', type: 'object', system: { containerId: 'pack' } };
		const ada = character('ada', 'Ada', [pack, rope], true);
		const bob = character('bob', 'Bob', [], false);
		bob.createEmbeddedDocuments.mockImplementation(
			async (_name: string, data: { _id?: string }[]) =>
				data.some((item) => item._id === 'pack') ? [{ id: 'pack' }] : [],
		);
		useWorld('gm', 'gm', [ada, bob]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'pack',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'bob' },
		});

		expect(bob.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['pack']);
		expect(ada.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
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

	it('sends the move to someone who can write it when this client cannot', async () => {
		const ada = character('ada', 'Ada', [], true);
		useWorld('ada', 'gm', [ada]);

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

	it('warns when the party inventory cannot be saved and nobody else is connected', async () => {
		const torch = { _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 1 } };
		const ada = character('ada', 'Ada', [torch], true);
		useWorld('ada', null, [ada]);

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

	it('lets a player move their own object into the party inventory with no GM connected', async () => {
		const torch = { _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 1 } };
		const ada = character('ada', 'Ada', [torch], true);
		const party = {
			id: 'party',
			name: 'Party Inventory',
			type: 'npc',
			testUserPermission: () => true,
			getFlag: (_scope: string, key: string) => {
				if (key === 'partyStashHolder') return true;
				if (key === 'partyStash') return stash;
				return undefined;
			},
			setFlag: vi.fn(async (_scope: string, key: string, value: typeof stash) => {
				if (key === 'partyStash') stash = value;
			}),
			items: { get: () => undefined, [Symbol.iterator]: () => [].values() },
			createEmbeddedDocuments: vi.fn(async () => undefined),
			deleteEmbeddedDocuments: vi.fn(async () => undefined),
		};
		useWorld('ada', null, [ada, party as unknown as ReturnType<typeof character>]);

		await expect(
			requestItemTransfer({
				source: 'actor',
				sourceActorId: 'ada',
				itemId: 'torch',
				quantity: 1,
				destination: { kind: 'stash' },
			}),
		).resolves.toBe(true);

		expect(socket.emit).not.toHaveBeenCalled();
		expect(ui.notifications.warn).not.toHaveBeenCalled();
		expect(ada.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['torch']);
		expect(stash.items.map((item) => item._id)).toEqual(['torch']);
	});

	it('asks the other character to receive an object when no GM is connected', async () => {
		users.get('ada')!.role = 2;
		const torch = { _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 1 } };
		const ada = character('ada', 'Ada', [torch], true);
		const bob = character('bob', 'Bob', [], true);
		useWorld('ada', null, [ada, bob]);

		await requestItemTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			itemId: 'torch',
			quantity: 1,
			destination: { kind: 'actor', actorId: 'bob' },
		});

		const receive = socket.emit.mock.calls.at(-1)?.[1] as { op: string };
		expect(receive.op).toBe('receive');

		useWorld('bob', null, [ada, bob]);
		listener?.(receive);
		await vi.waitFor(() => expect(bob.createEmbeddedDocuments).toHaveBeenCalled());
		const release = socket.emit.mock.calls.at(-1)?.[1] as { op: string; removeIds: string[] };
		expect(release.op).toBe('release');
		expect(release.removeIds).toEqual(['torch']);

		useWorld('ada', null, [ada, bob]);
		listener?.(release);
		await vi.waitFor(() =>
			expect(ada.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['torch']),
		);
		users.get('ada')!.role = 1;
	});
});

describe('requestCurrencyTransfer', () => {
	function partyHolder() {
		return {
			id: 'party',
			name: 'Party Inventory',
			type: 'npc',
			testUserPermission: () => true,
			getFlag: (_scope: string, key: string) => {
				if (key === 'partyStashHolder') return true;
				if (key === 'partyStash') return stash;
				return undefined;
			},
			setFlag: vi.fn(async (_scope: string, key: string, value: typeof stash) => {
				if (key === 'partyStash') stash = value;
			}),
			items: { get: () => undefined, [Symbol.iterator]: () => [].values() },
			createEmbeddedDocuments: vi.fn(async () => undefined),
			deleteEmbeddedDocuments: vi.fn(async () => undefined),
		};
	}

	it('adds coins to the party inventory and subtracts them from the character', async () => {
		const ada = character('ada', 'Ada', [], true, { gp: 10, sp: 1, cp: 0 });
		const party = partyHolder();
		useWorld('ada', null, [ada, party as unknown as ReturnType<typeof character>]);

		await expect(
			requestCurrencyTransfer({
				source: 'actor',
				sourceActorId: 'ada',
				destination: { kind: 'stash' },
				gp: 4,
				sp: 0,
				cp: 9,
			}),
		).resolves.toBe(true);

		expect(socket.emit).not.toHaveBeenCalled();
		expect(ada.system.currency).toEqual({ gp: 6, sp: 1, cp: 0 });
		expect(stash.currency).toEqual({ gp: 4, sp: 0, cp: 0 });
	});

	it('spends coins here and asks the other character to add them when no GM is connected', async () => {
		users.get('ada')!.role = 2;
		const ada = character('ada', 'Ada', [], true, { gp: 12, sp: 0, cp: 3 });
		const bob = character('bob', 'Bob', [], true, { gp: 1, sp: 0, cp: 0 });
		useWorld('ada', null, [ada, bob]);

		await requestCurrencyTransfer({
			source: 'actor',
			sourceActorId: 'ada',
			destination: { kind: 'actor', actorId: 'bob' },
			gp: 5,
			sp: 0,
			cp: 9,
		});

		expect(ada.system.currency).toEqual({ gp: 7, sp: 0, cp: 0 });
		const received = socket.emit.mock.calls.at(-1)?.[1] as {
			op: string;
			gp: number;
			cp: number;
		};
		expect(received.op).toBe('receiveCurrency');
		expect(received.gp).toBe(5);
		expect(received.cp).toBe(3);

		useWorld('bob', null, [ada, bob]);
		listener?.(received);
		await vi.waitFor(() => expect(bob.system.currency.gp).toBe(6));
		expect(bob.system.currency.cp).toBe(3);
		users.get('ada')!.role = 1;
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
