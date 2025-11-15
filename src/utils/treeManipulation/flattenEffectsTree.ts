import type { ActionConsequence, EffectNode } from '#types/effectTree';

export function flattenEffectsTree(
	nodes: EffectNode[],
	parentNode: string | null = null,
	parentContext: string | null = null,
): EffectNode[] {
	if (!nodes) return [];

	const flattened: EffectNode[] = [];

	for (const node of nodes) {
		const newNode = foundry.utils.deepClone(node);
		newNode.parentContext = parentContext;
		newNode.parentNode = parentNode;
		flattened.push(newNode);

		if (newNode.type === 'damage' || newNode.type === 'savingThrow') {
			newNode.on ??= {};

			if (newNode.on.failedSaveBy) {
				for (const [failDegree, nodeArray] of Object.entries(newNode.on.failedSaveBy)) {
					flattened.push(
						...flattenEffectsTree(nodeArray ?? [], newNode.id, `failedSaveBy${failDegree}`),
					);
				}

				delete newNode.on.failedSaveBy;
			}

			for (const [context, nodeArray] of Object.entries(
				newNode.on as Omit<ActionConsequence, 'failedSaveBy'>,
			)) {
				flattened.push(...flattenEffectsTree(nodeArray ?? [], newNode.id, context));
			}

			delete newNode.on;
		}

		if (newNode.type === 'savingThrow') {
			flattened.push(...flattenEffectsTree(newNode.sharedRolls ?? [], newNode.id, 'sharedRolls'));

			delete newNode.sharedRolls;
		}
	}

	return flattened;
}
