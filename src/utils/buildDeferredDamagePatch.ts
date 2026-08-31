import type { DamageNode, EffectNode } from '#types/effectTree.js';
import { replaceDamageRollInRollsSource } from './foldBonusIntoPrimaryDamage.js';
import { flattenEffectsTree } from './treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from './treeManipulation/reconstructEffectsTree.js';

interface DeferredDamageResult {
	activation: Record<string, unknown>;
	rolls: string[];
}

/**
 * The one statement of what a Roll Damage click may still roll: deferred damage
 * that has not been rolled yet. The already-rolled arm is what refuses a second
 * click. Both exports below go through this so the rule cannot drift between
 * the caller's pre-check and the patch's own refusal.
 */
function findRollableNode(nodes: EffectNode[], nodeId: string): DamageNode | null {
	const damageNode = nodes.find(
		(node): node is DamageNode => node.type === 'damage' && node.id === nodeId,
	);

	if (!damageNode?.deferredRoll) return null;
	if (damageNode.roll?.class) return null;

	return damageNode;
}

/**
 * The node a Roll Damage click may still roll, or null.
 *
 * Exported so the caller can read the formula off the same node this module
 * will later patch instead of restating the eligibility rule beside it. What
 * comes back is a clone — `flattenEffectsTree` deep-clones every node — so
 * writing to it changes nothing the card renders, and the patch below re-runs
 * the check anyway because the caller rolls dice in between.
 */
export function findRollableDeferredDamageNode(
	activation: Record<string, unknown>,
	nodeId: string,
): DamageNode | null {
	return findRollableNode(flattenEffectsTree((activation.effects ?? []) as EffectNode[]), nodeId);
}

/**
 * Attach an on-demand damage roll to the node that asked for it, returning the
 * patched activation tree and message `rolls` source. Both move together
 * because a card's node roll and its `rolls` entry must stay in lockstep.
 *
 * Returns null on exactly the conditions `findRollableNode` refuses, so a click
 * that raced another one writes nothing rather than replacing a roll the GM may
 * already have applied.
 */
export function buildDeferredDamagePatch(
	activation: Record<string, unknown>,
	rollsSource: string[],
	nodeId: string,
	serializedRoll: Record<string, unknown>,
): DeferredDamageResult | null {
	const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
	const damageNode = findRollableNode(nodes, nodeId);
	if (!damageNode) return null;

	damageNode.roll = serializedRoll;

	return {
		activation: { ...activation, effects: reconstructEffectsTree(nodes) as unknown[] },
		rolls: replaceDamageRollInRollsSource(rollsSource, serializedRoll),
	};
}
