import type { EffectNode } from '#types/effectTree.js';
import { findNodesByContexts } from '../../../utils/treeManipulation/findNodesByContexts.js';
import { groupNodes } from './groupNodes.js';
import { processNodes } from './processNodes.js';

export interface GetRelevantNodesOptions {
	fullTree?: EffectNode[] | null;
	includeBaseDamageNodes?: boolean;
}

export function getRelevantNodes(
	effects: EffectNode[],
	contexts: string[],
	options: GetRelevantNodesOptions = {},
): EffectNode[][] {
	const { fullTree = null, includeBaseDamageNodes = false } = options;

	const relevantNodes = findNodesByContexts(effects, contexts, false, includeBaseDamageNodes);

	// The full tree must be used here if possible to ensure the locate parent rolls.
	const processedNodes = processNodes(fullTree ?? effects, relevantNodes);
	const groupedNodes = groupNodes(processedNodes);

	return groupedNodes;
}
