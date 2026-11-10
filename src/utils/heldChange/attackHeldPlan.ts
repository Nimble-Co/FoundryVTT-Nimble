import type { AttackHeldPlan } from '#types/attackHeldPlan.d.ts';
import type { HeldChange } from '#types/heldChange.d.ts';
import { removeDisadvantage } from '../../managers/itemActivation/keptAmountActivation.js';
import {
	heldAdvantageForAttack,
	heldChangesForAttack,
	heldMaximizeForAttack,
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
	/** A melee attack; unknown counts as melee. */
	melee?: boolean;
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
	parts: Pick<
		AttackHeldPlan,
		'primaryDie' | 'advantage' | 'maximize' | 'ignoreDisadvantage' | 'mustAttackOther'
	>,
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
			// One source for each change, so ignoring disadvantage takes out only the minus ones.
			const steps = parts.advantage.map((change) => change.value).filter((value) => value !== 0);
			if (steps.length > 0) {
				options.rollModeSources = [
					...(Array.isArray(options.rollModeSources)
						? options.rollModeSources
						: [options.rollMode ?? 0]),
					...steps,
				];
			}
			if (parts.ignoreDisadvantage) removeDisadvantage(options);
			if (parts.maximize && !options.maxDamage) {
				options.maxDamage = options.canCrit === false ? 'hit' : 'crit';
				options.outcomeSources = {
					...options.outcomeSources,
					maxDamage: [parts.maximize.label],
				};
			}
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
				[
					...parts.primaryDie,
					...parts.advantage,
					parts.maximize,
					parts.ignoreDisadvantage,
					keptToEnd,
					parts.mustAttackOther,
				].filter((change): change is HeldChange => !!change),
			),
	};
	return plan;
}

/**
 * The Held Changes one attack uses. A kept amount replaces the roll, so the
 * roll uses no Primary Die change and has no disadvantage to take out.
 * Ignoring disadvantage also ignores the negative Primary Die changes.
 * Advantage changes add their steps to the roll mode; a maximize change rolls every die at its
 * highest number.
 */
function attackHeldPlanOf(input: AttackHeldInput): AttackHeldPlan {
	const kept = input.kept ?? null;
	const ignoreDisadvantage =
		input.attack && !kept && !input.noDisadvantageToIgnore
			? ignoreDisadvantageChange(input.attacker)
			: null;
	const rolls = input.attack && !kept;
	const attack = {
		attacker: input.attacker,
		target: input.target,
		area: input.area,
		melee: input.melee,
	};
	return planOf(
		{
			primaryDie: rolls
				? heldChangesForAttack({ ...attack, ignoresNegative: !!ignoreDisadvantage })
				: [],
			advantage: rolls ? heldAdvantageForAttack(attack) : [],
			maximize: rolls ? heldMaximizeForAttack(attack) : null,
			ignoreDisadvantage,
			mustAttackOther: mustAttackOtherChange(input.attacker),
		},
		input.keptToEnd ?? null,
	);
}

export { attackHeldPlanOf };
