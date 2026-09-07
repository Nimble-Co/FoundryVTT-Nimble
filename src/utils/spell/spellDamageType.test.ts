import { describe, expect, it } from 'vitest';
import { retagEffectsDamageType, schoolToDamageType } from './spellDamageType.ts';

describe('schoolToDamageType', () => {
	it('maps elemental schools to their damage type (ice → cold)', () => {
		expect(schoolToDamageType('fire')).toBe('fire');
		expect(schoolToDamageType('ice')).toBe('cold');
		expect(schoolToDamageType('lightning')).toBe('lightning');
	});

	it('returns null for a non-elemental school', () => {
		expect(schoolToDamageType('radiant')).toBeNull();
	});
});

describe('retagEffectsDamageType', () => {
	it('remaps elemental damage types nested under saving-throw outcomes', () => {
		const effects = [
			{
				type: 'savingThrow',
				on: {
					failedSave: [{ type: 'damage', damageType: 'cold', formula: '2d6' }],
					passedSave: [{ type: 'note', text: 'half' }],
				},
			},
		];
		const result = retagEffectsDamageType(effects, 'fire') as typeof effects;
		expect(result[0].on.failedSave[0].damageType).toBe('fire');
		// Non-damage nodes are untouched.
		expect((result[0].on.passedSave[0] as { text: string }).text).toBe('half');
	});

	it('remaps a top-level damage node', () => {
		const effects = [{ type: 'damage', damageType: 'lightning', formula: '3d8' }];
		const result = retagEffectsDamageType(effects, 'cold') as Array<{ damageType: string }>;
		expect(result[0].damageType).toBe('cold');
	});

	it('leaves non-elemental damage types untouched', () => {
		const effects = [{ type: 'damage', damageType: 'radiant', formula: '1d6' }];
		const result = retagEffectsDamageType(effects, 'fire') as Array<{ damageType: string }>;
		expect(result[0].damageType).toBe('radiant');
	});

	it('does not mutate the original effects array', () => {
		const effects = [{ type: 'damage', damageType: 'fire' }];
		retagEffectsDamageType(effects, 'cold');
		expect(effects[0].damageType).toBe('fire');
	});

	it('returns an empty array for non-array input', () => {
		expect(retagEffectsDamageType(undefined, 'fire')).toEqual([]);
	});
});
