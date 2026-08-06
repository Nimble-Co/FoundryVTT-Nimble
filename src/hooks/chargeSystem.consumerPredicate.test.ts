import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';

// chargePoolConsume is deliberately NOT mocked here: this file asserts the real
// validation path, so that a consumer which predicates itself out never aborts
// the activation.
const { applyEncounterRecoveryMock, applyRestRecoveryMock, syncActorPoolsMock } = vi.hoisted(
	() => ({
		applyEncounterRecoveryMock: vi.fn(async () => undefined),
		applyRestRecoveryMock: vi.fn(async () => undefined),
		syncActorPoolsMock: vi.fn(async () => undefined),
	}),
);

vi.mock('#utils/chargePool/chargePoolRecover.js', () => ({
	applyRestRecovery: applyRestRecoveryMock,
	applyEncounterRecovery: applyEncounterRecoveryMock,
}));

vi.mock('#utils/chargePool/chargePoolSync.js', () => ({
	isChargePoolFlagUpdate: vi.fn(() => false),
	syncActorPools: syncActorPoolsMock,
}));

vi.mock('#utils/localize.js', () => ({
	default: (key: string) => key,
}));

type HookCallback = (...args: unknown[]) => unknown;

function captureHooks(): Map<string, HookCallback> {
	const hooks = new Map<string, HookCallback>();
	(globalThis as unknown as { Hooks: { on: ReturnType<typeof vi.fn> } }).Hooks = {
		on: vi.fn((event: string, callback: HookCallback) => {
			hooks.set(event, callback);
			return 1;
		}),
	};
	return hooks;
}

/**
 * An item carrying an empty charge pool plus a consumer for it. `consumerApplies`
 * models the consumer's own predicate.
 */
function createItemWithEmptyPool(consumerApplies: boolean): unknown {
	const item = {
		id: 'item-1',
		name: 'Charged Feature',
		flags: {
			[ChargePoolRuleConfig.flagScope]: {
				[ChargePoolRuleConfig.flagKey]: {
					focus: {
						identifier: 'focus',
						current: 0,
						max: 1,
					},
				},
			},
		},
		rules: new Map<string, Record<string, unknown>>([
			[
				'pool',
				{
					type: 'chargePool',
					id: 'pool-rule',
					identifier: 'focus',
					scope: 'item',
					max: '1',
					initial: 'max',
				},
			],
			[
				'consumer',
				{
					type: 'chargeConsumer',
					id: 'consumer-rule',
					poolIdentifier: 'focus',
					poolScope: 'item',
					cost: '1',
					appliesTo: () => consumerApplies,
				},
			],
		]),
		actor: null as unknown,
	};

	item.actor = {
		type: 'character',
		system: { levelUpHistory: [] },
		flags: {},
		items: { contents: [item] },
		getRollData: () => ({}),
	};

	return item;
}

describe('preUseItem with a predicated charge consumer', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		(globalThis as unknown as { ui: { notifications: { error: ReturnType<typeof vi.fn> } } }).ui = {
			notifications: { error: vi.fn() },
		};
		(globalThis as unknown as { game: Record<string, unknown> }).game = {
			combat: null,
			settings: { get: vi.fn(() => true) },
		};
	});

	it('does not abort the activation when the only consumer predicates itself out', async () => {
		const hooks = captureHooks();
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const item = createItemWithEmptyPool(false);
		expect(hooks.get('nimble.preUseItem')?.(item)).toBe(true);
		expect(ui.notifications?.error).not.toHaveBeenCalled();
	});

	it('still aborts the activation when the consumer applies and the pool is empty', async () => {
		const hooks = captureHooks();
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const item = createItemWithEmptyPool(true);
		expect(hooks.get('nimble.preUseItem')?.(item)).toBe(false);
		expect(ui.notifications?.error).toHaveBeenCalledTimes(1);
	});
});
