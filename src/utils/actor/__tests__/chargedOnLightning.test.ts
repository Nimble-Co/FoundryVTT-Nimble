import { beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const applyEffectToActor = vi.fn(async () => null);
vi.resetModules();
const actual = await vi.importActual<typeof import('../applyEffectToActor.js')>(
	'../applyEffectToActor.js',
);
vi.doMock('../applyEffectToActor.js', () => ({ ...actual, applyEffectToActor }));
const { chargeOnLightning } = await import('../chargedOnLightning.js');

const target = { uuid: 'Actor.ogre', update: vi.fn() };

describe('chargeOnLightning', () => {
	beforeEach(() => vi.clearAllMocks());

	it('lightning damage makes the creature Charged for 1 minute', async () => {
		await chargeOnLightning(target, ['piercing', 'lightning'], 'Actor.mage');

		expect(applyEffectToActor).toHaveBeenCalledWith(target, {
			data: {
				statuses: ['charged'],
				system: {
					lastsUntil: [expect.objectContaining({ kind: 'time', value: 1, units: 'minutes' })],
				},
			},
			sourceItemUuid: null,
			sourceActorUuid: 'Actor.mage',
		});
	});

	it('names the card of the damage, so the lines of the effect go on it', async () => {
		await chargeOnLightning(target, ['lightning'], 'Actor.mage', 'card1');

		expect(applyEffectToActor).toHaveBeenCalledWith(
			target,
			expect.objectContaining({ cardId: 'card1' }),
		);
	});

	it('other damage does nothing', async () => {
		await chargeOnLightning(target, ['fire']);
		await chargeOnLightning(target, []);
		expect(applyEffectToActor).not.toHaveBeenCalled();
	});
});
