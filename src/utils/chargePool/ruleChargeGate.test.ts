import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasRuleCharge, spendRuleCharge } from './ruleChargeGate.js';

function makeActor(current: number, { type = 'character', scope = 'item' } = {}) {
	const poolKey = scope === 'actor' ? 'actor:thrill' : 'thrill';
	const item = {
		id: 'item-1',
		name: 'Thrill',
		flags: scope === 'item' ? { nimble: { chargePools: { thrill: { current, max: 2 } } } } : {},
		rules: new Map([
			[
				'rule-1',
				{
					type: 'chargePool',
					disabled: false,
					id: 'thrill',
					identifier: 'thrill',
					scope,
					max: '2',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
		update: vi.fn(async () => undefined),
	};
	const actor = {
		type,
		flags:
			scope === 'actor'
				? {
						nimble: {
							chargePools: {
								[poolKey]: { identifier: 'thrill', current, max: 2, seeded: true },
							},
						},
					}
				: {},
		getRollData: vi.fn(() => ({})),
		items: { contents: [item], get: (id: string) => (id === item.id ? item : undefined) },
		update: vi.fn(async () => undefined),
	};
	return { actor: actor as unknown as Actor, item };
}

function setSpendingAutomation(enabled: boolean): void {
	vi.stubGlobal('game', { settings: { get: () => enabled } });
}

describe('ruleChargeGate', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('an empty identifier is unlimited and spends nothing', async () => {
		const { actor, item } = makeActor(0);
		expect(hasRuleCharge(actor, '')).toBe(true);
		await spendRuleCharge(actor, '  ');
		expect(item.update).not.toHaveBeenCalled();
	});

	it('passes while the pool has a charge and fails when it is empty', () => {
		expect(hasRuleCharge(makeActor(1).actor, 'thrill')).toBe(true);
		expect(hasRuleCharge(makeActor(0).actor, 'thrill')).toBe(false);
	});

	it('fails for a pool the actor does not have', () => {
		expect(hasRuleCharge(makeActor(2).actor, 'fury')).toBe(false);
	});

	it('fails for an actor that is not a character', () => {
		expect(hasRuleCharge(makeActor(2, { type: 'npc' }).actor, 'thrill')).toBe(false);
	});

	it('spends one charge from an item-scoped pool', async () => {
		const { actor, item } = makeActor(2);
		await spendRuleCharge(actor, 'thrill');
		expect(item.update).toHaveBeenCalledWith(
			{ 'flags.nimble.chargePools': { thrill: expect.objectContaining({ current: 1 }) } },
			expect.anything(),
		);
	});

	it('spends one charge from an actor-scoped pool', async () => {
		const { actor } = makeActor(2, { scope: 'actor' });
		await spendRuleCharge(actor, 'thrill');
		const update = (actor as unknown as { update: ReturnType<typeof vi.fn> }).update;
		expect(update).toHaveBeenCalledWith(
			{ 'flags.nimble.chargePools': { 'actor:thrill': expect.objectContaining({ current: 1 }) } },
			expect.anything(),
		);
	});

	it('with resource spending automation off, the pool neither gates nor is spent', async () => {
		setSpendingAutomation(false);
		const { actor, item } = makeActor(0);
		expect(hasRuleCharge(actor, 'thrill')).toBe(true);
		await spendRuleCharge(actor, 'thrill');
		expect(item.update).not.toHaveBeenCalled();
	});
});
