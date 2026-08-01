import type { EffectNode } from '#types/effectTree.js';
import { findPrimaryDamageNode } from './foldBonusIntoPrimaryDamage.js';
import { createBonusDamageNode } from './treeManipulation/createBonusDamageNode.js';
import { flattenEffectsTree } from './treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from './treeManipulation/reconstructEffectsTree.js';

interface TypedBonusResult {
	activation: Record<string, unknown>;
	rolls: string[];
}

/**
 * Add a typed bonus to an activation card as its own damage packet, returning
 * the patched activation tree and message `rolls` source. Both move together
 * because a card's node roll and its `rolls` entry must stay in lockstep.
 *
 * One node carries one damage type, so a bonus that deals something other than
 * the attack's own type cannot be folded into the attack's roll without being
 * mislabelled. The cost of a separate packet is that the target's flat
 * reduction and resistance resolve against it on its own; that is the answer
 * the engine already gives everywhere else damage arrives as more than one
 * node.
 *
 * The packet lands beside the damage it derives from rather than always at the
 * root, so a spend on a saving-throw card resolves against the save instead of
 * applying in full regardless of it.
 *
 * The bonus amount is carried as a *flavored* numeric term so the roll tooltip
 * credits the feature that produced it. Unlike the fold path the flavor does
 * not change the armor maths here: this roll's only term is the bonus, so
 * `getDiceDamageTotal` reaches the same number whether it reads it as dice or
 * falls back to the roll total.
 *
 * `isCritical` is stamped to match the card. `calculateArmorAdjustedDamage`
 * returns a crit's total unhalved but sends a non-crit through heavy-armor
 * halving, so without this the same feature would deal two different amounts
 * against heavy armor purely because of the damage type it was given.
 *
 * Returns null when the card carries no primary damage roll to ride along
 * with, letting callers abort before charging the player for the spend.
 */
export function appendTypedBonusDamage(
	activation: Record<string, unknown>,
	rollsSource: string[],
	serializedRoll: Record<string, unknown>,
	options: { damageType: string; flavor: string; isCritical: boolean },
): TypedBonusResult | null {
	const terms = Array.isArray(serializedRoll.terms) ? serializedRoll.terms : [];
	const roll: Record<string, unknown> = {
		...serializedRoll,
		isCritical: options.isCritical,
		terms: terms.map((term) => {
			const serializedTerm = term as { class?: string; options?: Record<string, unknown> };
			if (serializedTerm.class !== 'NumericTerm') return term;
			return {
				...serializedTerm,
				options: { ...(serializedTerm.options ?? {}), flavor: options.flavor },
			};
		}),
	};

	const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
	const primaryDamageNode = findPrimaryDamageNode(nodes);
	if (!primaryDamageNode) return null;

	const bonusNode = createBonusDamageNode({
		damageType: options.damageType,
		formula: typeof serializedRoll.formula === 'string' ? serializedRoll.formula : '',
		roll,
		parentNode: primaryDamageNode.parentNode,
		parentContext: primaryDamageNode.parentContext,
	});

	// Flattened under the same parent, so the node and its outcome children enter
	// the list the same way every other node did before `reconstructEffectsTree`
	// rebuilds it. Flattening from the root would reset the parent links.
	nodes.push(...flattenEffectsTree([bonusNode], bonusNode.parentNode, bonusNode.parentContext));

	return {
		activation: { ...activation, effects: reconstructEffectsTree(nodes) as unknown[] },
		rolls: [...rollsSource, JSON.stringify(roll)],
	};
}
