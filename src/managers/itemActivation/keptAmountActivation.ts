import type { DamageRoll } from '../../dice/DamageRoll.js';

/**
 * The options of an attack that uses a kept amount: no die is rolled, it is a
 * hit with no crit. What a target's rule does to the attack stays.
 */
export function keptAmountRollOptions(
	options: DamageRoll.Options,
	label: string,
): DamageRoll.Options {
	const { forceMiss, damageType } = options;
	const incoming = (options as { incomingAttackModifiers?: unknown }).incomingAttackModifiers;
	return {
		canCrit: false,
		canMiss: false,
		fixedAmount: true,
		rollMode: 0,
		primaryDieValue: 0,
		primaryDieModifier: 0,
		outcomeSources: { keptAmount: [label] },
		...(damageType ? { damageType } : {}),
		...(forceMiss ? { forceMiss } : {}),
		...(incoming ? { incomingAttackModifiers: incoming } : {}),
	} as DamageRoll.Options;
}

/** Takes out each source of disadvantage. Advantage stays. */
export function removeDisadvantage(
	options: DamageRoll.Options & { rollModeSources?: number[] },
): void {
	options.rollMode = Math.max(options.rollMode ?? 0, 0);
	if (Array.isArray(options.rollModeSources)) {
		options.rollModeSources = options.rollModeSources.filter((value) => value > 0);
	}
}

/** The attack cannot miss, and its card tells why. */
export function grantCannotMiss(options: DamageRoll.Options, label: string): void {
	options.canMiss = false;
	options.outcomeSources = {
		...options.outcomeSources,
		cannotMiss: [...(options.outcomeSources?.cannotMiss ?? []), label],
		grantedCast: [label],
	};
}
