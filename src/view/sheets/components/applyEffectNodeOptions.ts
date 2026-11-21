import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

/** Temp healing nodes of the same tree, for the temp HP that the effect gives and takes back. */
export function tempHealingOptions(tree: EffectNode[]): { id: string; formula: string }[] {
	return flattenEffectsTree(tree).flatMap((node) =>
		node.type === 'healing' && node.healingType === 'tempHealing'
			? [{ id: node.id, formula: node.formula }]
			: [],
	);
}

/** Move nodes of the same tree, for the move that the effect gives. */
export function moveOptions(tree: EffectNode[]): { id: string; kind: string; distance: string }[] {
	return flattenEffectsTree(tree).flatMap((node) =>
		node.type === 'move' ? [{ id: node.id, kind: node.kind, distance: node.distance }] : [],
	);
}
