import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFirstAttackHalveHooks } from '../firstAttackHalve.js';

const globals = globalThis as unknown as { [key: string]: any };

describe('registerFirstAttackHalveHooks', () => {
	let onCreate: (card: unknown) => void;

	beforeEach(() => {
		globals.Hooks.on = vi.fn((name: string, handler: (card: unknown) => void) => {
			if (name === 'createChatMessage') onCreate = handler;
		});
		registerFirstAttackHalveHooks();
	});

	it('claims the halves of a new card on the active GM only', () => {
		const card = { claimFirstAttackHalves: vi.fn(async () => undefined) };
		globals.game.user = { ...globals.game.user, id: 'gm', isGM: true };
		globals.game.users = { activeGM: { id: 'gm' } };
		onCreate(card);
		expect(card.claimFirstAttackHalves).toHaveBeenCalledTimes(1);

		globals.game.user = { ...globals.game.user, id: 'player', isGM: false };
		onCreate(card);
		expect(card.claimFirstAttackHalves).toHaveBeenCalledTimes(1);
	});
});
