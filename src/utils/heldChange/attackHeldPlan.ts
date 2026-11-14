import type { AttackHeldPlan } from '#types/attackHeldPlan.d.ts';
import type { HeldChange } from '#types/heldChange.d.ts';
import type { AttackDelivery } from '#utils/damage/attackDelivery.js';
import { createBonusDamageNode } from '#utils/treeManipulation/createBonusDamageNode.js';
import { removeDisadvantage } from '../../managers/itemActivation/keptAmountActivation.js';
import {
	heldAdvantageForAttack,
	heldChangeKey,
	heldChangesForAttack,
	heldExtraDamageForAttack,
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
	/** How the attack is delivered (`deliveryOfAttack`); none fits no melee-only or ranged-only change. */
	delivery?: AttackDelivery;
	/** The roll is an attack roll. Only an attack roll uses Primary Die changes and ignores disadvantage. */
	attack: boolean;
	/** The amount the roll keeps in place of dice, or null when it rolls. */
	kept?: HeldChange | null;
	/** The kept amount this attack ends, used or not. */
	keptToEnd?: HeldChange | null;
	/** The roll has no disadvantage of its own to take out (max damage, or it ignores it already). */
	noDisadvantageToIgnore?: boolean;
	/** The card shows the extra damage parts, so the attack uses and spends them. */
	extraDamage?: boolean;
	/**
	 * The keys (`heldChangeKey`) of the changes the player ticked. With a set, only those apply and
	 * are spent; with none, every change that fits applies.
	 */
	chosen?: ReadonlySet<string> | null;
}

/** Each extra damage part as its own damage node with a hit outcome, so a miss deals none of it. */
async function rollExtraDamage(changes: HeldChange[], rollData: Record<string, unknown>) {
	const parts: { node: ReturnType<typeof createBonusDamageNode>; roll: Roll }[] = [];
	for (const change of changes) {
		const formula = change.formula?.trim() ?? '';
		try {
			const roll = new Roll(formula, rollData) as Roll;
			await roll.evaluate();
			parts.push({
				node: createBonusDamageNode({
					damageType: change.damageType ?? '',
					formula,
					roll: roll.toJSON() as Record<string, unknown>,
				}),
				roll,
			});
		} catch (error) {
			console.warn(
				`Nimble | Could not roll the extra damage "${formula}" of ${change.label}.`,
				error,
			);
		}
	}
	return parts;
}

function planOf(
	parts: Pick<
		AttackHeldPlan,
		| 'primaryDie'
		| 'advantage'
		| 'maximize'
		| 'ignoreDisadvantage'
		| 'mustAttackOther'
		| 'extraDamage'
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
		rollExtraDamage: (rollData) => rollExtraDamage(parts.extraDamage, rollData),
		withoutPrimaryDie: () => planOf({ ...parts, primaryDie: [] }, keptToEnd),
		spend: (lines) =>
			spendHeldChanges(
				[
					...parts.primaryDie,
					...parts.advantage,
					parts.maximize,
					parts.ignoreDisadvantage,
					keptToEnd,
					parts.mustAttackOther,
					...parts.extraDamage,
				].filter((change): change is HeldChange => !!change),
				lines,
			),
	};
	return plan;
}

/**
 * The Held Changes one attack uses. A kept amount replaces the roll, so the
 * roll uses no Primary Die change and has no disadvantage to take out.
 * Ignoring disadvantage also ignores the negative Primary Die changes.
 * Advantage changes add their steps to the roll mode; a maximize change rolls every die at its
 * highest number. An extra damage change goes on any attack of the holder, kept amount or not.
 */
function attackHeldPlanOf(input: AttackHeldInput): AttackHeldPlan {
	const kept = input.kept ?? null;
	const chosen = input.chosen ?? null;
	const ticked = (change: HeldChange | null) =>
		change && (!chosen || chosen.has(heldChangeKey(change))) ? change : null;
	const allTicked = (changes: HeldChange[]) =>
		chosen ? changes.filter((change) => chosen.has(heldChangeKey(change))) : changes;
	const ignoreDisadvantage =
		input.attack && !kept && !input.noDisadvantageToIgnore
			? ticked(ignoreDisadvantageChange(input.attacker))
			: null;
	const rolls = input.attack && !kept;
	const attack = {
		attacker: input.attacker,
		target: input.target,
		area: input.area,
		delivery: input.delivery,
	};
	return planOf(
		{
			primaryDie: rolls
				? allTicked(heldChangesForAttack({ ...attack, ignoresNegative: !!ignoreDisadvantage }))
				: [],
			advantage: rolls ? allTicked(heldAdvantageForAttack(attack)) : [],
			maximize: rolls ? ticked(heldMaximizeForAttack(attack)) : null,
			ignoreDisadvantage,
			mustAttackOther: ticked(mustAttackOtherChange(input.attacker)),
			extraDamage:
				input.attack && input.extraDamage ? allTicked(heldExtraDamageForAttack(attack)) : [],
		},
		input.keptToEnd ?? null,
	);
}

export { attackHeldPlanOf };
