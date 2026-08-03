import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { NimbleChatMessage } from './chatMessage.js';

/**
 * End-to-end coverage of the card-side spend: a real character actor with a
 * real `dicePool` + `diceConsumer` rule pair, driven through the real pool
 * helpers. Only the persistence boundary (`item.update`) is stubbed, so the
 * pool lookup, the card-offer filtering, the formula evaluation and the fold
 * are all genuinely exercised rather than mocked past.
 */

const POOL_RULE = {
	type: 'dicePool',
	id: 'fury-pool-base',
	identifier: 'fury',
	label: 'Fury Dice',
	disabled: false,
	scope: 'item',
	dieSize: 'd6',
	max: '3',
	initial: 'zero',
	refills: [],
};

function consumerRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'diceConsumer',
		id: 'death-blow-fury-consumer',
		label: 'Death Blow: bonus damage',
		disabled: false,
		poolIdentifier: 'fury',
		poolScope: 'item',
		mode: 'manual',
		cost: '1',
		effectFormula: '2 * @sum',
		effectType: 'generic',
		selectionOutcome: 'consume',
		cardOffer: 'criticalHit',
		appliesTo: () => true,
		...overrides,
	};
}

function createActor(faces: number[], rules: Array<Record<string, unknown>>) {
	const item = {
		id: 'item-death-blow',
		name: 'Death Blow',
		uuid: 'Item.death-blow',
		flags: {
			[SYSTEM_ID]: {
				dicePools: {
					fury: {
						identifier: 'fury',
						label: 'Fury Dice',
						scope: 'item',
						dieSize: 'd6',
						max: 3,
						faces: [...faces],
						sourceItemId: 'item-death-blow',
						sourceItemName: 'Death Blow',
						refills: [],
					},
				},
			},
		},
		rules: new Map(rules.map((rule) => [String(rule.id), rule])),
		update: vi.fn().mockResolvedValue(undefined),
	};

	return {
		uuid: 'Actor.berserker',
		type: 'character',
		name: 'Grog',
		items: { contents: [item] },
		flags: {},
		getRollData: () => ({}),
		testUserPermission: () => true,
		update: vi.fn().mockResolvedValue(undefined),
		_item: item,
	};
}

function damageRoll() {
	return {
		class: 'DamageRoll',
		formula: '1d6 + 2',
		total: 8,
		isCritical: true,
		terms: [
			{
				class: 'Die',
				number: 1,
				faces: 6,
				evaluated: true,
				results: [{ result: 6, active: true, discarded: false }],
			},
		],
	};
}

function spendEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'spend-1',
		kind: 'spendPoolForDamage',
		source: 'rule',
		actorUuid: 'Actor.berserker',
		tokenUuid: null,
		targetTokenUuid: null,
		label: 'Death Blow: bonus damage',
		ruleId: 'death-blow-fury-consumer',
		// Empty itemUuid skips the rule-still-enabled revalidation
		itemUuid: '',
		used: false,
		...overrides,
	};
}

type MockedMessage = NimbleChatMessage & { update: ReturnType<typeof vi.fn> };

function createMessage(
	entries: Array<Record<string, unknown>>,
	roll: Record<string, unknown> | null = damageRoll(),
	card: { isCritical?: boolean; isMiss?: boolean; attackType?: string } = {},
) {
	const message = new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: ['Scene.scene.Token.victim'],
			isCritical: card.isCritical ?? true,
			isMiss: card.isMiss ?? false,
			activation: {
				effects: roll
					? [{ id: 'damage-node', type: 'damage', parentNode: null, parentContext: null, roll }]
					: [],
				targets: { count: 1, attackType: card.attackType ?? 'reach', distance: 1 },
			},
			incomingReactions: entries,
		},
	} as unknown as ChatMessage.CreateData) as MockedMessage;

	message.update = vi.fn().mockResolvedValue(undefined);
	(message as unknown as { _source: { rolls: string[] } })._source = {
		rolls: roll ? [JSON.stringify(roll)] : [],
	};
	return message;
}

function selection(poolFaces: number[], faceIndices: number[], expectedFaces?: number[]) {
	return {
		poolId: 'fury',
		faceIndices,
		expectedFaces: expectedFaces ?? faceIndices.map((index) => poolFaces[index]),
	};
}

const globals = globalThis as unknown as Record<string, unknown>;

// The shared Roll mock only resolves a formula in `evaluateSync`; the
// executor evaluates asynchronously, so borrow the sync parser for it.
const BaseRoll = globals.Roll as new (
	formula: string,
	data?: unknown,
) => { evaluateSync: () => unknown };

function setupSpendGlobals(): void {
	vi.clearAllMocks();
	globals.Roll = class FormulaRoll extends BaseRoll {
		async evaluate() {
			this.evaluateSync();
			return this;
		}
	};
	(globals.game as { user: { isGM: boolean; id: string } }).user = {
		isGM: true,
		id: 'gm-user',
	};
	(globals.game as { users: unknown }).users = {
		get: vi.fn((id: string) => (id === 'gm-user' ? { isGM: true, id } : null)),
	};
}

function useActor(actor: ReturnType<typeof createActor>) {
	globals.fromUuidSync = vi.fn(() => actor);
}

describe('resolveSpendPoolForDamageOffer', () => {
	beforeEach(setupSpendGlobals);

	it('spends the picked dice and folds the result into the damage total', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		// Faces 4 and 5 -> sum 9 -> "2 * 9" -> +18 onto a base total of 8
		await message.resolveSpendPoolForDamageOffer(
			'spend-1',
			'gm-user',
			selection([4, 3, 5], [0, 2]),
		);

		const payload = message.update.mock.calls[0][0] as {
			rolls: string[];
			system: {
				activation: { effects: Array<{ roll: { total: number } }> };
				incomingReactions: Array<Record<string, unknown>>;
			};
		};

		expect(payload.system.activation.effects[0].roll.total).toBe(26);
		expect(JSON.parse(payload.rolls[0]).total).toBe(26);
		expect(payload.system.incomingReactions[0]).toMatchObject({
			used: true,
			usedAmount: 18,
			usedPoolLabel: 'Fury Dice',
			usedFaces: [4, 5],
		});
	});

	it('leaves the unpicked dice in the pool', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer(
			'spend-1',
			'gm-user',
			selection([4, 3, 5], [0, 2]),
		);

		const written = actor._item.update.mock.calls[0][0] as Record<string, unknown>;
		const pools = written[`flags.${SYSTEM_ID}.dicePools`] as Record<string, { faces: number[] }>;
		expect(pools.fury.faces).toEqual([3]);
	});

	it('resolves the effect formula through the live rule, so modifiers apply', async () => {
		const actor = createActor(
			[4, 3, 5],
			[
				POOL_RULE,
				consumerRule(),
				{
					type: 'modifyConsumer',
					id: 'stone-resilience',
					disabled: false,
					poolIdentifier: 'fury',
					poolScope: 'item',
					effectTypeFilter: 'generic',
					appendFormula: '@sum',
					priority: 1,
					appliesTo: () => true,
				},
			],
		);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		// "2 * 9" plus the appended "(9)" -> +27
		await message.resolveSpendPoolForDamageOffer(
			'spend-1',
			'gm-user',
			selection([4, 3, 5], [0, 2]),
		);

		const payload = message.update.mock.calls[0][0] as {
			system: { activation: { effects: Array<{ roll: { total: number } }> } };
		};
		expect(payload.system.activation.effects[0].roll.total).toBe(35);
	});

	it('refuses a selection whose dice moved while the picker was open', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		// The player was shown a 6 at index 0; the live pool holds a 4 there.
		await message.resolveSpendPoolForDamageOffer(
			'spend-1',
			'gm-user',
			selection([4, 3, 5], [0], [6]),
		);

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('leaves the pool alone when the card has no damage roll to fold into', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()], null);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a consumer whose predicate no longer passes', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule({ appliesTo: () => false })]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses to run anywhere but the GM client', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		(globals.game as { user: { isGM: boolean } }).user.isGM = false;
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses an entry that was already used', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry({ used: true })]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a relayed request that claims GM identity', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer(
			'spend-1',
			'gm-user',
			selection([4, 3, 5], [0]),
			true,
		);

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses when the requesting user does not own the acting actor', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		actor.testUserPermission = () => false;
		useActor(actor);
		(globals.game as { users: unknown }).users = {
			get: vi.fn(() => ({ isGM: false, id: 'player-2' })),
		};
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'player-2', selection([4, 3, 5], [0]));

		expect(message.update).not.toHaveBeenCalled();
	});

	it('applies a delivery-filtered consumer to a matching attack', async () => {
		const actor = createActor(
			[4, 3, 5],
			[POOL_RULE, consumerRule({ bonusOnAttackDelivery: 'melee' })],
		);
		useActor(actor);
		const message = createMessage([spendEntry()], damageRoll(), { attackType: 'reach' });

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(message.update).toHaveBeenCalled();
	});

	it('refuses a delivery-filtered consumer on a card delivered the other way', async () => {
		const actor = createActor(
			[4, 3, 5],
			[POOL_RULE, consumerRule({ bonusOnAttackDelivery: 'melee' })],
		);
		useActor(actor);
		const message = createMessage([spendEntry()], damageRoll(), { attackType: 'range' });

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a crit-gated offer once the card is no longer a crit', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()], damageRoll(), { isCritical: false });

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a hit-gated offer on a card that missed', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule({ cardOffer: 'hit' })]);
		useActor(actor);
		const message = createMessage([spendEntry()], damageRoll(), {
			isCritical: false,
			isMiss: true,
		});

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a consumer the live rule no longer offers on the card', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule({ cardOffer: null })]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a banked reduction, which is not damage on this attack', async () => {
		const actor = createActor(
			[4, 3, 5],
			[POOL_RULE, consumerRule({ effectType: 'damageReduction' })],
		);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a maximize outcome, which produces no damage to fold', async () => {
		const actor = createActor(
			[4, 3, 5],
			[POOL_RULE, consumerRule({ selectionOutcome: 'maximize' })],
		);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('adds a typed bonus as its own damage packet, leaving the attack alone', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule({ damageType: 'radiant' })]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer(
			'spend-1',
			'gm-user',
			selection([4, 3, 5], [0, 2]),
		);

		const payload = message.update.mock.calls[0][0] as {
			rolls: string[];
			system: {
				activation: { effects: Array<{ damageType: string; roll: { total: number } }> };
			};
		};

		const effects = payload.system.activation.effects;
		expect(effects).toHaveLength(2);
		expect(effects[0].roll.total).toBe(8);
		expect(effects[1]).toMatchObject({ damageType: 'radiant', canCrit: false, canMiss: false });
		expect(effects[1].roll.total).toBe(18);
		expect(payload.rolls).toHaveLength(2);
	});

	it('refuses a damage type the system does not recognise, leaving the pool full', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule({ damageType: 'sonic' })]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], [0]));

		expect(actor._item.update).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it('does nothing when no dice were picked', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], []));

		expect(message.update).not.toHaveBeenCalled();
	});
});

/**
 * A reroll resolved on the card rebuilds the damage roll from its original
 * formula, which never carries a spend already folded in. Either the bonus
 * comes across to the new roll or the dice go back — the one thing that must
 * not happen is the player paying for damage the card no longer shows.
 */
describe('resolveForceRerollReaction with a folded card-side spend', () => {
	beforeEach(setupSpendGlobals);

	function rerollEntry() {
		return {
			id: 'reroll-1',
			kind: 'forceReroll',
			source: 'rule',
			actorUuid: 'Actor.cheat',
			tokenUuid: null,
			targetTokenUuid: 'Scene.scene.Token.victim',
			label: 'Pocket Sand',
			ruleId: 'pocket-sand',
			// Empty itemUuid skips the rule-still-enabled revalidation
			itemUuid: '',
			used: false,
			rerollTrigger: 'always',
		};
	}

	function spentEntry(overrides: Record<string, unknown> = {}) {
		return spendEntry({
			used: true,
			usedAmount: 18,
			usedPoolLabel: 'Fury Dice',
			usedFaces: [4, 5],
			...overrides,
		});
	}

	function rerolledRoll(message: MockedMessage) {
		return (
			message.update.mock.calls[0][0] as {
				system: { activation: { effects: Array<{ roll: Record<string, unknown> }> } };
			}
		).system.activation.effects[0].roll;
	}

	function rerolledEntries(message: MockedMessage) {
		return (
			message.update.mock.calls[0][0] as {
				system: { incomingReactions: Array<Record<string, unknown>> };
			}
		).system.incomingReactions;
	}

	it('re-applies a spend the new outcome still satisfies', async () => {
		const actor = createActor([3], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([rerollEntry(), spentEntry({ outcomeTrigger: 'hit' })]);

		await message.resolveForceRerollReaction('reroll-1', 'gm-user');

		// The mock rebuild totals 0, so the whole total is the carried bonus
		const roll = rerolledRoll(message);
		expect(roll.total).toBe(18);
		expect(roll.terms).toContainEqual({
			class: 'NumericTerm',
			number: 18,
			evaluated: true,
			options: { flavor: 'Death Blow: bonus damage' },
		});

		// The node's roll and the message rolls source have to move together
		expect(
			JSON.parse((message.update.mock.calls[0][0] as { rolls: string[] }).rolls[0]).total,
		).toBe(18);

		expect(rerolledEntries(message)[1]).toMatchObject({ used: true, usedAmount: 18 });
		expect(actor._item.update).not.toHaveBeenCalled();
	});

	it('refunds the dice and drops a spend the new outcome no longer satisfies', async () => {
		// The reroll comes back a non-crit, so the crit-only spend was never owed
		const actor = createActor([3], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([rerollEntry(), spentEntry({ outcomeTrigger: 'criticalHit' })]);

		await message.resolveForceRerollReaction('reroll-1', 'gm-user');

		expect(rerolledRoll(message).total).toBe(0);

		const written = actor._item.update.mock.calls[0][0] as Record<string, unknown>;
		const pools = written[`flags.${SYSTEM_ID}.dicePools`] as Record<string, { faces: number[] }>;
		expect(pools.fury.faces).toEqual([3, 4, 5]);

		// Reverted to unused, so the stale-outcome filter takes it off the card
		expect(rerolledEntries(message).map((e) => e.id)).toEqual(['reroll-1']);
	});

	it('leaves a typed spend alone, since its packet survives the reroll', async () => {
		// A typed spend is its own damage node, which the reroll never rebuilds;
		// re-appending it to the primary roll would pay the bonus twice
		const actor = createActor([3], [POOL_RULE, consumerRule({ damageType: 'radiant' })]);
		useActor(actor);
		const message = createMessage([rerollEntry(), spentEntry({ outcomeTrigger: 'hit' })]);

		await message.resolveForceRerollReaction('reroll-1', 'gm-user');

		expect(rerolledRoll(message).total).toBe(0);
		expect(rerolledEntries(message)[1]).toMatchObject({ used: true, usedAmount: 18 });
	});

	it('keeps the bonus when the dice cannot be returned', async () => {
		// No pool to refund into: charging the player and dropping the damage
		// would be the worst of both, so the bonus rides on the new roll
		const actor = createActor([3], [POOL_RULE]);
		useActor(actor);
		const message = createMessage([rerollEntry(), spentEntry({ outcomeTrigger: 'criticalHit' })]);

		await message.resolveForceRerollReaction('reroll-1', 'gm-user');

		expect(rerolledRoll(message).total).toBe(18);
		expect(actor._item.update).not.toHaveBeenCalled();
		expect(rerolledEntries(message)[1]).toMatchObject({ used: true, usedAmount: 18 });
	});
});
