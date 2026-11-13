import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { concentrationLastsUntil } from '../concentration.js';

const zeroHp = { kind: 'event', who: 'holder', event: 'zeroHp' };
const spell = (quantity: unknown, type: string) => ({
	tags: new Set<string>(),
	system: { activation: { duration: { quantity, type } } },
});

describe('concentrationLastsUntil', () => {
	let saved: unknown;
	beforeEach(() => {
		saved = (CONFIG as { statusEffects?: unknown }).statusEffects;
		(CONFIG as { statusEffects?: unknown }).statusEffects = [
			{ id: 'concentration', system: { lastsUntil: [zeroHp] } },
		];
	});
	afterEach(() => {
		(CONFIG as { statusEffects?: unknown }).statusEffects = saved;
	});

	it('adds "for 1 minute" to the moments of Concentrating for "Up to 1 minute"', () => {
		expect(concentrationLastsUntil(spell(1, 'minute'))).toEqual([
			zeroHp,
			expect.objectContaining({ kind: 'time', value: 1, units: 'minutes' }),
		]);
		expect(concentrationLastsUntil(spell('2', 'hour'))?.[1]).toMatchObject({
			value: 2,
			units: 'hours',
		});
	});

	it('reads the Duration it is given over the Duration of the item', () => {
		expect(
			concentrationLastsUntil(spell(1, 'minute'), { quantity: 2, type: 'minute' })?.[1],
		).toMatchObject({
			value: 2,
			units: 'minutes',
		});
		expect(concentrationLastsUntil(spell(1, 'minute'), null)?.[1]).toMatchObject({ value: 1 });
	});

	it('gives nothing for a Duration that is not in minutes or hours', () => {
		expect(concentrationLastsUntil(spell(1, 'round'))).toBeUndefined();
		expect(concentrationLastsUntil(spell(null, 'minute'))).toBeUndefined();
		expect(concentrationLastsUntil({ tags: new Set() })).toBeUndefined();
	});
});
