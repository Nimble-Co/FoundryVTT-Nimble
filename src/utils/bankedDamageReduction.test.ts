import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	addBankedDamageReduction,
	clearBankedDamageReduction,
	getBankedDamageReduction,
	getBankedDamageReductionEntries,
} from './bankedDamageReduction.js';

function createBankedEffect(value: unknown, options: { id?: string; disabled?: boolean } = {}) {
	return {
		id: options.id ?? 'banked-effect',
		disabled: options.disabled ?? false,
		flags: { [SYSTEM_ID]: { bankedDamageReduction: value } },
		update: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockActor(effects: ReturnType<typeof createBankedEffect>[] = []) {
	return {
		effects,
		createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
		deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
	} as unknown as Actor.Implementation & {
		createEmbeddedDocuments: ReturnType<typeof vi.fn>;
		deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
	};
}

describe('getBankedDamageReduction', () => {
	it('returns 0 when no banked effect exists', () => {
		expect(getBankedDamageReduction(createMockActor())).toBe(0);
	});

	it('returns the banked amount floored', () => {
		expect(getBankedDamageReduction(createMockActor([createBankedEffect(7.9)]))).toBe(7);
	});

	it('ignores disabled effects and non-positive values', () => {
		const actor = createMockActor([
			createBankedEffect(6, { disabled: true }),
			createBankedEffect(-3),
			createBankedEffect('nonsense'),
		]);

		expect(getBankedDamageReduction(actor)).toBe(0);
	});

	it('sums multiple enabled banked effects', () => {
		const actor = createMockActor([
			createBankedEffect(4, { id: 'a' }),
			createBankedEffect(2, { id: 'b' }),
		]);

		expect(getBankedDamageReduction(actor)).toBe(6);
	});
});

describe('addBankedDamageReduction', () => {
	it('creates a named active effect carrying the banked amount', async () => {
		const actor = createMockActor();

		await addBankedDamageReduction(actor, 8);

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			expect.objectContaining({
				name: 'Damage Reduction (8)',
				description: expect.stringContaining('8'),
				img: 'icons/svg/shield.svg',
				disabled: false,
				flags: { [SYSTEM_ID]: { bankedDamageReduction: 8 } },
			}),
		]);
	});

	it('uses the source feature image when provided', async () => {
		const actor = createMockActor();

		await addBankedDamageReduction(actor, 8, 'icons/skills/melee/tayg.webp');

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			expect.objectContaining({ img: 'icons/skills/melee/tayg.webp' }),
		]);
	});

	it('records the source feature name when provided', async () => {
		const actor = createMockActor();

		await addBankedDamageReduction(actor, 8, null, 'That all you got?!');

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			expect.objectContaining({
				flags: {
					[SYSTEM_ID]: {
						bankedDamageReduction: 8,
						bankedDamageReductionSource: 'That all you got?!',
					},
				},
			}),
		]);
	});

	it('lists banked entries with their source via getBankedDamageReductionEntries', async () => {
		const sourced = createBankedEffect(8);
		(sourced.flags[SYSTEM_ID] as Record<string, unknown>).bankedDamageReductionSource =
			'That all you got?!';
		const unsourced = createBankedEffect(3, { id: 'other-effect' });
		const actor = createMockActor([sourced, unsourced]);

		expect(getBankedDamageReductionEntries(actor)).toEqual([
			{ value: 8, source: 'That all you got?!' },
			{ value: 3, source: null },
		]);
	});

	it('accumulates onto an existing banked effect and updates its name', async () => {
		const existing = createBankedEffect(5);
		const actor = createMockActor([existing]);

		await addBankedDamageReduction(actor, 8);

		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(existing.update).toHaveBeenCalledWith({
			name: 'Damage Reduction (13)',
			description: expect.stringContaining('13'),
			[`flags.${SYSTEM_ID}.bankedDamageReduction`]: 13,
		});
	});

	it('ignores non-positive or non-finite amounts', async () => {
		const actor = createMockActor();

		await addBankedDamageReduction(actor, 0);
		await addBankedDamageReduction(actor, -4);
		await addBankedDamageReduction(actor, Number.NaN);

		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe('clearBankedDamageReduction', () => {
	it('deletes the banked effects', async () => {
		const actor = createMockActor([
			createBankedEffect(4, { id: 'a' }),
			createBankedEffect(2, { id: 'b' }),
		]);

		await clearBankedDamageReduction(actor);

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a', 'b']);
	});

	it('leaves disabled banked effects in place', async () => {
		const actor = createMockActor([createBankedEffect(4, { disabled: true })]);

		await clearBankedDamageReduction(actor);

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('does nothing when no banked effect exists', async () => {
		const actor = createMockActor();

		await clearBankedDamageReduction(actor);

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
