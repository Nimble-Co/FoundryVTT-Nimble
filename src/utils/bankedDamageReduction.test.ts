import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	addBankedDamageReduction,
	clearBankedDamageReduction,
	getBankedDamageReduction,
} from './bankedDamageReduction.js';

const FLAG_PATH = `flags.${SYSTEM_ID}.bankedDamageReduction`;

function createMockActor(banked?: unknown) {
	return {
		flags: banked === undefined ? {} : { [SYSTEM_ID]: { bankedDamageReduction: banked } },
		update: vi.fn().mockResolvedValue(undefined),
	} as unknown as Actor.Implementation & { update: ReturnType<typeof vi.fn> };
}

describe('getBankedDamageReduction', () => {
	it('returns 0 when no reduction is banked', () => {
		expect(getBankedDamageReduction(createMockActor())).toBe(0);
	});

	it('returns the banked amount floored', () => {
		expect(getBankedDamageReduction(createMockActor(7.9))).toBe(7);
	});

	it('returns 0 for non-numeric or negative values', () => {
		expect(getBankedDamageReduction(createMockActor('nonsense'))).toBe(0);
		expect(getBankedDamageReduction(createMockActor(-3))).toBe(0);
	});
});

describe('addBankedDamageReduction', () => {
	it('banks the amount on the actor flag', async () => {
		const actor = createMockActor();

		await addBankedDamageReduction(actor, 8);

		expect(actor.update).toHaveBeenCalledWith({ [FLAG_PATH]: 8 });
	});

	it('accumulates with an existing banked amount', async () => {
		const actor = createMockActor(5);

		await addBankedDamageReduction(actor, 8);

		expect(actor.update).toHaveBeenCalledWith({ [FLAG_PATH]: 13 });
	});

	it('ignores non-positive or non-finite amounts', async () => {
		const actor = createMockActor();

		await addBankedDamageReduction(actor, 0);
		await addBankedDamageReduction(actor, -4);
		await addBankedDamageReduction(actor, Number.NaN);

		expect(actor.update).not.toHaveBeenCalled();
	});
});

describe('clearBankedDamageReduction', () => {
	it('resets the banked amount to 0', async () => {
		const actor = createMockActor(6);

		await clearBankedDamageReduction(actor);

		expect(actor.update).toHaveBeenCalledWith({ [FLAG_PATH]: 0 });
	});

	it('does not update the actor when nothing is banked', async () => {
		const actor = createMockActor();

		await clearBankedDamageReduction(actor);

		expect(actor.update).not.toHaveBeenCalled();
	});
});
