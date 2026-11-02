import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID, systemHookName } from '#system';
import type { NimbleSavePayload } from '../ruleEventDispatch.js';

const LINK = {
	attackMessageId: 'attack',
	role: 'critBonus',
	actorUuid: 'Actor.hero',
	chargePoolIdentifier: 'cunning-strike',
};

describe('the save of a crit dice rule', () => {
	const refundRuleCharge = vi.fn(async () => {});
	const spendRuleCharge = vi.fn(async () => true);
	let fire: (outcome: NimbleSavePayload['outcome']) => Promise<void>;
	let dice: number[];
	let flags: Record<string, unknown>;
	let written: Record<string, unknown>;

	beforeEach(async () => {
		vi.resetModules();
		refundRuleCharge.mockClear();
		spendRuleCharge.mockClear();
		dice = [2, 3];
		flags = {};
		vi.doMock('#utils/chargePool/ruleChargeGate.js', () => ({ refundRuleCharge, spendRuleCharge }));
		vi.doMock('../../dice/DamageRoll.js', () => ({
			DamageRoll: {
				fromData: () => ({
					setRoleDiceToMax: () => {
						const old = dice;
						dice = [6, 6];
						return old;
					},
					restoreRoleDice: (_role: string, faces: number[]) => {
						dice = faces;
					},
					toJSON: () => ({}),
				}),
			},
		}));
		vi.doMock('#utils/damage/foldBonusIntoPrimaryDamage.js', () => ({
			findPrimaryDamageNode: () => ({ roll: {} }),
			replaceDamageRollInRollsSource: () => [],
		}));

		const attack = {
			getFlag: (_scope: string, key: string) => flags[key],
			update: async (changes: Record<string, unknown>) => {
				written = changes;
				flags.critDiceSaveState = changes[`flags.${SYSTEM_ID}.critDiceSaveState`];
			},
			system: { activation: { effects: [] } },
			rolls: [],
			_source: { rolls: [] },
		};
		const saveCard = { getFlag: () => LINK };
		vi.stubGlobal('game', {
			user: { isGM: true },
			messages: { get: (id: string) => (id === 'attack' ? attack : saveCard) },
		});
		vi.stubGlobal('fromUuidSync', () => ({ uuid: 'Actor.hero' }));

		const listeners: Array<(payload: NimbleSavePayload) => void> = [];
		vi.spyOn(Hooks, 'on').mockImplementation(((name: string, listener: never) => {
			if (name === systemHookName('saveResolved')) listeners.push(listener);
			return 1;
		}) as never);
		const { registerCritDiceSaveHooks } = await import('../critDiceSave.js');
		registerCritDiceSaveHooks();
		fire = async (outcome) => {
			listeners[0]({ actor: {}, saveType: 'strength', outcome, messageId: 'save' } as never);
			await vi.waitFor(() => expect(flags.critDiceSaveState).toBeDefined());
			await new Promise((resolve) => setTimeout(resolve));
		};
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('sets the dice to their max when the target fails', async () => {
		await fire('fail');
		expect(dice).toEqual([6, 6]);
		expect(refundRuleCharge).not.toHaveBeenCalled();
		expect(written).toEqual(expect.objectContaining({ rolls: [] }));
		expect(written).toHaveProperty(['system.activation']);
	});

	it('gives the use back when the target passes, and the dice stay', async () => {
		await fire('pass');
		expect(dice).toEqual([2, 3]);
		expect(refundRuleCharge).toHaveBeenCalledOnce();
	});

	it('undoes a failure when the result changes to a pass', async () => {
		await fire('fail');
		await fire('pass');
		expect(dice).toEqual([2, 3]);
		expect(refundRuleCharge).toHaveBeenCalledOnce();
	});

	it('spends the use again when a pass changes to a failure', async () => {
		await fire('pass');
		await fire('fail');
		expect(dice).toEqual([6, 6]);
		expect(spendRuleCharge).toHaveBeenCalledOnce();
	});

	it('undoes all when the result goes away', async () => {
		await fire('pass');
		await fire('unknown');
		expect(dice).toEqual([2, 3]);
		expect(spendRuleCharge).toHaveBeenCalledOnce();
	});
});
