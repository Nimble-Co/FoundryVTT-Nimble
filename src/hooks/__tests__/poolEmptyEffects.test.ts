import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ruleChargesLeftMock = vi.fn((..._args: unknown[]): number | null => 0);
const applyEffectHereMock = vi.fn(async (..._args: unknown[]) => null);
const payloadFromEffectMock = vi.fn((effect: { toObject(): object }, source: object) => ({
	data: effect.toObject(),
	source,
}));

const ruleAutomationMock = vi.fn(() => true);
const isActiveGMMock = vi.fn(() => true);

let applyPoolEmptyEffects: typeof import('../poolEmptyEffects.js').applyPoolEmptyEffects;
let registerPoolEmptyEffectHooks: typeof import('../poolEmptyEffects.js').registerPoolEmptyEffectHooks;

beforeEach(async () => {
	vi.clearAllMocks();
	ruleChargesLeftMock.mockReturnValue(0);
	ruleAutomationMock.mockReturnValue(true);
	isActiveGMMock.mockReturnValue(true);
	vi.resetModules();
	vi.doMock('../../settings/automationSettings.js', () => ({
		isRuleAutomationEnabled: ruleAutomationMock,
	}));
	vi.doMock('#utils/isActiveGM.js', () => ({ isActiveGM: isActiveGMMock }));
	vi.doMock('#utils/chargePool/ruleChargeGate.js', () => ({
		ruleChargesLeft: ruleChargesLeftMock,
	}));
	vi.doMock('#utils/actor/applyEffectToActor.js', () => ({
		applyEffectHere: applyEffectHereMock,
		payloadFromEffect: payloadFromEffectMock,
	}));
	({ applyPoolEmptyEffects, registerPoolEmptyEffectHooks } = await import(
		'../poolEmptyEffects.js'
	));
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

	it('does not apply anything when rule automation is off', async () => {
		ruleAutomationMock.mockReturnValue(false);

		await applyPoolEmptyEffects(owner([poolEmptyRule()]));

		expect(ruleChargesLeftMock).not.toHaveBeenCalled();
		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('ignores rules of other types', async () => {
		await applyPoolEmptyEffects(owner([{ type: 'speedBonus', isLive: () => true }]));

		expect(ruleChargesLeftMock).not.toHaveBeenCalled();
		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});
});

describe('registerPoolEmptyEffectHooks', () => {
	const globals = globalThis as unknown as Record<string, any>;
	type Handler = (document: unknown) => void;
	let handlers: Map<string, Handler>;
	let saved: { Hooks: unknown; combat: unknown };

	beforeEach(() => {
		saved = { Hooks: globals.Hooks, combat: globals.game.combat };
		handlers = new Map();
		globals.Hooks = {
			...globals.Hooks,
			on: vi.fn((name: string, handler: Handler) => handlers.set(name, handler)),
		};
		registerPoolEmptyEffectHooks();
	});

	afterEach(() => {
		globals.Hooks = saved.Hooks;
		globals.game.combat = saved.combat;
	});

	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	function onTurnOf(uuid: string) {
		globals.game.combat = { started: true, combatant: { actor: { uuid } } };
	}

	it('checks the actor of the combatant at the start of its turn on the active GM', async () => {
		const actor = owner([poolEmptyRule()]);

		handlers.get('nimbleCombatTurnStart')?.({ actor });
		await flush();

		expect(applyEffectHereMock).toHaveBeenCalledTimes(1);
	});

	it('does not check at the start of a turn on a user who is not the active GM', async () => {
		isActiveGMMock.mockReturnValue(false);

		handlers.get('nimbleCombatTurnStart')?.({ actor: owner([poolEmptyRule()]) });
		await flush();

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('checks an updated actor on its own turn', async () => {
		onTurnOf('Actor.a');

		handlers.get('updateActor')?.(owner([poolEmptyRule()]));
		await flush();

		expect(applyEffectHereMock).toHaveBeenCalledTimes(1);
	});

	it('does not check an updated actor on the turn of another creature', async () => {
		onTurnOf('Actor.other');

		handlers.get('updateActor')?.(owner([poolEmptyRule()]));
		await flush();

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('does not check an updated actor on a user who is not the active GM', async () => {
		onTurnOf('Actor.a');
		isActiveGMMock.mockReturnValue(false);

		handlers.get('updateActor')?.(owner([poolEmptyRule()]));
		await flush();

		expect(applyEffectHereMock).not.toHaveBeenCalled();
	});

	it('checks the owner of an updated item on its own turn, and not on another turn', async () => {
		const actor = owner([poolEmptyRule()]);
		onTurnOf('Actor.a');
		handlers.get('updateItem')?.({ parent: actor });
		await flush();
		onTurnOf('Actor.other');
		handlers.get('updateItem')?.({ parent: actor });
		await flush();

		expect(applyEffectHereMock).toHaveBeenCalledTimes(1);
	});
});
