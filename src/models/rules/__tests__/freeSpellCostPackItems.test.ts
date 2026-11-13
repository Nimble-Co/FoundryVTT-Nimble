import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Hungering Shadows pack item', () => {
	const item = JSON.parse(
		readFileSync(
			resolve('packs/classFeatures/core/shadowmancer/greater-invocations/hungering-shadows.json'),
			'utf8',
		),
	);
	const [effect] = item.effects;

	it('has an activation that puts its effect on the user', () => {
		expect(item.system.activation.effects).toEqual([
			expect.objectContaining({ type: 'applyEffect', effectId: effect._id, recipient: 'self' }),
		]);
	});

	it('has an effect that is not on the owner, with the free cost rule for Pilfered Power', () => {
		expect(effect).toMatchObject({ name: 'Hungering Shadows', transfer: false, disabled: false });
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'freeSpellCost',
				poolIdentifier: 'pilfered-power',
				disabled: false,
			}),
		]);
		expect(effect.system.escape.saves).toEqual(['strength', 'dexterity']);
	});

	it('lasts until the holder casts a tiered spell or combat ends', () => {
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'nextSpell', who: 'holder' }),
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
	});
});
