import { beforeEach, describe, expect, it, vi } from 'vitest';

const ruleChargesLeftMock = vi.fn((..._args: unknown[]): number | null => 0);
const applyEffectHereMock = vi.fn(async (..._args: unknown[]) => null);
const payloadFromEffectMock = vi.fn((effect: { toObject(): object }, source: object) => ({
	data: effect.toObject(),
	source,
}));

let applyPoolEmptyEffects: typeof import('../poolEmptyEffects.js').applyPoolEmptyEffects;

beforeEach(async () => {
	vi.clearAllMocks();
	ruleChargesLeftMock.mockReturnValue(0);
	vi.resetModules();
	vi.doMock('#utils/chargePool/ruleChargeGate.js', () => ({
		ruleChargesLeft: ruleChargesLeftMock,
	}));
	vi.doMock('#utils/actor/applyEffectToActor.js', () => ({
		applyEffectHere: applyEffectHereMock,
		payloadFromEffect: payloadFromEffectMock,
	}));
	({ applyPoolEmptyEffects } = await import('../poolEmptyEffects.js'));
});

const ITEM_UUID = 'Actor.a.Item.armor';

function itemEffect(transfer: boolean, name: string) {
	return { transfer, toObject: () => ({ name }) };
}

function poolItem() {
	return {
		uuid: ITEM_UUID,
		effects: [itemEffect(true, 'Passive'), itemEffect(false, 'Exposed')],
	};
}

function poolEmptyRule(fields: Record<string, unknown> = {}) {
	return {
		type: 'poolEmptyEffect',
		chargePoolIdentifier: 'plating',
		item: poolItem(),
		isLive: () => true,
		...fields,
	};
}

function owner(rules: unknown[], effects: { origin?: string | null }[] = []) {
	return { uuid: 'Actor.a', rules, effects };
}

describe('applyPoolEmptyEffects', () => {
	it("applies the item's effect that stays on the item when the pool has no charges", async () => {
		const actor = owner([poolEmptyRule()]);

		await applyPoolEmptyEffects(actor);

		expect(ruleChargesLeftMock).toHaveBeenCalledWith(actor, 'plating');
		expect(applyEffectHereMock).toHaveBeenCalledTimes(1);
		expect(applyEffectHereMock).toHaveBeenCalledWith(actor, {
			data: { name: 'Exposed' },
			source: { itemUuid: ITEM_UUID, user: null },
		});
	});

	it('applies the effect once when two checks start at the same time', async () => {
		const effects: { origin?: string | null }[] = [];
		const actor = owner([poolEmptyRule()], effects);
		applyEffectHereMock.mockImplementationOnce(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			effects.push({ origin: ITEM_UUID });
			return null;
		});

		await Promise.all([applyPoolEmptyEffects(actor), applyPoolEmptyEffects(actor)]);

		expect(applyEffectHereMock).toHaveBeenCalledTimes(1);
	});

	it('does not apply the effect when the pool has charges', async () => {
		ruleChargesLeftMock.mockReturnValue(2);

		await applyPoolEmptyEffects(owner([poolEmptyRule()]));

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect when the pool is not found', async () => {
		ruleChargesLeftMock.mockReturnValue(null);

		await applyPoolEmptyEffects(owner([poolEmptyRule()]));

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('does not apply the effect again when the actor has an effect from the item', async () => {
		await applyPoolEmptyEffects(owner([poolEmptyRule()], [{ origin: ITEM_UUID }]));

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('applies the effect when the actor has effects from other items only', async () => {
		await applyPoolEmptyEffects(owner([poolEmptyRule()], [{ origin: 'Actor.a.Item.other' }]));

		expect(applyEffectHereMock).toHaveBeenCalledTimes(1);
	});

	it('does not apply the effect when the rule is not live', async () => {
		await applyPoolEmptyEffects(owner([poolEmptyRule({ isLive: () => false })]));

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('does not apply anything when the item has no effect that stays on it', async () => {
		const item = { uuid: ITEM_UUID, effects: [itemEffect(true, 'Passive')] };

		await applyPoolEmptyEffects(owner([poolEmptyRule({ item })]));

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('ignores rules of other types', async () => {
		await applyPoolEmptyEffects(owner([{ type: 'speedBonus', isLive: () => true }]));

		expect(ruleChargesLeftMock).not.toHaveBeenCalled();
		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});
});
