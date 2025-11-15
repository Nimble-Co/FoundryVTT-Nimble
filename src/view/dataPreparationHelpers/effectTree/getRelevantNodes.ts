import type { EffectNode } from '#types/effectTree';
import { findNodesByContexts } from '../../../utils/treeManipulation/findNodesByContexts';
import { groupNodes } from './groupNodes';
import { processNodes } from './processNodes';

export function getRelevantNodes(
	effects: EffectNode[],
	contexts: string[],
	fullTree: EffectNode[] | null = null,
): EffectNode[][] {
	const relevantNodes = findNodesByContexts(effects, contexts);

	// The full tree must be used here if possible to ensure the locate parent rolls.
	const processedNodes = processNodes(fullTree ?? effects, relevantNodes);
	const groupedNodes = groupNodes(processedNodes);

	return groupedNodes;
}
