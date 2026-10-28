import type { EffectNode } from '#types/effectTree.js';
import type { RollChange } from '../incomingReactions/incomingReactionEntry.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '../treeManipulation/reconstructEffectsTree.js';

interface FoldResult {
	activation: Record<string, unknown>;
	rolls: string[];
}

/**
 * Swap the card's serialized DamageRoll into the message `rolls` source,
 * appending when the card does not carry one yet. A card's node roll and its
 * `rolls` entry have to move together or the two render out of step.
 */
export function replaceDamageRollInRollsSource(
	rollsSource: string[],
	serializedRoll: Record<string, unknown>,
): string[] {
	const rolls = [...rollsSource];
	const rollIndex = rolls.findIndex((entry) => {
		try {
			return (JSON.parse(entry) as { class?: string })?.class === 'DamageRoll';
		} catch {
			return false;
		}
	});
	const stringified = JSON.stringify(serializedRoll);
	if (rollIndex >= 0) rolls[rollIndex] = stringified;
	else rolls.push(stringified);
	return rolls;
}

/**
 * Append a flat bonus to a serialized damage roll as a *flavored* numeric term,
 * matching how banked dice-pool contributions already ship, so
 * `getDiceDamageTotal` counts it as dice rather than as an armor-ignoring
 * modifier.
 *
 * `total` is patched directly rather than recomputed from terms: the roll is
 * already evaluated, and `DamageRoll.fromData` prefers the serialized total, so
 * reconstruction keeps crit and primary-die state intact.
 */
export function appendFlavoredBonusToRoll(
	serializedRoll: Record<string, unknown>,
	amount: number,
	flavor: string,
): Record<string, unknown> {
	const serialized = { ...serializedRoll };
	const terms = Array.isArray(serialized.terms) ? [...(serialized.terms as unknown[])] : [];
	terms.push(
		{ class: 'OperatorTerm', operator: '+', evaluated: true, options: {} },
		{ class: 'NumericTerm', number: amount, evaluated: true, options: { flavor } },
	);
	serialized.terms = terms;
	serialized.total = Number(serialized.total ?? 0) + amount;
	return serialized;
}

/** The roll with the extra damage roll changes in `changes` appended, each named by its source. */
export function appendExtraDamageToRoll(
	serializedRoll: Record<string, unknown>,
	changes: readonly RollChange[],
): Record<string, unknown> {
	return changes
		.filter((change) => change.kind === 'extraDamage')
		.reduce(
			(roll, change) => appendFlavoredBonusToRoll(roll, change.value, change.label),
			serializedRoll,
		);
}

/**
 * The roll without its last `count` bonuses that `appendFlavoredBonusToRoll`
 * folded in, and without their amounts in its total. Stops at the first term
 * pair that is not one.
 */
export function removeFlavoredBonusesFromRoll(
	serializedRoll: Record<string, unknown>,
	count: number,
): Record<string, unknown> {
	const terms = Array.isArray(serializedRoll.terms) ? [...(serializedRoll.terms as unknown[])] : [];
	let total = Number(serializedRoll.total ?? 0);
	for (let removed = 0; removed < count && terms.length >= 2; removed++) {
		const operator = terms[terms.length - 2] as { class?: string; operator?: string };
		const bonus = terms[terms.length - 1] as { class?: string; options?: { flavor?: unknown } };
		const folded =
			operator?.class === 'OperatorTerm' &&
			operator.operator === '+' &&
			bonus?.class === 'NumericTerm' &&
			typeof bonus.options?.flavor === 'string';
		if (!folded) break;
		total -= Number((bonus as { number?: unknown }).number) || 0;
		terms.length -= 2;
	}
	return { ...serializedRoll, terms, total };
}

/**
 * The card's primary damage node: the first one carrying an evaluated
 * `DamageRoll`. Shared so the fold path and the typed-packet path cannot
 * disagree about which node a spend attaches to.
 */
export function findPrimaryDamageNode(
	nodes: EffectNode[],
): (EffectNode & { roll?: Record<string, unknown> }) | undefined {
	return nodes.find(
		(node) =>
			node.type === 'damage' &&
			(node as { roll?: { class?: string } }).roll?.class === 'DamageRoll',
	) as (EffectNode & { roll?: Record<string, unknown> }) | undefined;
}

/**
 * Add a flat bonus to an activation card's primary damage roll, returning the
 * patched activation tree and message `rolls` source. Both are updated together
 * because a card's node roll and its `rolls` entry must stay in lockstep.
 *
 * The bonus is appended as a *flavored* numeric term (see
 * `appendFlavoredBonusToRoll`), matching how banked dice-pool contributions
 * already ship, so `getDiceDamageTotal` counts it as dice rather than as an
 * armor-ignoring modifier.
 *
 * Note this only bites for a non-crit offer against Medium/Heavy monster
 * armor: `calculateArmorAdjustedDamage` returns a crit's total before it ever
 * splits dice from modifiers. The rulebooks say Fury Dice "are dice when
 * calculating damage for monster armor" (Heroes-2) but that is about the die
 * added to an attack, and they do not say how a *derived* amount such as Death
 * Blow's doubled sum should be treated. Counting it as dice is the consistent
 * reading, not a settled one.
 *
 * Returns null when the card carries no primary damage roll to add to, letting
 * callers abort before charging the player for the spend.
 */
export function foldBonusIntoPrimaryDamage(
	activation: Record<string, unknown>,
	rollsSource: string[],
	amount: number,
	flavor: string,
): FoldResult | null {
	const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
	const damageNode = findPrimaryDamageNode(nodes);
	if (!damageNode?.roll) return null;

	const serialized = appendFlavoredBonusToRoll(damageNode.roll, amount, flavor);
	damageNode.roll = serialized;

	const patchedActivation = { ...activation, effects: reconstructEffectsTree(nodes) as unknown[] };

	return {
		activation: patchedActivation,
		rolls: replaceDamageRollInRollsSource(rollsSource, serialized),
	};
}
