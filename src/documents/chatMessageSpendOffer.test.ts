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
) {
	const message = new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: ['Scene.scene.Token.victim'],
			isCritical: true,
			isMiss: false,
			activation: {
				effects: roll
					? [{ id: 'damage-node', type: 'damage', parentNode: null, parentContext: null, roll }]
					: [],
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

describe('resolveSpendPoolForDamageOffer', () => {
	const globals = globalThis as unknown as Record<string, unknown>;

	// The shared Roll mock only resolves a formula in `evaluateSync`; the
	// executor evaluates asynchronously, so borrow the sync parser for it.
	const BaseRoll = globals.Roll as new (
		formula: string,
		data?: unknown,
	) => { evaluateSync: () => unknown };

	beforeEach(() => {
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
	});

	function useActor(actor: ReturnType<typeof createActor>) {
		globals.fromUuidSync = vi.fn(() => actor);
	}

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

	it('does nothing when no dice were picked', async () => {
		const actor = createActor([4, 3, 5], [POOL_RULE, consumerRule()]);
		useActor(actor);
		const message = createMessage([spendEntry()]);

		await message.resolveSpendPoolForDamageOffer('spend-1', 'gm-user', selection([4, 3, 5], []));

		expect(message.update).not.toHaveBeenCalled();
	});
});
