import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#utils/chaos/invokeChaos.js', () => ({
	CHAOS_INVOKED_FLAG: 'chaosInvoked',
	chooseChaosRoll: vi.fn(async () => {}),
	invokeChaos: vi.fn(async () => {}),
	keepChaosRoll: vi.fn(async () => {}),
}));
vi.mock('#utils/combat/initiativeManaRoll.js', () => ({
	regainInitiativeManaOnCard: vi.fn(async () => {}),
	rerollInitiativeManaDieOnCard: vi.fn(async () => {}),
}));

import { keepChaosRoll } from '#utils/chaos/invokeChaos.js';
import { canActOnCard, registerCardActionQuery, runCardAction } from '../cardActions.js';

type TestGame = { user: object; users: object; messages: object };

describe('card actions', () => {
	const query = vi.fn(async () => true);
	const notifications = { warn: vi.fn() };

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('ui', { notifications });
		(game as unknown as TestGame).user = { isGM: false };
		(game as unknown as TestGame).users = { activeGM: { id: 'gm', query } };
	});
	afterEach(() => vi.unstubAllGlobals());

	it('a player who owns the hero can act on a card a GM wrote', () => {
		const card = { isAuthor: false };

		expect(canActOnCard(card, { isOwner: true })).toBe(true);
		expect(canActOnCard(card, { isOwner: false })).toBe(false);
		expect(canActOnCard({ isAuthor: true }, null)).toBe(true);
	});

	it('runs here for the author of the card', async () => {
		const card = { id: 'card', isAuthor: true };

		await runCardAction(card as never, { name: 'chaosKeep', index: 1 });

		expect(keepChaosRoll).toHaveBeenCalledWith(card, 1);
		expect(query).not.toHaveBeenCalled();
	});

	it('asks the GM when the user cannot change the card', async () => {
		const card = { id: 'card', isAuthor: false };

		await runCardAction(card as never, { name: 'chaosKeep', index: 1 });

		expect(keepChaosRoll).not.toHaveBeenCalled();
		expect(query).toHaveBeenCalledWith(expect.stringContaining('cardAction'), {
			messageId: 'card',
			action: { name: 'chaosKeep', index: 1 },
		});
	});

	it('tells the user when no GM is online to ask', async () => {
		(game as unknown as TestGame).users = { activeGM: null };

		await runCardAction({ id: 'card', isAuthor: false } as never, { name: 'initiativeManaRegain' });

		expect(notifications.warn).toHaveBeenCalled();
	});

	it('the GM runs what was asked', async () => {
		const once = vi.fn();
		vi.stubGlobal('Hooks', { once });
		(CONFIG as unknown as { queries: Record<string, unknown> }).queries = {};
		registerCardActionQuery();
		once.mock.calls[0][1]();
		const handler = Object.values(
			(CONFIG as unknown as { queries: Record<string, (data: object) => Promise<boolean>> })
				.queries,
		)[0];
		const card = { id: 'card' };
		(game as unknown as TestGame).user = { isGM: true };
		(game as unknown as TestGame).messages = { get: () => card };

		await handler({ messageId: 'card', action: { name: 'chaosKeep', index: 0 } });

		expect(keepChaosRoll).toHaveBeenCalledWith(card, 0);
	});
});
