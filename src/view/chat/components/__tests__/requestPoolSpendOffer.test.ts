import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const requestIncomingAttackReaction = vi.fn(async () => undefined);
const dialogOpened = vi.fn();

let requestPoolSpendOffer: typeof import('../requestPoolSpendOffer.js').requestPoolSpendOffer;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/incomingReactions/incomingAttackReactions.js', () => ({
		requestIncomingAttackReaction,
	}));
	vi.doMock('#documents/dialogs/PoolSpendOfferDialog.svelte.ts', () => ({
		default: class {
			promise = Promise.resolve(null);
			constructor() {
				dialogOpened();
			}
			render() {}
		},
	}));
	({ requestPoolSpendOffer } = await import('../requestPoolSpendOffer.js'));
});

const entry = {
	id: 'spend-1',
	kind: 'spendPoolForDamage' as const,
	source: 'rule' as const,
	actorUuid: 'Actor.commander',
	tokenUuid: null,
	targetTokenUuid: null,
	label: 'Heavy Strike',
	ruleId: 'heavy-strike-spend',
	itemUuid: 'Actor.commander.Item.heavy',
	used: false,
};

function itemWith(rule: Record<string, unknown>) {
	(globalThis as unknown as { fromUuidSync: unknown }).fromUuidSync = vi.fn(() => ({
		id: 'heavy',
		rules: new Map([['heavy-strike-spend', { id: 'heavy-strike-spend', ...rule }]]),
	}));
}

describe('a spend offer of the attack card', () => {
	beforeEach(() => vi.clearAllMocks());

	it('spends a charge at once, with no dice to pick', async () => {
		itemWith({ type: 'chargeConsumer' });
		const hold = vi.fn();

		await requestPoolSpendOffer(entry, {
			actor: { items: { contents: [] } } as never,
			label: 'Add Damage: Heavy Strike',
			messageId: 'card-1',
			hold,
		});

		expect(dialogOpened).not.toHaveBeenCalled();
		expect(hold).toHaveBeenCalledWith('spend-1');
		expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
			messageId: 'card-1',
			entryId: 'spend-1',
		});
	});
});
