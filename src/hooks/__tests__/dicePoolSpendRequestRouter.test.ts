import { beforeEach, describe, expect, it, vi } from 'vitest';
import { systemHookName } from '#system';
import { pendingSpendRequests } from '#utils/dicePool/pendingSpendRequests.js';
import type { DicePoolSpendRequestPayload } from '#utils/dicePool/types.js';
import registerDicePoolSpendRequestRouter from '../dicePoolSpendRequestRouter.js';

const findRequestedPool = vi.hoisted(() => vi.fn());
vi.mock('#utils/dicePool/findRequestedPool.js', () => ({ findRequestedPool }));

const listeners = new Map<string, (payload: unknown) => void>();

vi.stubGlobal('Hooks', {
	on: vi.fn((hook: string, listener: (payload: unknown) => void) => {
		listeners.set(hook, listener);
		return 1;
	}),
});

const fromUuidSync = vi.fn();
vi.stubGlobal('fromUuidSync', fromUuidSync);

function payload(actorUuid = 'Actor.test-actor'): DicePoolSpendRequestPayload {
	return {
		actorUuid,
		itemId: 'item-tayg',
		ruleId: 'rule-consumer',
		poolIdentifier: 'fury',
		poolScope: 'item',
	};
}

function fireRequest(request: DicePoolSpendRequestPayload): void {
	listeners.get(systemHookName('dicePool.requestSpend'))?.(request);
}

describe('dicePoolSpendRequestRouter', () => {
	beforeEach(() => {
		listeners.clear();
		fromUuidSync.mockReset();
		registerDicePoolSpendRequestRouter();
		// Drain any entry left behind by a previous test.
		pendingSpendRequests.take('Actor.test-actor');
	});

	it('parks the request and opens the sheet when it is closed', () => {
		const render = vi.fn();
		fromUuidSync.mockReturnValue({ sheet: { rendered: false, render } });

		const request = payload();
		fireRequest(request);

		expect(render).toHaveBeenCalledWith(true);
		expect(pendingSpendRequests.take('Actor.test-actor')).toEqual(request);
	});

	it('does nothing when the sheet is already rendered (the mounted tracker handles it)', () => {
		const render = vi.fn();
		fromUuidSync.mockReturnValue({ sheet: { rendered: true, render } });

		fireRequest(payload());

		expect(render).not.toHaveBeenCalled();
		expect(pendingSpendRequests.take('Actor.test-actor')).toBeNull();
	});

	it('ignores requests whose actor cannot be resolved', () => {
		fromUuidSync.mockReturnValue(null);

		expect(() => fireRequest(payload())).not.toThrow();
		expect(pendingSpendRequests.take('Actor.test-actor')).toBeNull();
	});

	it('take() consumes the pending entry', () => {
		fromUuidSync.mockReturnValue({ sheet: { rendered: false, render: vi.fn() } });

		fireRequest(payload());

		expect(pendingSpendRequests.take('Actor.test-actor')).not.toBeNull();
		expect(pendingSpendRequests.take('Actor.test-actor')).toBeNull();
	});

	describe('the new character sheet', () => {
		it('opens the choice step of the feature row on the Actions tab', () => {
			const reveal = vi.fn();
			fromUuidSync.mockReturnValue({ sheet: { reveal, rendered: false, render: vi.fn() } });
			findRequestedPool.mockReturnValueOnce({ label: 'Fury Dice', faces: [4] });

			fireRequest(payload());

			expect(reveal).toHaveBeenCalledWith({ tab: 'actions', rowId: 'item-tayg', step: 'choice' });
			expect(pendingSpendRequests.take('Actor.test-actor')).toBeNull();
		});

		it('opens the spell row on the Spells tab, which lists every spell', () => {
			const reveal = vi.fn();
			const items = new Map([['item-tayg', { type: 'spell' }]]);
			fromUuidSync.mockReturnValue({ items, sheet: { reveal, rendered: true, render: vi.fn() } });
			findRequestedPool.mockReturnValueOnce({ label: 'Fury Dice', faces: [4] });

			fireRequest(payload());

			expect(reveal).toHaveBeenCalledWith({ tab: 'spells', rowId: 'item-tayg', step: 'choice' });
		});

		it('shows the empty pool note, and opens nothing', () => {
			const reveal = vi.fn();
			fromUuidSync.mockReturnValue({ sheet: { reveal, rendered: true, render: vi.fn() } });
			findRequestedPool.mockReturnValueOnce({ label: 'Fury Dice', faces: [] });

			fireRequest(payload());

			expect(reveal).not.toHaveBeenCalled();
			expect(ui.notifications?.info).toHaveBeenCalledWith(
				game.i18n.format('NIMBLE.dicePoolTracker.spendRequestEmptyPool', { label: 'Fury Dice' }),
			);
		});
	});
});
