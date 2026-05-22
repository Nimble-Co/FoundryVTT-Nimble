import { describe, expect, it } from 'vitest';
import { HitDiceManager } from './HitDiceManager.js';

function createActor(hitDiceBonus: number, current = 3) {
	return {
		classes: {
			fighter: {
				hitDice: {
					size: 8,
					total: 3,
				},
			},
		},
		system: {
			abilities: {
				strength: {
					mod: 0,
				},
			},
			attributes: {
				hitDice: {
					8: {
						current,
						bonus: hitDiceBonus,
					},
				},
				bonusHitDice: [],
			},
		},
		update: () => undefined,
		applyHealing: () => undefined,
	} as unknown as ConstructorParameters<typeof HitDiceManager>[0];
}

describe('HitDiceManager', () => {
	it('applies negative maxHitDice bonuses to the rollable pool', () => {
		const manager = new HitDiceManager(createActor(-1));

		expect(manager.max).toBe(2);
		expect(manager.value).toBe(2);
		expect(manager.bySize[8]).toEqual({
			current: 2,
			total: 2,
		});
	});

	it('does not let negative maxHitDice bonuses create negative totals', () => {
		const manager = new HitDiceManager(createActor(-5));

		expect(manager.max).toBe(0);
		expect(manager.value).toBe(0);
		expect(manager.bySize[8]).toEqual({
			current: 0,
			total: 0,
		});
	});
});
