import type { ModifyOutgoingAttackRule } from '../models/rules/modifyOutgoingAttack.js';

export interface OutgoingAttackOverrides {
	/** The attack's primary die skips its miss check entirely, so a natural 1 lands. */
	cannotMiss: boolean;
	/** The attack's damage bypasses the target's armor. */
	ignoreArmor: boolean;
}

interface OutgoingAttackRule {
	type?: string;
	disabled?: boolean;
	modifier?: string;
	test?: () => boolean;
}

/**
 * The attack overrides the actor's `modifyOutgoingAttack` rules currently grant.
 *
 * Read at attack time rather than during data preparation so predicates see the domain as it
 * stands when the attack is made.
 */
export default function getOutgoingAttackOverrides(
	actor: object | null | undefined,
): OutgoingAttackOverrides {
	const overrides: OutgoingAttackOverrides = { cannotMiss: false, ignoreArmor: false };
	const rules = (actor as { rules?: OutgoingAttackRule[] } | null | undefined)?.rules ?? [];

	for (const rule of rules) {
		if (rule.type !== 'modifyOutgoingAttack') continue;
		if (rule.disabled) continue;
		if (rule.test && !rule.test()) continue;

		const { modifier } = rule as Pick<ModifyOutgoingAttackRule, 'modifier'>;
		if (modifier === 'cannotMiss') overrides.cannotMiss = true;
		else if (modifier === 'ignoreArmor') overrides.ignoreArmor = true;
	}

	return overrides;
}
