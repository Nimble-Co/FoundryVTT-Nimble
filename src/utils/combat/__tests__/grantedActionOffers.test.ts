import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantedActionOffer } from '../grantedActionOffers.js';

type OffersModule = typeof import('../grantedActionOffers.js');

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
		free: false,
		spendsReaction: false,
		weaponKind: 'any',
		allowsCantrips: false,
		ignoresRushed: false,
		condition: '',
		targetCount: 0,
		targetedCount: 0,
		afterMove: false,
		afterMoveCheck: 'none',
		afterMoveFlagKey: 'quarry',
		afterMoveMinEnemies: 1,
		afterMoveStatus: '',
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
	return import('../grantedActionOffers.js');
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

	it("puts the rule's attack options on the line", async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([
			{
				type: 'grantActivation',
				id: 'rule-1',
				free: true,
				spendsReaction: false,
				weaponKind: 'melee',
				allowsCantrips: true,
				ignoresRushed: true,
				condition: 'If you end adjacent to your quarry.',
			} as never,
		]);

		const [offer] = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offer).toMatchObject({
			free: true,
			spendsReaction: false,
			weaponKind: 'melee',
			allowsCantrips: true,
			ignoresRushed: true,
			condition: 'If you end adjacent to your quarry.',
		});
	});

	it('gives a line from older rule data the behaviour of today', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([{ type: 'grantActivation', id: 'rule-1' }]);

		const [offer] = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offer).toMatchObject({
			free: false,
			spendsReaction: false,
			weaponKind: 'any',
			allowsCantrips: false,
			ignoresRushed: false,
			condition: '',
		});
	});

	it('gives only the user a line when the rule is not for the targets', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([
			{
				type: 'grantActivation',
				id: 'rule-1',
				includesUser: true,
				includesTargets: false,
			} as never,
		]);

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.enemy' } }]);

		expect(offers.map((offer) => offer.targetActorUuid)).toEqual(['Actor.commander']);
	});

	it('still gives every target a line when more are targeted than the rule reaches, and says how many', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([
			{ type: 'grantActivation', id: 'rule-1', includesUser: true, targetCount: 1 } as never,
		]);

		const offers = collectGrantedActionOffers(item, [
			{ actor: { uuid: 'Actor.commander' } },
			{ actor: { uuid: 'Actor.ally' } },
			{ actor: { uuid: 'Actor.other-ally' } },
		]);

		expect(offers.map((offer) => offer.targetActorUuid)).toEqual([
			'Actor.commander',
			'Actor.ally',
			'Actor.other-ally',
		]);
		for (const offer of offers) expect(offer).toMatchObject({ targetCount: 1, targetedCount: 2 });
	});

	it("reaches more targets with the user's rules that raise the count for the item", async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const bonus = (identifier: string, count: number) => ({
			type: 'grantTargetBonus',
			bonusFor: (wanted: string) => (wanted === identifier ? count : 0),
		});
		const item = {
			...createGrantingItem([
				{ type: 'grantActivation', id: 'rule-1', targetCount: 1 } as never,
				{ type: 'grantActivation', id: 'rule-2' },
			]),
			system: { identifier: 'granting-item' },
			actor: {
				uuid: 'Actor.commander',
				rules: [bonus('granting-item', 1), bonus('other-item', 3)],
			},
		};

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offers.map((offer) => [offer.ruleId, offer.targetCount])).toEqual([
			['rule-1', 2],
			['rule-2', 0],
		]);
	});

	it('gives the user alone a line that waits for their move, with its check', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([
			{
				type: 'grantActivation',
				id: 'rule-1',
				trigger: 'afterMove',
				afterMoveCheck: 'adjacentEnemies',
				afterMoveMinEnemies: 2,
			} as never,
		]);

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.enemy' } }]);

		expect(offers).toEqual([
			expect.objectContaining({
				targetActorUuid: 'Actor.commander',
				afterMove: true,
				afterMoveCheck: 'adjacentEnemies',
				afterMoveFlagKey: '',
				afterMoveMinEnemies: 2,
				afterMoveStatus: '',
			}),
		]);
	});

	it('gives a line on use no move to wait for and no check', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([{ type: 'grantActivation', id: 'rule-1' }]);

		const [offer] = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offer).toMatchObject({ afterMove: false, afterMoveCheck: 'none' });
	});

	it('gives no line on use for a rule that waits for an Interpose', async () => {
		const { collectGrantedActionOffers } = await loadModule();
		const item = createGrantingItem([
			{
				type: 'grantActivation',
				id: 'rule-1',
				trigger: 'onInterpose',
				includesUser: true,
			} as never,
		]);

		const offers = collectGrantedActionOffers(item, [{ actor: { uuid: 'Actor.ally' } }]);

		expect(offers).toHaveLength(0);
	});
});

describe('emptyPoolWarnings', () => {
	const item = (rules: Record<string, unknown>[]) => ({
		uuid: 'Item.roll',
		name: 'Roll & Strike',
		actor: { uuid: 'Actor.hunter' },
		rules: new Map(rules.map((rule, index) => [String(index), { appliesTo: () => true, ...rule }])),
	});
	const pools = (current: number) => (identifier: string) =>
		identifier === 'thrill' ? { label: 'Thrill of the Hunt', current } : null;

	it('warns at use while the pool the rule needs empty has charges', async () => {
		const { emptyPoolWarnings } = await loadModule();
		const rules = [{ type: 'grantActivation', id: 'r', emptyPoolIdentifier: 'thrill' }];

		expect(emptyPoolWarnings(item(rules), pools(2))).toEqual([
			'Roll & Strike is for when Thrill of the Hunt has no charges. You still have some.',
		]);
		expect(emptyPoolWarnings(item(rules), pools(0))).toEqual([]);
	});

	it('says nothing for a rule that needs no empty pool, or a pool the actor lacks', async () => {
		const { emptyPoolWarnings } = await loadModule();

		expect(emptyPoolWarnings(item([{ type: 'grantActivation', id: 'r' }]), pools(2))).toEqual([]);
		expect(
			emptyPoolWarnings(
				item([{ type: 'grantActivation', id: 'r', emptyPoolIdentifier: 'fury' }]),
				pools(2),
			),
		).toEqual([]);
	});
});

describe('collectInterposeOffers', () => {
	function interposer(rules: Record<string, unknown>[]) {
		return {
			uuid: 'Scene.s.Token.z.Actor.zephyr',
			items: [
				{
					uuid: 'Actor.zephyr.Item.quickstrike',
					name: 'Quickstrike',
					rules: new Map(
						rules.map((rule) => [rule.id as string, { appliesTo: () => true, ...rule }]),
					),
				},
				{ uuid: 'Actor.zephyr.Item.sword', name: 'Sword', rules: new Map() },
			],
		};
	}

	it('gives the one who Interposes a line from each rule that waits for an Interpose', async () => {
		const { collectInterposeOffers } = await loadModule();
		const actor = interposer([
			{
				type: 'grantActivation',
				id: 'rule-1',
				trigger: 'onInterpose',
				free: true,
				weaponKind: 'unarmed',
			},
		]);

		const offers = collectInterposeOffers(actor);

		expect(offers).toHaveLength(1);
		expect(offers[0]).toMatchObject({
			targetActorUuid: 'Scene.s.Token.z.Actor.zephyr',
			label: 'Quickstrike',
			ruleId: 'rule-1',
			sourceItemUuid: 'Actor.zephyr.Item.quickstrike',
			free: true,
			weaponKind: 'unarmed',
			used: false,
		});
	});

	it('gives no line from a rule for item use, or a rule whose predicate does not apply', async () => {
		const { collectInterposeOffers } = await loadModule();
		const actor = interposer([
			{ type: 'grantActivation', id: 'rule-1' },
			{ type: 'grantActivation', id: 'rule-2', trigger: 'onInterpose', appliesTo: () => false },
		]);

		expect(collectInterposeOffers(actor)).toHaveLength(0);
		expect(collectInterposeOffers(null)).toHaveLength(0);
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

	it('keeps what the line was used with', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		const message = createMessage([createOffer()]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestGrantedActionOfferUse({
			messageId: 'message-1',
			offerId: 'offer-1',
			usedWith: { name: 'Longsword', uuid: 'Actor.ally.Item.sword' },
		});

		expect(message.update).toHaveBeenCalledWith({
			system: {
				grantedActionOffers: [
					expect.objectContaining({
						used: true,
						usedWith: { name: 'Longsword', uuid: 'Actor.ally.Item.sword' },
					}),
				],
			},
		});
	});

	it('sends what the line was used with in the socket request', async () => {
		const { requestGrantedActionOfferUse } = await loadModule();
		setMessages({ 'message-1': createMessage([createOffer()]) });
		setUser({ id: 'player-1', isGM: false });

		await requestGrantedActionOfferUse({
			messageId: 'message-1',
			offerId: 'offer-1',
			usedWith: { name: 'Unarmed Strike', uuid: '' },
		});

		expect(globals().game.socket.emit).toHaveBeenCalledWith(
			'system.nimble',
			expect.objectContaining({ usedWith: { name: 'Unarmed Strike', uuid: '' } }),
		);
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
			usedWith: null,
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

	it('keeps a relayed weapon, and drops one that is not a name', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([
			createOffer(),
			createOffer({ id: 'offer-2', targetActorUuid: 'Actor.ally' }),
		]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener(relayedRequest({ usedWith: { name: 'Handaxe', uuid: 'Actor.ally.Item.axe' } }));
		await flushAsync();

		expect(message.update).toHaveBeenLastCalledWith({
			system: {
				grantedActionOffers: [
					expect.objectContaining({
						id: 'offer-1',
						usedWith: { name: 'Handaxe', uuid: 'Actor.ally.Item.axe' },
					}),
					expect.objectContaining({ id: 'offer-2', used: false }),
				],
			},
		});

		listener(relayedRequest({ offerId: 'offer-2', usedWith: { name: 7 } }));
		await flushAsync();

		expect(message.update).toHaveBeenLastCalledWith({
			system: {
				grantedActionOffers: expect.arrayContaining([
					expect.objectContaining({ id: 'offer-2', used: true, usedWith: null }),
				]),
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
