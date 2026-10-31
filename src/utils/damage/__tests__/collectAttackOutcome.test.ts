import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttackOutcomeChange } from '../../../models/rules/attackOutcome.js';
import { collectAttackOutcome } from '../collectAttackOutcome.js';

const settings = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
};

function setFeatureEffects(on: boolean) {
	settings.game.settings = { get: () => on };
}

function change(overrides: Partial<AttackOutcomeChange> = {}): AttackOutcomeChange {
	return {
		label: 'Feature',
		cannotMiss: false,
		critRange: 0,
		forcedCrit: null,
		anyDieCrits: false,
		chargePoolIdentifier: '',
		...overrides,
	};
}

/** A creature with Attack Outcome rules that give these changes on its own side. */
function owner(...changes: AttackOutcomeChange[]) {
	return {
		rules: changes.map((given) => ({
			type: 'attackOutcome',
			changeFor: vi.fn((context: { side: string }) =>
				context.side === 'yourAttacks' ? given : null,
			),
		})),
	};
}

const roll = (overrides: Record<string, unknown> = {}) => ({
	attacker: null,
	target: null,
	delivery: 'melee' as const,
	itemUuid: 'Item.sword',
	canCrit: true,
	canMiss: true,
	...overrides,
});

describe('collectAttackOutcome', () => {
	afterEach(() => {
		delete settings.game.settings;
	});

	describe('a target in the Incapacitated group', () => {
		function creature(...statuses: string[]) {
			return {
				statuses: new Set(statuses),
				getTargetDomain: () => new Set(statuses.length ? ['target:incapacitated'] : []),
			};
		}

		it('makes a melee hit a crit, and names the condition', () => {
			const { options, charges } = collectAttackOutcome(roll({ target: creature('stunned') }));
			expect(options.forcedCrit).toBe('onHit');
			expect(options.canMiss).toBe(true);
			expect(options.outcomeSources?.forcedCrit).toEqual(['target Stunned']);
			expect(charges).toEqual([]);
		});

		it('names the most specific condition of a Petrified target', () => {
			const { options } = collectAttackOutcome(
				roll({ target: creature('incapacitated', 'petrified') }),
			);
			expect(options.outcomeSources?.forcedCrit).toEqual(['target Petrified']);
		});

		it('does nothing on a ranged attack, or an attack with no delivery', () => {
			for (const delivery of ['ranged', null]) {
				const { options } = collectAttackOutcome(roll({ delivery, target: creature('stunned') }));
				expect(options.forcedCrit).toBeUndefined();
			}
		});

		it('does nothing on a roll that cannot crit', () => {
			const { options } = collectAttackOutcome(
				roll({ canCrit: false, target: creature('stunned') }),
			);
			expect(options.forcedCrit).toBeUndefined();
		});

		it('does nothing with no sole target, or a target outside the group', () => {
			expect(collectAttackOutcome(roll({ target: null })).options.forcedCrit).toBeUndefined();
			expect(collectAttackOutcome(roll({ target: creature() })).options.forcedCrit).toBeUndefined();
		});

		it('does not lower an "always" Forced Crit', () => {
			const { options } = collectAttackOutcome(
				roll({
					attacker: owner(change({ label: 'Touch', forcedCrit: 'always' })),
					target: creature('unconscious'),
				}),
			);
			expect(options.forcedCrit).toBe('always');
			expect(options.outcomeSources?.forcedCrit).toHaveLength(2);
		});

		it('does not read the crit with Feature Effects off', () => {
			setFeatureEffects(false);
			const { options } = collectAttackOutcome(roll({ target: creature('paralyzed') }));
			expect(options.forcedCrit).toBeUndefined();
		});
	});

	it('changes nothing with no rules', () => {
		expect(collectAttackOutcome(roll())).toEqual({ options: { canMiss: true }, charges: [] });
	});

	it('makes the attack unable to miss, and names the feature', () => {
		const { options } = collectAttackOutcome(
			roll({ attacker: owner(change({ label: 'Heads I Win', cannotMiss: true })) }),
		);

		expect(options.canMiss).toBe(false);
		expect(options.outcomeSources).toEqual({ cannotMiss: ['Heads I Win'] });
	});

	it('takes the largest crit range', () => {
		const { options } = collectAttackOutcome(
			roll({ attacker: owner(change({ critRange: 1 }), change({ critRange: 2 })) }),
		);

		expect(options.critRange).toBe(2);
	});

	it('takes an "always" Forced Crit over one on a hit, in any order', () => {
		const always = change({ forcedCrit: 'always' });
		const onHit = change({ forcedCrit: 'onHit' });

		expect(collectAttackOutcome(roll({ attacker: owner(always, onHit) })).options.forcedCrit).toBe(
			'always',
		);
		expect(collectAttackOutcome(roll({ attacker: owner(onHit, always) })).options.forcedCrit).toBe(
			'always',
		);
	});

	it('gives no crit change to a roll that cannot crit, and spends no charge for it', () => {
		const result = collectAttackOutcome(
			roll({
				canCrit: false,
				attacker: owner(
					change({ forcedCrit: 'always', critRange: 1, chargePoolIdentifier: 'touch' }),
				),
			}),
		);

		expect(result).toEqual({ options: { canMiss: true }, charges: [] });
	});

	it('gives no "cannot miss" to a roll that cannot miss', () => {
		const result = collectAttackOutcome(
			roll({
				canMiss: false,
				attacker: owner(change({ cannotMiss: true, chargePoolIdentifier: 'x' })),
			}),
		);

		expect(result).toEqual({ options: { canMiss: false }, charges: [] });
	});

	it('keeps the crit range but gives no crit with Feature Effects off', () => {
		setFeatureEffects(false);
		const { options } = collectAttackOutcome(
			roll({
				attacker: owner(change({ critRange: 1, forcedCrit: 'always', anyDieCrits: true })),
			}),
		);

		expect(options.critRange).toBe(1);
		expect(options.forcedCrit).toBeUndefined();
		expect(options.anyDieCrits).toBeUndefined();
	});

	it('spends the charge of a rule that changed the attack', () => {
		const result = collectAttackOutcome(
			roll({ attacker: owner(change({ forcedCrit: 'always', chargePoolIdentifier: 'touch' })) }),
		);

		expect(result.charges).toEqual(['touch']);
	});

	it("asks the target's rules about attacks against it, with the one who attacks as the other creature", () => {
		const attacker = { rules: [] };
		const rule = { type: 'attackOutcome', changeFor: vi.fn(() => change({ cannotMiss: true })) };

		const { options } = collectAttackOutcome(roll({ attacker, target: { rules: [rule] } }));

		expect(options.canMiss).toBe(false);
		expect(rule.changeFor).toHaveBeenCalledWith(
			expect.objectContaining({ side: 'attacksAgainstYou', other: attacker }),
		);
	});

	it("gives the rules the attack's damage types", () => {
		const rule = { type: 'attackOutcome', changeFor: vi.fn(() => null) };

		collectAttackOutcome(roll({ attacker: { rules: [rule] }, damageTypes: ['slashing'] }));

		expect(rule.changeFor).toHaveBeenCalledWith(
			expect.objectContaining({ side: 'yourAttacks', damageTypes: ['slashing'] }),
		);
	});
});
