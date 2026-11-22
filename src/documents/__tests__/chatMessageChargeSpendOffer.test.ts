import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

/**
 * A spend from the attack card that takes a charge of a charge pool: a real
 * character actor with a real `chargePool` rule, driven through the real pool
 * helpers. The push goes through `offerMovement`, which has its own tests, so
 * only its input is checked here.
 */

const offerMovement = vi.fn(async () => true);

// Setup loads chatMessage through game.ts, so a hoisted vi.mock would miss it.
let NimbleChatMessage: typeof import('../chatMessage.js').NimbleChatMessage;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/movement/postMovementOfferCard.js', () => ({ offerMovement }));
	({ NimbleChatMessage } = await import('../chatMessage.js'));
});

afterAll(() => {
	vi.doUnmock('#utils/movement/postMovementOfferCard.js');
});

const POOL_RULE = {
	type: 'chargePool',
	id: 'combat-dice-pool',
	identifier: 'combat-dice',
	label: 'Combat Dice',
	disabled: false,
	scope: 'item',
	max: '3',
	dieSize: 'd8',
	initial: 'max',
	recoveries: [],
};

const PUSH = { distance: '@strength', distanceBySize: { small: '@strength*2' } };

function consumerRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'chargeConsumer',
		id: 'heavy-strike-spend',
		disabled: false,
		poolIdentifier: 'combat-dice',
		poolScope: 'item',
		cost: '1',
		cardOffer: 'hit',
		effectFormula: '1d@pools.combat-dice.faces',
		cardPush: PUSH,
		providesCardOffer: () => true,
		...overrides,
	};
}

function createActor(current: number, consumer: Record<string, unknown> = consumerRule()) {
	const pools = {
		id: 'item-fit',
		name: 'Fit for Any Battlefield',
		uuid: 'Actor.commander.Item.item-fit',
		flags: { [SYSTEM_ID]: { chargePools: { 'combat-dice': { current, max: 3, seeded: true } } } },
		rules: new Map([['combat-dice-pool', POOL_RULE]]),
		update: vi.fn().mockResolvedValue(undefined),
	};
	const heavy = {
		id: 'item-heavy',
		name: 'Heavy Strike',
		img: 'heavy.webp',
		uuid: 'Actor.commander.Item.item-heavy',
		flags: {},
		rules: new Map([[String(consumer.id), consumer]]),
		update: vi.fn().mockResolvedValue(undefined),
	};
	return {
		uuid: 'Actor.commander',
		type: 'character',
		name: 'Wren',
		items: {
			contents: [pools, heavy],
			get: (id: string) => [pools, heavy].find((item) => item.id === id),
		},
		flags: {},
		getRollData: () => ({ strength: 3, pools: { 'combat-dice': { faces: 8 } } }),
		testUserPermission: () => true,
		update: vi.fn().mockResolvedValue(undefined),
		_pools: pools,
		_heavy: heavy,
	};
}

function damageRoll() {
	return {
		class: 'DamageRoll',
		formula: '1d8 + 2',
		total: 7,
		terms: [
			{
				class: 'Die',
				number: 1,
				faces: 8,
				evaluated: true,
				results: [{ result: 5, active: true, discarded: false }],
			},
		],
	};
}

function spendEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'spend-1',
		kind: 'spendPoolForDamage',
		source: 'rule',
		actorUuid: 'Actor.commander',
		tokenUuid: null,
		targetTokenUuid: null,
		label: 'Heavy Strike',
		ruleId: 'heavy-strike-spend',
		itemUuid: 'Actor.commander.Item.item-heavy',
		used: false,
		outcomeTrigger: 'hit',
		...overrides,
	};
}

type MockedMessage = InstanceType<typeof NimbleChatMessage> & {
	update: ReturnType<typeof vi.fn>;
};

function createMessage(
	card: { isMiss?: boolean; targets?: string[]; chargeConsumption?: object[] } = {},
) {
	const roll = damageRoll();
	const message = new NimbleChatMessage({
		type: 'feature',
		speaker: { scene: 'scene', token: 'wren', actor: 'commander' },
		flags: { [SYSTEM_ID]: { chargeConsumption: card.chargeConsumption ?? [] } },
		system: {
			targets: card.targets ?? ['Scene.scene.Token.goblin'],
			isCritical: false,
			isMiss: card.isMiss ?? false,
			activation: {
				effects: [
					{ id: 'damage-node', type: 'damage', parentNode: null, parentContext: null, roll },
				],
				targets: { count: 1, attackType: 'reach', distance: 1 },
			},
			incomingReactions: [spendEntry()],
		},
	} as unknown as ChatMessage.CreateData) as MockedMessage;

	message.update = vi.fn().mockResolvedValue(undefined);
	(message as unknown as { _source: { rolls: string[] } })._source = {
		rolls: [JSON.stringify(roll)],
	};
	return message;
}

const globals = globalThis as unknown as Record<string, unknown>;
const OwnRoll = globals.Roll;

const BaseRoll = OwnRoll as new (
	formula: string,
	data?: unknown,
) => { formula: string; _total?: number; evaluateSync: () => unknown };

const rolled: Array<{ formula: string; data: unknown }> = [];

/** A roll whose dice come up 6. A formula with no dice works out as the shared mock does. */
class CombatDieRoll extends BaseRoll {
	terms: unknown[] = [];

	constructor(formula: string, data?: unknown) {
		super(formula, data);
		rolled.push({ formula, data });
	}

	async evaluate() {
		if (!this.formula.includes('d')) return this.evaluateSync();
		this._total = 6;
		this.terms = [{ faces: 8, results: [{ result: 6, active: true }] }];
		return this;
	}
}

const wrenToken = { uuid: 'Scene.scene.Token.wren', name: 'Wren' };

function useActor(actor: ReturnType<typeof createActor>) {
	globals.fromUuidSync = vi.fn((uuid: string) => {
		if (uuid === actor._heavy.uuid) return actor._heavy;
		if (uuid === wrenToken.uuid) return { ...wrenToken, actor };
		return actor;
	});
}

describe('a spend of a charge from the attack card', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		rolled.length = 0;
		globals.Roll = CombatDieRoll;
		(globals.game as { user: unknown }).user = { isGM: true, id: 'gm-user' };
		(globals.game as { users: unknown }).users = {
			get: vi.fn((id: string) => (id === 'gm-user' ? { isGM: true, id } : null)),
		};
	});

	afterAll(() => {
		globals.Roll = OwnRoll;
	});

	it('spends one charge and adds the roll of the die to the damage', async () => {
		const actor = createActor(2);
		useActor(actor);
		const message = createMessage();

		await message.resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		const written = actor._pools.update.mock.calls[0][0] as Record<string, unknown>;
		const stored = written[`flags.${SYSTEM_ID}.chargePools`] as Record<string, { current: number }>;
		expect(stored['combat-dice'].current).toBe(1);

		const payload = message.update.mock.calls[0][0] as {
			system: {
				activation: { effects: Array<{ roll: { total: number } }> };
				incomingReactions: Array<Record<string, unknown>>;
			};
		};
		expect(payload.system.activation.effects[0].roll.total).toBe(13);
		expect(payload.system.incomingReactions[0]).toMatchObject({
			used: true,
			usedAmount: 6,
			usedPoolLabel: 'Combat Dice',
			usedFaces: [6],
		});
	});

	it('rolls the formula with the numbers of the attacker', async () => {
		const actor = createActor(2);
		useActor(actor);

		await createMessage().resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(rolled).toContainEqual({
			formula: '1d@pools.combat-dice.faces',
			data: expect.objectContaining({ strength: 3 }),
		});
	});

	it('pushes the targets of the card, as a line on the card', async () => {
		const actor = createActor(2);
		useActor(actor);
		const message = createMessage();

		await message.resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(offerMovement).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Heavy Strike',
				node: expect.objectContaining({
					kind: 'forced',
					direction: 'away',
					distance: '@strength',
					distanceBySize: { small: '@strength*2' },
				}),
				recipients: ['Scene.scene.Token.goblin'],
			}),
			{ card: message },
		);
	});

	it('pushes nothing when the rule has no push', async () => {
		const actor = createActor(2, consumerRule({ cardPush: null }));
		useActor(actor);

		await createMessage().resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(offerMovement).not.toHaveBeenCalled();
	});

	it('refuses with no charge left', async () => {
		const actor = createActor(0);
		useActor(actor);
		const message = createMessage();

		await message.resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(offerMovement).not.toHaveBeenCalled();
	});

	it('refuses on a card that missed', async () => {
		const actor = createActor(2);
		useActor(actor);
		const message = createMessage({ isMiss: true });

		await message.resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(actor._pools.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses when the attack already spent from the pool in the roll window', async () => {
		const actor = createActor(2);
		useActor(actor);
		const message = createMessage({
			chargeConsumption: [{ poolId: 'combat-dice', poolLabel: 'Combat Dice', change: -1 }],
		});

		await message.resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(actor._pools.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a rule that no longer offers the spend', async () => {
		const actor = createActor(2, consumerRule({ providesCardOffer: () => false }));
		useActor(actor);
		const message = createMessage();

		await message.resolveSpendChargeForDamageOffer('spend-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
	});
});
