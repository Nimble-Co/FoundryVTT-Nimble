import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import {
	applyRerollRecoveryChange,
	rerollChargeConsumption,
	rerollRecoveryChange,
} from '../chargePoolReroll.js';
import type { ChargeConsumptionDetail, ChargePoolMap, ChargeRecoveryGiven } from '../types.js';

type Outcome = 'miss' | 'hit' | 'crit';

function view(outcome: Outcome) {
	return { isCritical: outcome === 'crit', isMiss: outcome === 'miss' };
}

describe('rerollRecoveryChange', () => {
	// [previous, next, critStillCounts, takeBack, give]
	const table: Array<[Outcome, Outcome, boolean, string[], string[]]> = [
		['miss', 'miss', false, [], []],
		['miss', 'hit', false, [], ['onHit']],
		['miss', 'crit', false, [], ['onHit', 'onCriticalHit']],
		['hit', 'miss', false, ['onHit'], []],
		['hit', 'hit', false, [], []],
		['hit', 'crit', false, [], ['onCriticalHit']],
		['crit', 'miss', false, ['onHit', 'onCriticalHit'], []],
		['crit', 'hit', false, ['onCriticalHit'], []],
		['crit', 'crit', false, [], []],
		['miss', 'miss', true, [], []],
		['miss', 'hit', true, [], []],
		['miss', 'crit', true, [], []],
		['hit', 'miss', true, [], []],
		['hit', 'hit', true, [], []],
		['hit', 'crit', true, [], []],
		['crit', 'miss', true, [], []],
		['crit', 'hit', true, [], []],
		['crit', 'crit', true, [], []],
	];

	it.each(table)(
		'%s to %s with the crit still counting %s',
		(previous, next, critStillCounts, takeBack, give) => {
			expect(rerollRecoveryChange(view(previous), view(next), critStillCounts)).toEqual({
				takeBack,
				give,
			});
		},
	);
});

type PoolFlags = { nimble: { chargePools: Record<string, Record<string, unknown>> } };

function createActor(params: {
	current: number;
	max?: number;
	recoveries: Array<Record<string, unknown>>;
}) {
	const max = params.max ?? 5;
	const poolRule = {
		type: 'chargePool',
		id: 'pool-rule',
		identifier: 'focus',
		scope: 'actor',
		max: String(max),
		initial: 'max',
		recoveries: params.recoveries,
	};
	const flags: PoolFlags = {
		nimble: {
			chargePools: {
				'actor:focus': {
					id: 'actor:focus',
					identifier: 'focus',
					scope: 'actor',
					sourceItemId: 'feature-1',
					sourceItemName: 'Focus',
					label: 'Focus',
					current: params.current,
					max,
					seeded: true,
					recoveries: params.recoveries,
				},
			},
		},
	};
	const actor = {
		type: 'character' as const,
		flags,
		items: { contents: [] as unknown[], get: () => undefined },
		getRollData: () => ({}),
		getDomain: () => new Set<string>(),
		getFlag: (scope: string, key: string) =>
			scope === ChargePoolRuleConfig.flagScope && key === ChargePoolRuleConfig.flagKey
				? flags.nimble.chargePools
				: undefined,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const payload = (foundry.utils.getProperty(changes, ChargePoolRuleConfig.flagPath) ??
				changes[ChargePoolRuleConfig.flagPath]) as Record<string, Record<string, unknown>>;
			Object.assign(flags.nimble.chargePools, payload);
			return actor;
		}),
	};
	actor.items.contents = [
		{
			id: 'feature-1',
			name: 'Focus',
			actor,
			rules: new Map([['0', poolRule]]),
			flags: { nimble: { chargePools: {} } },
			update: vi.fn(async () => ({})),
		},
	];
	return actor;
}

function current(actor: ReturnType<typeof createActor>): number {
	return actor.flags.nimble.chargePools['actor:focus'].current as number;
}

const settingsGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
};

const CRIT_ADD_ONE = [{ trigger: 'onCriticalHit', mode: 'add', value: '1' }];

describe('applyRerollRecoveryChange', () => {
	let toggles: Record<string, boolean>;

	beforeEach(() => {
		toggles = {};
		settingsGlobals.game.settings = { get: (_scope, key) => toggles[key] ?? true };
	});

	afterEach(() => {
		delete settingsGlobals.game.settings;
	});

	it('takes back what the discarded crit gave', async () => {
		const actor = createActor({ current: 1, recoveries: CRIT_ADD_ONE });
		const given: ChargeRecoveryGiven = [
			{ poolId: 'actor:focus', trigger: 'onCriticalHit', change: 1 },
		];

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: ['onCriticalHit'], give: [] },
			given,
		);

		expect(current(actor)).toBe(0);
		expect(next?.given).toEqual([]);
	});

	it('gives what the new crit earns and records it', async () => {
		const actor = createActor({ current: 1, recoveries: CRIT_ADD_ONE });

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: [], give: ['onCriticalHit'] },
			[],
		);

		expect(current(actor)).toBe(2);
		expect(next?.given).toEqual([{ poolId: 'actor:focus', trigger: 'onCriticalHit', change: 1 }]);
		expect(next?.pools['actor:focus'].current).toBe(2);
	});

	it('takes back nothing the crit did not give, as on a full pool', async () => {
		const actor = createActor({ current: 5, recoveries: CRIT_ADD_ONE });

		await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: ['onCriticalHit'], give: [] },
			[],
		);

		expect(current(actor)).toBe(5);
	});

	it('takes back only what is left when the pool was spent since', async () => {
		const actor = createActor({
			current: 1,
			recoveries: [{ trigger: 'onCriticalHit', mode: 'add', value: '3' }],
		});

		await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: ['onCriticalHit'], give: [] },
			[{ poolId: 'actor:focus', trigger: 'onCriticalHit', change: 3 }],
		);

		expect(current(actor)).toBe(0);
	});

	it('gives no more than the pool maximum', async () => {
		const actor = createActor({
			current: 4,
			recoveries: [{ trigger: 'onHit', mode: 'add', value: '3' }],
		});

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: [], give: ['onHit'] },
			[],
		);

		expect(current(actor)).toBe(5);
		expect(next?.given).toEqual([{ poolId: 'actor:focus', trigger: 'onHit', change: 1 }]);
	});

	it('keeps what an outcome that still stands gave', async () => {
		const actor = createActor({
			current: 3,
			recoveries: [
				{ trigger: 'onHit', mode: 'add', value: '1' },
				{ trigger: 'onCriticalHit', mode: 'add', value: '1' },
			],
		});

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: ['onCriticalHit'], give: [] },
			[
				{ poolId: 'actor:focus', trigger: 'onHit', change: 1 },
				{ poolId: 'actor:focus', trigger: 'onCriticalHit', change: 1 },
			],
		);

		expect(current(actor)).toBe(2);
		expect(next?.given).toEqual([{ poolId: 'actor:focus', trigger: 'onHit', change: 1 }]);
	});

	it('gives nothing when the recovery predicate fails', async () => {
		const actor = createActor({
			current: 1,
			recoveries: [
				{ trigger: 'onCriticalHit', mode: 'add', value: '1', predicate: { self: 'raging' } },
			],
		});

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: [], give: ['onCriticalHit'] },
			[],
		);

		expect(current(actor)).toBe(1);
		expect(next?.given).toEqual([]);
	});

	it('does nothing with resource spending automation off', async () => {
		toggles['automation.resourceSpending'] = false;
		const actor = createActor({ current: 1, recoveries: CRIT_ADD_ONE });

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: [], give: ['onCriticalHit'] },
			[],
		);

		expect(next).toBeNull();
		expect(current(actor)).toBe(1);
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does nothing when no trigger changed', async () => {
		const actor = createActor({ current: 1, recoveries: CRIT_ADD_ONE });

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: [], give: [] },
			[],
		);

		expect(next).toBeNull();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does nothing for an actor that is not a character', async () => {
		const actor = { ...createActor({ current: 1, recoveries: CRIT_ADD_ONE }), type: 'npc' };

		const next = await applyRerollRecoveryChange(
			actor as unknown as Actor,
			{ takeBack: [], give: ['onCriticalHit'] },
			[],
		);

		expect(next).toBeNull();
	});
});

describe('rerollChargeConsumption', () => {
	function pool(id: string, label: string, current: number) {
		return { id, label, current, max: 5 };
	}

	const POOLS = {
		'actor:focus': pool('actor:focus', 'Focus', 3),
		'actor:fury': pool('actor:fury', 'Fury', 3),
		'actor:twin-a': pool('actor:twin-a', 'Twin', 1),
		'actor:twin-b': pool('actor:twin-b', 'Twin', 1),
	} as unknown as ChargePoolMap;

	function line(
		values: Partial<ChargeConsumptionDetail> & { recovery?: ChargeConsumptionDetail['recovery'] },
	): ChargeConsumptionDetail {
		return {
			poolId: 'actor:focus',
			poolLabel: 'Focus',
			previousValue: 3,
			currentValue: 2,
			maxValue: 5,
			change: -1,
			...values,
		};
	}

	const hit = (change: number, poolId = 'actor:focus') =>
		({ poolId, trigger: 'onHit', change }) as const;
	const crit = (change: number, poolId = 'actor:focus') =>
		({ poolId, trigger: 'onCriticalHit', change }) as const;
	const refillOnly = { previousValue: 2, currentValue: 2, change: 0 };

	// [case, card lines, record after the reroll, lines expected]
	const table: Array<
		[string, ChargeConsumptionDetail[], ChargeRecoveryGiven, ChargeConsumptionDetail[]]
	> = [
		['spend only', [line({})], [], [line({})]],
		[
			'refill only, raised by a crit',
			[line({ ...refillOnly, recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 } })],
			[hit(1), crit(1)],
			[
				line({
					...refillOnly,
					recovery: { trigger: 'onCriticalHit', previousValue: 2, newValue: 4 },
				}),
			],
		],
		[
			'spend plus refill, crit taken back',
			[line({ recovery: { trigger: 'onCriticalHit', previousValue: 2, newValue: 4 } })],
			[hit(1)],
			[line({ recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 } })],
		],
		[
			'spend plus refill, refill taken back to 0',
			[line({ recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 } })],
			[],
			[line({})],
		],
		[
			'refill only, taken back to 0',
			[line({ ...refillOnly, recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 } })],
			[],
			[],
		],
		[
			'refill added to a pool with no line',
			[line({})],
			[crit(1, 'actor:fury')],
			[
				line({}),
				{
					poolId: 'actor:fury',
					poolLabel: 'Fury',
					previousValue: 2,
					currentValue: 2,
					maxValue: 5,
					change: 0,
					recovery: { trigger: 'onCriticalHit', previousValue: 2, newValue: 3 },
				},
			],
		],
		[
			'refill added to the last line of a pool spent in the dialog',
			[line({}), line({ previousValue: 2, currentValue: 1 })],
			[hit(1)],
			[
				line({}),
				line({
					previousValue: 2,
					currentValue: 1,
					recovery: { trigger: 'onHit', previousValue: 1, newValue: 2 },
				}),
			],
		],
		[
			'old line without a pool id matches by label',
			[line({ poolId: undefined, recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 } })],
			[],
			[line({ poolId: undefined })],
		],
		[
			'old line with no matching label is left alone',
			[
				line({
					poolId: undefined,
					poolLabel: 'Gone',
					recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 },
				}),
			],
			[],
			[
				line({
					poolId: undefined,
					poolLabel: 'Gone',
					recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 },
				}),
			],
		],
		[
			'old line whose label two pools share is left alone',
			[
				line({
					poolId: undefined,
					poolLabel: 'Twin',
					recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 },
				}),
			],
			[],
			[
				line({
					poolId: undefined,
					poolLabel: 'Twin',
					recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 },
				}),
			],
		],
	];

	it.each(table)('%s', (_case, consumption, given, expected) => {
		const before = structuredClone(consumption);

		expect(rerollChargeConsumption(consumption, given, POOLS)).toEqual(expected);
		expect(consumption).toEqual(before);
	});
});
