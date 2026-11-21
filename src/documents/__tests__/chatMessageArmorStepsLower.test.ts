import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from '../chatMessage.js';

const TOKEN = 'Scene.scene.Token.token';

function globals() {
	return globalThis as unknown as { fromUuidSync: ReturnType<typeof vi.fn> };
}

// Longsword hit: 1d8 (rolled 6) + 3 = 9.
function longswordRoll() {
	return {
		class: 'DamageRoll',
		formula: '1d8 + 3',
		total: 9,
		isCritical: false,
		excludedPrimaryDieValue: 0,
		terms: [
			{ number: 1, faces: 8, results: [{ result: 6, active: true, discarded: false }] },
			{ operator: '+' },
			{ number: 3 },
		],
	};
}

// A flat 10 radiant bonus, with no dice.
function radiantRoll() {
	return { class: 'Roll', formula: '10', total: 10, terms: [{ number: 10 }] };
}

function attackCard(lowerArmorSteps?: number) {
	const steps = lowerArmorSteps ? { lowerArmorSteps } : {};
	return new NimbleChatMessage({
		type: 'object',
		system: {
			targets: [TOKEN],
			isCritical: false,
			isMiss: false,
			activation: {
				effects: [
					{
						id: 'dmg',
						type: 'damage',
						formula: '1d8+3',
						damageType: 'slashing',
						canCrit: true,
						canMiss: true,
						roll: longswordRoll(),
						parentNode: null,
						parentContext: null,
						...steps,
						on: {
							hit: [
								{ id: 'dmg-hit', type: 'damageOutcome', parentNode: 'dmg', parentContext: 'hit' },
							],
						},
					},
					{
						id: 'radiant',
						type: 'damage',
						formula: '10',
						damageType: 'radiant',
						canCrit: false,
						canMiss: false,
						roll: radiantRoll(),
						parentNode: null,
						parentContext: null,
						...steps,
						on: {
							hit: [
								{
									id: 'radiant-hit',
									type: 'damageOutcome',
									parentNode: 'radiant',
									parentContext: 'hit',
								},
							],
						},
					},
				],
			},
		},
	} as unknown as ChatMessage.CreateData);
}

function damageTo(armor: 'none' | 'medium' | 'heavy', lowerArmorSteps?: number): number | null {
	globals().fromUuidSync.mockReturnValue({ actor: { system: { attributes: { armor } } } });
	return attackCard(lowerArmorSteps).getDamageBreakdownForTarget(TOKEN)?.total ?? null;
}

describe('damage that counts the target armor steps lower', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
	});

	// A roll with no die counts in full as dice, so armor halves the flat radiant but keeps it.
	it('with no step, Heavy armor halves the dice and drops the modifiers', () => {
		// ceil(6 / 2) + ceil(10 / 2) = 8; the +3 is dropped.
		expect(damageTo('heavy')).toBe(8);
	});

	it('one step lower counts Heavy armor as Medium: the dice only', () => {
		expect(damageTo('heavy', 1)).toBe(16);
	});

	it('two steps lower counts Heavy armor as none: all the damage', () => {
		expect(damageTo('heavy', 2)).toBe(19);
	});

	it('one step lower counts Medium armor as none', () => {
		expect(damageTo('medium')).toBe(16);
		expect(damageTo('medium', 1)).toBe(19);
	});

	it('changes nothing against a target with no armor', () => {
		expect(damageTo('none', 2)).toBe(19);
	});
});

// Longsword 1d8 (rolled 6) + 3, with Condemning Strike's +5 radiant as its own modifier step.
function condemningCard(lowerArmorSteps = 0, isCritical = false) {
	const steps = lowerArmorSteps ? { lowerArmorSteps } : {};
	return new NimbleChatMessage({
		type: 'object',
		system: {
			targets: [TOKEN],
			isCritical,
			isMiss: false,
			activation: {
				effects: [
					{
						id: 'dmg',
						type: 'damage',
						formula: '1d8+3',
						damageType: 'slashing',
						roll: { ...longswordRoll(), isCritical },
						parentNode: null,
						parentContext: null,
						...steps,
						on: {
							hit: [
								{ id: 'dmg-hit', type: 'damageOutcome', parentNode: 'dmg', parentContext: 'hit' },
							],
						},
					},
					{
						id: 'radiant',
						type: 'damage',
						formula: '5',
						damageType: 'radiant',
						modifierOnly: true,
						roll: { class: 'Roll', formula: '5', total: 5, terms: [{ number: 5 }] },
						parentNode: null,
						parentContext: null,
						...steps,
						on: {
							hit: [
								{
									id: 'radiant-hit',
									type: 'damageOutcome',
									parentNode: 'radiant',
									parentContext: 'hit',
								},
							],
						},
					},
				],
			},
		},
	} as unknown as ChatMessage.CreateData);
}

function condemningDamage(armor: 'medium' | 'heavy', steps = 0, isCritical = false) {
	globals().fromUuidSync.mockReturnValue({ actor: { system: { attributes: { armor } } } });
	const components = condemningCard(steps, isCritical).getDamageBreakdownForTarget(
		TOKEN,
	)?.components;
	return components?.map((each) => each.adjustedDamage);
}

describe('a flat damage modifier step against armor', () => {
	beforeEach(() => {
		globals().fromUuidSync = vi.fn();
	});

	it('is dropped by Heavy armor, and by Heavy armor one step lower', () => {
		expect(condemningDamage('heavy')).toEqual([3, 0]);
		expect(condemningDamage('heavy', 1)).toEqual([6, 0]);
	});

	it('counts against Heavy armor two steps lower', () => {
		expect(condemningDamage('heavy', 2)).toEqual([9, 5]);
	});

	it('is dropped by Medium armor, and counts one step lower', () => {
		expect(condemningDamage('medium')).toEqual([6, 0]);
		expect(condemningDamage('medium', 1)).toEqual([9, 5]);
	});

	it('counts on a crit, which ignores armor', () => {
		expect(condemningDamage('heavy', 0, true)).toEqual([9, 5]);
	});
});
