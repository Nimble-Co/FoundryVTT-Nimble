import type { ConditionNode } from '#types/effectTree';

/**
 * Creates a new ConditionNode object.
 *
 * @param   parentNode    - The ID of the parent node, if any.
 * @param   context       - The context in which the node is created, if any.
 * @param   condition - The type of condition to be applied. Defaults to 'blinded'.
 *
 * @returns The newly created ConditionNode object.
 */
export function createConditionNode(
	parentNode: string | null = null,
	context: string | null = null,
	condition = 'blinded',
): ConditionNode {
	return {
		id: foundry.utils.randomID(),
		type: 'condition',
		condition,
		parentContext: context,
		parentNode,
	};
}
