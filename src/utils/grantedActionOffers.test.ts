import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantedActionOffer } from './grantedActionOffers.js';

type OffersModule = typeof import('./grantedActionOffers.js');

interface MockMessage {
	system: { grantedActionOffers: GrantedActionOffer[] };
	update: ReturnType<typeof vi.fn>;
}

type TestGlobals = {
	game: {
		user: { id: string | null; isGM: boolean } | null;
		users: {
			activeGM: { id: string } | null;
			contents: Array<{ id: string; isGM: boolean; active: boolean }>;
			get: (id: string) => { id: string; isGM: boolean } | null;
		};
		socket: { on?: ReturnType<typeof vi.fn>; emit?: ReturnType<typeof vi.fn> };
		messages: { get: ReturnType<typeof vi.fn> };
	};
	fromUuidSync: ReturnType<typeof vi.fn>;
};

function globals(): TestGlobals {
	return globalThis as unknown as TestGlobals;
}

function createOffer(overrides: Partial<GrantedActionOffer> = {}): GrantedActionOffer {
	return {
		id: 'offer-1',
		targetActorUuid: 'Actor.ally',
		label: 'Granting Feature',
		activationType: 'weaponAttack',
		ruleId: 'rule-1',
		sourceItemUuid: 'Item.granting-item',
		used: false,
		usedBy: null,
		...overrides,
	};
}

function createMessage(offers: GrantedActionOffer[]): MockMessage {
	return {
		system: { grantedActionOffers: offers },
		update: vi.fn().mockResolvedValue(undefined),
	};
}

function setUser(user: { id: string | null; isGM: boolean } | null): void {
	globals().game.user = user;
}

function setUsers(users: Array<{ id: string; isGM: boolean; active?: boolean }>): void {
	const gm = users.find((user) => user.isGM && user.active !== false) ?? null;
	globals().game.users = {
		activeGM: gm ? { id: gm.id } : null,
		contents: users.map((user) => ({ ...user, active: user.active !== false })),
		get: (id: string) => users.find((user) => user.id === id) ?? null,
	};
}

function setMessages(messagesById: Record<string, MockMessage>): void {
	globals().game.messages = {
		get: vi.fn((id: string) => messagesById[id] ?? null),
	};
}

/**
 * Route fromUuidSync by uuid: the ally actor for ownership checks, the
 * granting item for rule revalidation.
 */
function setDocuments(options: { allyIsOwnedByRequester?: boolean; ruleDisabled?: boolean } = {}) {
	globals().fromUuidSync = vi.fn((uuid: string) => {
		if (uuid === 'Actor.ally') {
			return {
				name: 'Sir Brannon',
				testUserPermission: () => options.allyIsOwnedByRequester ?? true,
			};
		}
		if (uuid === 'Item.granting-item') {
			return {
				rules: new Map([['key', { id: 'rule-1', disabled: options.ruleDisabled ?? false }]]),
			};
		}
		return null;
	});
}

// The module keeps a "listener already registered" flag at module scope, so
// every test needs a fresh module instance to register its own socket spy.
async function loadModule(): Promise<OffersModule> {
	vi.resetModules();
	return import('./grantedActionOffers.js');
}

beforeEach(() => {
	vi.clearAllMocks();
	setUsers([
		{ id: 'gm-user', isGM: true },
		{ id: 'player-1', isGM: false },
	]);
	setMessages({});
	setDocuments();
	globals().game.socket = { on: vi.fn(), emit: vi.fn() };
});

describe('collectGrantedActionOffers', () => {
	function createGrantingItem(
		rules: Array<{ type: string; id: string; label?: string; appliesTo?: () => boolean }>,
	) {
		return {
			uuid: 'Item.granting-item',
			name: 'Granting Item',
			actor: { uuid: 'Actor.commander' },
			rules: new Map(rules.map((rule) => [rule.id, { appliesTo: () => true, ...rule }])),
		};
	}

	it('builds one offer per grantActivation rule and target actor', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([{ type: 'grantActivation', id: 'rule-1', label: 'Strike' }]);

		const offers = collectGrantedActionOffers(item, [
			{ actor: { uuid: 'Actor.ally' } },
			{ actor: { uuid: 'Actor.other-ally' } },
		]);

		expect(offers).toHaveLength(2);
		expect(offers[0]).toMatchObject({
			targetActorUuid: 'Actor.ally',
			label: 'Strike',
			activationType: 'weaponAttack',
			ruleId: 'rule-1',
			sourceItemUuid: 'Item.granting-item',
			used: false,
			usedBy: null,
		});
	});

	it('never offers the activating actor their own grant', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([{ type: 'grantActivation', id: 'rule-1' }]);

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.commander' } }]);

		expect(offers).toHaveLength(0);
	});

	it('deduplicates multiple targeted tokens of the same actor', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([{ type: 'grantActivation', id: 'rule-1' }]);

		const offers = collectGrantedActionOffers(item, [
			{ actor: { uuid: 'Actor.ally' } },
			{ actor: { uuid: 'Actor.ally' } },
		]);

		expect(offers).toHaveLength(1);
	});

	it('falls back to the item name when the rule has no label', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([{ type: 'grantActivation', id: 'rule-1' }]);

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offers[0]?.label).toBe('Granting Item');
	});

	it('ignores rules of other types and rules whose predicate does not apply', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([
			{ type: 'actionDelta', id: 'rule-1' },
			{ type: 'grantActivation', id: 'rule-2', appliesTo: () => false },
		]);

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offers).toHaveLength(0);
	});
});

describe('requestGrantedActionOfferUse', () => {
	it('stamps the offer used directly for a GM user without emitting a socket request', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await expect(
			requestGrantedActionOfferUse({ messageId: 'message-1', offerId: 'offer-1' }),
		).resolves.toBe(true);

		expect(message.update).toHaveBeenCalledWith({
			system: {
				grantedActionOffers: [
					expect.objectContaining({ id: 'offer-1', used: true, usedBy: 'gm-user' }),
				],
			},
		});
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('emits a socket request with the expected payload for a non-GM user', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		setUser({ id: 'player-1', isGM: false });

		await expect(
			requestGrantedActionOfferUse({ messageId: 'message-1', offerId: 'offer-1' }),
		).resolves.toBe(true);

		expect(globals().game.socket.emit).toHaveBeenCalledWith('system.nimble', {
			type: 'grantedActionOffer',
			messageId: 'message-1',
			offerId: 'offer-1',
			userId: 'player-1',
		});
		expect(message.update).not.toHaveBeenCalled();
	});

	it('returns false for a non-GM user when no GM is active', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		setUser({ id: 'player-1', isGM: false });
		setUsers([{ id: 'player-1', isGM: false }]);

		await expect(
			requestGrantedActionOfferUse({ messageId: 'message-1', offerId: 'offer-1' }),
		).resolves.toBe(false);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('returns false when there is no logged-in user', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		setUser(null);

		await expect(
			requestGrantedActionOfferUse({ messageId: 'message-1', offerId: 'offer-1' }),
		).resolves.toBe(false);
	});

	it('does not stamp an already-used offer again', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		const message = createMessage([createOffer({ used: true, usedBy: 'player-1' })]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestGrantedActionOfferUse({ messageId: 'message-1', offerId: 'offer-1' });

		expect(message.update).not.toHaveBeenCalled();
	});

	it('rejects when the granting rule has been disabled since the offer was made', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		setDocuments({ ruleDisabled: true });
		setUser({ id: 'gm-user', isGM: true });

		await requestGrantedActionOfferUse({ messageId: 'message-1', offerId: 'offer-1' });

		expect(message.update).not.toHaveBeenCalled();
	});
});

describe('registerGrantedActionOfferSocketListener', () => {
	async function registerAndGetListener(): Promise<(payload: unknown) => void> {
		const { registerGrantedActionOfferSocketListener } = await loadModule();
		registerGrantedActionOfferSocketListener();

		const socketOn = globals().game.socket.on;
		expect(socketOn).toHaveBeenCalledWith('system.nimble', expect.any(Function));
		return socketOn?.mock.calls[0]?.[1] as (payload: unknown) => void;
	}

	async function flushAsync(): Promise<void> {
		await Promise.resolve();
		await Promise.resolve();
	}

	function relayedRequest(overrides: Record<string, unknown> = {}) {
		return {
			type: 'grantedActionOffer',
			messageId: 'message-1',
			offerId: 'offer-1',
			userId: 'player-1',
			...overrides,
		};
	}

	it('lets the primary active GM stamp a relayed request from an owning player', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest());
		await flushAsync();

		expect(message.update).toHaveBeenCalledWith({
			system: {
				grantedActionOffers: [
					expect.objectContaining({ id: 'offer-1', used: true, usedBy: 'player-1' }),
				],
			},
		});
	});

	it('rejects a relayed request whose user does not own the recipient actor', async () => {
		setUser({ id: 'gm-user', isGM: true });
		setDocuments({ allyIsOwnedByRequester: false });
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest());
		await flushAsync();

		expect(message.update).not.toHaveBeenCalled();
	});

	it('rejects a relayed request that claims GM identity (spoof guard)', async () => {
		setUser({ id: 'gm-user', isGM: true });
		setUsers([
			{ id: 'gm-user', isGM: true },
			{ id: 'other-gm', isGM: true },
		]);
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest({ userId: 'other-gm' }));
		await flushAsync();

		expect(message.update).not.toHaveBeenCalled();
	});

	it('ignores requests of a different type', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest({ type: 'incomingAttackReaction' }));
		await flushAsync();

		expect(message.update).not.toHaveBeenCalled();
	});

	it('ignores requests on non-GM clients', async () => {
		setUser({ id: 'player-2', isGM: false });
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest());
		await flushAsync();

		expect(message.update).not.toHaveBeenCalled();
	});

	it('only executes on the primary active GM client', async () => {
		setUser({ id: 'secondary-gm', isGM: true });
		setUsers([
			{ id: 'gm-user', isGM: true },
			{ id: 'secondary-gm', isGM: true },
		]);
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest());
		await flushAsync();

		expect(message.update).not.toHaveBeenCalled();
	});

	it('ignores malformed payloads missing required fields', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({ type: 'grantedActionOffer', messageId: 'message-1' });
		listener(null);
		listener('not-an-object');
		await flushAsync();

		expect(message.update).not.toHaveBeenCalled();
	});

	it('registers the socket listener only once per module instance', async () => {
		const { registerGrantedActionOfferSocketListener } = await loadModule();
		registerGrantedActionOfferSocketListener();
		registerGrantedActionOfferSocketListener();

		expect(globals().game.socket.on).toHaveBeenCalledTimes(1);
	});
});
