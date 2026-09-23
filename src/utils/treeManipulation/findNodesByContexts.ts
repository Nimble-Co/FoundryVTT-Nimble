import type { DamageNode, EffectNode } from '#types/effectTree.d.js';
import { isAwaitingDeferredRoll } from './isAwaitingDeferredRoll.js';

/**
 * Whether an outcome child already carries this node's roll onto the card.
 * Only an outcome child stands in for the roll: a condition, a note or a
 * second damage packet in the same bucket says nothing about it.
 */
function isSurfacedByOutcomeChild(node: DamageNode, contexts: string[]): boolean {
	return contexts.some((context) =>
		node.on?.[context]?.some((child) => child.type === 'damageOutcome'),
	);
}

/**
 * Whether a damage node must reach the card in its own right. Deferred damage
 * that has not landed yet has no roll for an outcome child to stand in with,
 * and its Roll Damage button lives on the node itself.
 */
function needsItsOwnEntry(node: DamageNode, contexts: string[]): boolean {
	return isAwaitingDeferredRoll(node) || !isSurfacedByOutcomeChild(node, contexts);
}

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
				// A stored disposition, "Any" included, is a deliberate UI action:
				// present the node whenever nothing else surfaces its roll.
				const standsAlone =
					node.targetDisposition != null || node.deferredRoll || includeBaseDamageNodes;

				if (isAwaitingDeferredRoll(node) || (standsAlone && needsItsOwnEntry(node, contexts))) {
					result.push(node);
				}
			} else if (!includeBaseNodes) {
				result.push(node);
			}
		}

		if (node.type === 'damage' || node.type === 'savingThrow') {
			if (node.on) {
				// Every outcome child carries the same parent roll. The first context
				// that holds one wins; later contexts keep their other children.
				let outcomeSurfaced = false;

				for (const context of contexts) {
					const children = node.on[context] ?? [];
					const hasOutcome = children.some((child) => child.type === 'damageOutcome');

					for (const child of children) {
						// A nested damage node reaches the card through its own outcome
						// child, exactly as a root one does. Pushing both would draw the
						// roll twice and apply it twice.
						if (child.type === 'damage' && !needsItsOwnEntry(child, contexts)) continue;
						if (child.type === 'damageOutcome' && outcomeSurfaced) continue;

						result.push(child);
					}

					outcomeSurfaced ||= hasOutcome;
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
