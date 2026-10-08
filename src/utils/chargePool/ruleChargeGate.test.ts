import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasRuleCharge, spendRuleCharge, withRuleCharge } from './ruleChargeGate.js';

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
		update: vi.fn(async (_changes: Record<string, unknown>) => undefined),
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

/** An item-scoped pool whose update lands a moment later, as a server answer does. */
function makeServerActor(current: number) {
	const { actor, item } = makeActor(current);
	item.update.mockImplementation(async (changes: Record<string, unknown>) => {
		await new Promise((resolve) => setTimeout(resolve, 5));
		const pools = changes['flags.nimble.chargePools'] as Record<string, { current: number }>;
		const stored = (item.flags as { nimble: { chargePools: Record<string, { current: number }> } })
			.nimble.chargePools;
		stored.thrill = { ...stored.thrill, current: pools.thrill.current };
		return undefined;
	});
	return { actor, item };
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

	describe('withRuleCharge', () => {
		const card = { id: 'card' };

		it('two calls started in the same tick with one charge post one card', async () => {
			const { actor, item } = makeServerActor(1);
			const post = vi.fn(async () => card);
			await Promise.all([
				withRuleCharge(actor, 'thrill', post),
				withRuleCharge(actor, 'thrill', post),
			]);
			expect(post).toHaveBeenCalledTimes(1);
			expect(item.update).toHaveBeenCalledTimes(1);
			expect(hasRuleCharge(actor, 'thrill')).toBe(false);
		});

		it('with two charges, both calls post and each spends one', async () => {
			const { actor } = makeServerActor(2);
			const post = vi.fn(async () => card);
			await Promise.all([
				withRuleCharge(actor, 'thrill', post),
				withRuleCharge(actor, 'thrill', post),
			]);
			expect(post).toHaveBeenCalledTimes(2);
			expect(hasRuleCharge(actor, 'thrill')).toBe(false);
		});

		it('a post that makes no card spends nothing, and the next call may still post', async () => {
			const { actor, item } = makeServerActor(1);
			const post = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(card);
			await Promise.all([
				withRuleCharge(actor, 'thrill', post),
				withRuleCharge(actor, 'thrill', post),
			]);
			expect(post).toHaveBeenCalledTimes(2);
			expect(item.update).toHaveBeenCalledTimes(1);
		});

		it('the chain continues after a post throws, and the throw reaches the caller', async () => {
			const { actor, item } = makeServerActor(1);
			const failure = new Error('failed');
			const post = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(card);
			const first = withRuleCharge(actor, 'thrill', post);
			const second = withRuleCharge(actor, 'thrill', post);
			await expect(first).rejects.toBe(failure);
			await second;
			expect(post).toHaveBeenCalledTimes(2);
			expect(item.update).toHaveBeenCalledTimes(1);
		});

		it('does not post on an empty pool or for an actor that is not a character', async () => {
			const post = vi.fn(async () => card);
			await withRuleCharge(makeActor(0).actor, 'thrill', post);
			await withRuleCharge(makeActor(2, { type: 'npc' }).actor, 'thrill', post);
			await withRuleCharge(null, 'thrill', post);
			expect(post).not.toHaveBeenCalled();
		});

		it('another actor does not wait for a post that is still running', async () => {
			let finish!: () => void;
			const slow = vi.fn(() => new Promise((resolve) => (finish = () => resolve(card))));
			const fast = vi.fn(async () => card);
			const first = withRuleCharge(makeServerActor(1).actor, 'thrill', slow);
			await withRuleCharge(makeServerActor(1).actor, 'thrill', fast);
			expect(fast).toHaveBeenCalledTimes(1);
			finish();
			await first;
		});

		it('an empty identifier is unlimited and spends nothing', async () => {
			const { actor, item } = makeActor(0);
			const post = vi.fn(async () => card);
			await Promise.all([withRuleCharge(actor, '', post), withRuleCharge(actor, ' ', post)]);
			expect(post).toHaveBeenCalledTimes(2);
			expect(item.update).not.toHaveBeenCalled();
		});

		it('with resource spending automation off, the pool is no limit and is not spent', async () => {
			setSpendingAutomation(false);
			const { actor, item } = makeActor(0);
			const post = vi.fn(async () => card);
			await withRuleCharge(actor, 'thrill', post);
			expect(post).toHaveBeenCalledTimes(1);
			expect(item.update).not.toHaveBeenCalled();
		});
	});

	it('with resource spending automation off, the pool neither gates nor is spent', async () => {
		setSpendingAutomation(false);
		const { actor, item } = makeActor(0);
		expect(hasRuleCharge(actor, 'thrill')).toBe(true);
		await spendRuleCharge(actor, 'thrill');
		expect(item.update).not.toHaveBeenCalled();
	});
});
