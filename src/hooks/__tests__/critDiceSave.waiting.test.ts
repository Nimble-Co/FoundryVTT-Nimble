import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemHookName } from '#system';
import type { NimbleSavePayload } from '../ruleEventDispatch.js';

const LINK = {
	attackMessageId: 'attack',
	role: 'critBonus',
	actorUuid: 'Actor.hero',
	chargePoolIdentifier: 'cunning-strike',
};

describe('the save of a crit dice rule with Feature Effects off', () => {
	const settleCritDiceSave = vi.fn(async (..._args: unknown[]) => {});
	const showCritDiceSaveLine = vi.fn(async (..._args: unknown[]) => {});
	const saveCard = { id: 'save', getFlag: () => LINK };
	let fire: (outcome: NimbleSavePayload['outcome']) => void;

	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.doMock('#utils/rolls/critDiceSaveSettle.js', () => ({ settleCritDiceSave }));
		vi.doMock('#utils/rolls/critDiceSaveLine.js', () => ({
			showCritDiceSaveLine,
			registerCritDiceSaveLineQuery: () => {},
		}));
		vi.stubGlobal('game', {
			user: { isGM: true, isActiveGM: true },
			messages: { get: () => saveCard },
			settings: { get: () => false },
		});
		const listeners: Array<(payload: NimbleSavePayload) => void> = [];
		vi.spyOn(Hooks, 'on').mockImplementation(((name: string, listener: never) => {
			if (name === systemHookName('saveResolved')) listeners.push(listener);
			return 1;
		}) as never);
		const { registerCritDiceSaveHooks } = await import('../critDiceSave.js');
		registerCritDiceSaveHooks();
		fire = (outcome) =>
			listeners[0]({ actor: {}, saveType: 'strength', outcome, messageId: 'save' } as never);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		vi.doUnmock('#utils/rolls/critDiceSaveSettle.js');
		vi.doUnmock('#utils/rolls/critDiceSaveLine.js');
	});

	it('changes nothing: the save card gets a waiting line for the result', async () => {
		fire('fail');

		await vi.waitFor(() =>
			expect(showCritDiceSaveLine).toHaveBeenCalledWith(saveCard, LINK, 'fail'),
		);
		expect(settleCritDiceSave).not.toHaveBeenCalled();
	});

	it('only the active GM posts the line', async () => {
		(game.user as unknown as { isActiveGM: boolean }).isActiveGM = false;
		fire('fail');
		await new Promise((resolve) => setTimeout(resolve));

		expect(showCritDiceSaveLine).not.toHaveBeenCalled();
		expect(settleCritDiceSave).not.toHaveBeenCalled();
	});
});
