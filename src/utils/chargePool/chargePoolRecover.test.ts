import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	adjustPool,
	applyRecoveryToActorIfEligible,
	applyRestRecovery,
} from './chargePoolRecover.js';
import type { CharacterActorLike } from './types.js';

// A character actor carrying a chargePool rule whose pool refreshes on a safe
// rest, so a rest recovery would persist a refilled pool to the owning item.
function makePoolActorWithRestRecovery() {
	const item = {
		id: 'item-1',
		name: 'Wand of Charges',
		flags: {},
		rules: new Map([
			[
				'rule-1',
				{
					type: 'chargePool',
					disabled: false,
					id: 'charges',
					identifier: 'charges',
					scope: 'item',
					max: '3',
					initial: 'zero',
					recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '0' }],
				},
			],
		]),
		update: vi.fn(async () => undefined),
	};
	const actor = {
		type: 'character',
		getRollData: vi.fn(() => ({})),
		items: { contents: [item] },
		update: vi.fn(async () => undefined),
	} as unknown as CharacterActorLike;
	return { actor, item };
}

function setRecoveryAutomation(enabled: boolean): void {
	vi.stubGlobal('game', { settings: { get: () => enabled } });
}

describe('charge pool recovery automation gate', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('recovers pools on rest when resource-recovery automation is on', async () => {
		setRecoveryAutomation(true);
		const { actor, item } = makePoolActorWithRestRecovery();

		await applyRestRecovery(actor as unknown as Actor, 'safe');

		expect(item.update).toHaveBeenCalledTimes(1);
	});

	it('does nothing on rest when resource-recovery automation is off', async () => {
		setRecoveryAutomation(false);
		const { actor, item } = makePoolActorWithRestRecovery();

		await applyRestRecovery(actor as unknown as Actor, 'safe');

		expect(item.update).not.toHaveBeenCalled();
	});

	it('skips trigger-based recovery when resource-recovery automation is off', async () => {
		setRecoveryAutomation(false);
		const { actor, item } = makePoolActorWithRestRecovery();

		await applyRecoveryToActorIfEligible(actor as unknown as Actor, 'onTurnStart');

		expect(item.update).not.toHaveBeenCalled();
	});
});

// The write path behind a manual correction: the charges dialog and the sheet
// header's resource bar both set a pool's current value through `adjustPool`.
describe('adjustPool, the manual correction path', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function makeActorWithPool(current: number) {
		const item = {
			id: 'item-1',
			name: 'Pilfered Power',
			flags: { nimble: { chargePools: { charges: { current, max: 3 } } } },
			rules: new Map([
				[
					'rule-1',
					{
						type: 'chargePool',
						disabled: false,
						id: 'charges',
						identifier: 'charges',
						scope: 'item',
						max: '3',
						initial: 'max',
						recoveries: [],
					},
				],
			]),
			update: vi.fn(async () => undefined),
		};
		const actor = {
			type: 'character',
			getRollData: vi.fn(() => ({})),
			items: { contents: [item], get: (id: string) => (id === item.id ? item : undefined) },
			update: vi.fn(async () => undefined),
		} as unknown as CharacterActorLike;
		return { actor, item };
	}

	it('sets the pool to the value the player typed', async () => {
		setRecoveryAutomation(true);
		const { actor, item } = makeActorWithPool(3);

		await expect(adjustPool(actor, 'charges', 'set', 1)).resolves.toBe(true);

		expect(item.update).toHaveBeenCalled();
	});

	it('never sets a pool above its maximum', async () => {
		setRecoveryAutomation(true);
		const { actor, item } = makeActorWithPool(1);

		await adjustPool(actor, 'charges', 'set', 99);

		const written = JSON.stringify(item.update.mock.calls.at(-1));
		expect(written).toContain('"current":3');
	});

	it('never sets a pool below zero', async () => {
		setRecoveryAutomation(true);
		const { actor, item } = makeActorWithPool(2);

		await adjustPool(actor, 'charges', 'set', -5);

		const written = JSON.stringify(item.update.mock.calls.at(-1));
		expect(written).toContain('"current":0');
	});

	it('refuses a pool identifier the actor does not have', async () => {
		setRecoveryAutomation(true);
		const { actor, item } = makeActorWithPool(2);

		await expect(adjustPool(actor, 'not-a-pool', 'set', 1)).resolves.toBe(false);

		expect(item.update).not.toHaveBeenCalled();
	});
});
