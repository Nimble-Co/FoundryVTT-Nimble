import type { DamageNode, EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from './treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from './treeManipulation/reconstructEffectsTree.js';

interface DeferredDamageResult {
	activation: Record<string, unknown>;
	rolls: string[];
}

/**
 * Attach an on-demand damage roll to the node that asked for it, returning the
 * patched activation tree and message `rolls` source. Both move together
 * because a card's node roll and its `rolls` entry must stay in lockstep.
 *
 * Deferred damage is the only damage a card posts unrolled, so this is also
 * where a second Roll Damage click is refused: a node that already carries a
 * roll returns null rather than replacing it, which keeps two clients racing
 * the same button from rerolling damage the GM may already have applied.
 *
 * Returns null when the node is gone, is not deferred damage, or was rolled
 * already, letting callers abort before writing to the message.
 */
export function buildDeferredDamagePatch(
	activation: Record<string, unknown>,
	rollsSource: string[],
	nodeId: string,
	serializedRoll: Record<string, unknown>,
): DeferredDamageResult | null {
	const nodes = flattenEffectsTree((activation.effects ?? []) as EffectNode[]);
	const damageNode = nodes.find(
		(node): node is DamageNode => node.type === 'damage' && node.id === nodeId,
	);

	if (!damageNode?.deferredRoll) return null;
	if (damageNode.roll?.class) return null;

	damageNode.roll = serializedRoll;

	return {
		activation: { ...activation, effects: reconstructEffectsTree(nodes) as unknown[] },
		rolls: [...rollsSource, JSON.stringify(serializedRoll)],
	};
}
