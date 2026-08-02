import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyRecoveryToActorIfEligible, applyRestRecovery } from './chargePoolRecover.js';
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
