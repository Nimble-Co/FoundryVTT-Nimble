import type { DamageNode } from '#types/effectTree.js';
import { createDamageOutcomeNode } from './createDamageOutcomeNode.js';

export function createDamageNode(
	parentNode: string | null = null,
	context: string | null = null,
): DamageNode {
	const newNodeId = foundry.utils.randomID();

	const data: DamageNode = {
		id: newNodeId,
		type: 'damage',
		damageType: 'bludgeoning',
		formula: '',
		parentContext: context,
		parentNode,
	};

	if (!parentNode) {
		const defaultDamageOutcome = createDamageOutcomeNode(newNodeId, 'hit');

		data.on ??= {};
		data.on.hit = [defaultDamageOutcome];
		data.canCrit = true;
		data.canMiss = true;
	}

	if (context === 'sharedRolls') {
		const defaultFailedSaveDamageOutcome = createDamageOutcomeNode(newNodeId, 'failedSave');
		const defaultPassedSaveDamageOutcome = createDamageOutcomeNode(newNodeId, 'passedSave');

		data.on ??= {};
		data.on.failedSave = [defaultFailedSaveDamageOutcome];
		data.on.passedSave = [defaultPassedSaveDamageOutcome];
	}

	return data;
}
