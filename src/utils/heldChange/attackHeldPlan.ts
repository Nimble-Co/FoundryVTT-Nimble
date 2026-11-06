import type { AttackHeldPlan } from '#types/attackHeldPlan.d.ts';
import type { HeldChange } from '#types/heldChange.d.ts';
import { removeDisadvantage } from '../../managers/itemActivation/keptAmountActivation.js';
import {
	heldChangesForAttack,
	ignoreDisadvantageChange,
	mustAttackOtherChange,
	spendHeldChanges,
} from './heldChange.js';

type Holder = Parameters<typeof heldChangesForAttack>[0]['attacker'];

interface AttackHeldInput {
	attacker: Holder;
	target: Holder;
	/** An area roll has no Primary Die, so it uses no Primary Die change. */
	area: boolean;
	/** The roll is an attack roll. Only an attack roll uses Primary Die changes and ignores disadvantage. */
	attack: boolean;
	/** The amount the roll keeps in place of dice, or null when it rolls. */
	kept?: HeldChange | null;
	/** The kept amount this attack ends, used or not. */
	keptToEnd?: HeldChange | null;
	/** The roll has no disadvantage of its own to take out (max damage, or it ignores it already). */
	noDisadvantageToIgnore?: boolean;
}

function planOf(
	parts: Pick<AttackHeldPlan, 'primaryDie' | 'ignoreDisadvantage' | 'mustAttackOther'>,
	keptToEnd: HeldChange | null,
): AttackHeldPlan {
	const plan: AttackHeldPlan = {
		...parts,
		primaryDieBonus: parts.primaryDie.reduce((sum, change) => sum + change.value, 0),
		bonusLines: () =>
			parts.primaryDie.map((change) => ({
				label: change.label,
				value: change.value,
				itemUuid: '',
			})),
		applyToRoll(options) {
			if (parts.ignoreDisadvantage) removeDisadvantage(options);
			if (parts.mustAttackOther) {
				options.outcomeSources = {
					...options.outcomeSources,
					mustAttackOther: [parts.mustAttackOther.label],
				};
			}
		},
		withoutPrimaryDie: () => planOf({ ...parts, primaryDie: [] }, keptToEnd),
		spend: () =>
			spendHeldChanges(
				[...parts.primaryDie, parts.ignoreDisadvantage, keptToEnd, parts.mustAttackOther].filter(
					(change): change is HeldChange => !!change,
				),
			),
	};
	return plan;
}

/**
 * The Held Changes one attack uses. A kept amount replaces the roll, so the
 * roll uses no Primary Die change and has no disadvantage to take out.
 * Ignoring disadvantage also ignores the negative Primary Die changes.
 */
function attackHeldPlanOf(input: AttackHeldInput): AttackHeldPlan {
	const kept = input.kept ?? null;
	const ignoreDisadvantage =
		input.attack && !kept && !input.noDisadvantageToIgnore
			? ignoreDisadvantageChange(input.attacker)
			: null;
	const primaryDie =
		input.attack && !kept
			? heldChangesForAttack({
					attacker: input.attacker,
					target: input.target,
					area: input.area,
					ignoresNegative: !!ignoreDisadvantage,
				})
			: [];
	return planOf(
		{ primaryDie, ignoreDisadvantage, mustAttackOther: mustAttackOtherChange(input.attacker) },
		input.keptToEnd ?? null,
	);
}

export { attackHeldPlanOf };
