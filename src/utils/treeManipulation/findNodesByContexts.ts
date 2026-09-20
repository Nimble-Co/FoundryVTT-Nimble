import type { EffectNode } from '#types/effectTree.d.js';
import { hasDispositionTarget } from './hasDispositionTarget.js';

/**
 * Traverses the tree and collects nodes based on the specified contexts.
 *
 * @param   nodes    - The tree nodes to traverse.
 * @param   contexts - The contexts to search for (e.g., hit, miss, critical hit).
 *
 * @returns An array of nodes that match any of the specified contexts.
 */
export function findNodesByContexts(
	nodes: EffectNode[],
	contexts: string[],
	includeBaseNodes = false,
	includeBaseDamageNodes = false,
): EffectNode[] {
	const result: EffectNode[] = [];

	function traverse(node: EffectNode) {
		if (!node.parentNode) {
			if (node.type === 'damage') {
				// An outcome child carries the same roll, so a node that has one for
				// this context is already on the card and must not be added again.
				// Only an outcome child stands in for the roll: a condition, a note or
				// a second damage packet in the same bucket says nothing about it.
				const surfacedByOutcome = contexts.some((context) =>
					node.on?.[context]?.some((child) => child.type === 'damageOutcome'),
				);

				// Deferred damage that has not landed yet has no roll for an outcome
				// child to stand in with, and its Roll Damage button lives on the node
				// itself. Mirrors `awaitingRoll` in DamageNode.svelte.
				const awaitingDeferredRoll = node.deferredRoll === true && !node.roll?.class;

				// Disposition-targeted damage is a deliberate UI action, always present it.
				const standsAlone =
					hasDispositionTarget(node) || node.deferredRoll || includeBaseDamageNodes;

				if (awaitingDeferredRoll || (!surfacedByOutcome && standsAlone)) result.push(node);
			} else if (!includeBaseNodes) {
				result.push(node);
			}
		}

		if (node.type === 'damage' || node.type === 'savingThrow') {
			if (node.on) {
				for (const context of contexts) {
					if (node.on[context]) {
						result.push(...node.on[context]);
					}
				}
			}
		}

		if (node.type === 'savingThrow' && node.sharedRolls) {
			for (const sharedRoll of node.sharedRolls) {
				traverse(sharedRoll);
			}
		}

		if (node.type === 'damage' && node.on) {
			for (const key in node.on) {
				if (Object.hasOwn(node.on, key)) {
					for (const childNode of node.on[key]) {
						traverse(childNode);
					}
				}
			}
		}
	}

	for (const node of nodes) {
		traverse(node);
	}

	return result;
}
