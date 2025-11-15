import type { DamageOutcomeNode } from '#types/effectTree';

export function createDamageOutcomeNode(parentNode: string, context: string): DamageOutcomeNode {
	let outcome: 'fullDamage' | 'halfDamage' = 'fullDamage';

	if (context === 'passedSave') {
		outcome = 'halfDamage';
	}

	return {
		id: foundry.utils.randomID(),
		type: 'damageOutcome',
		outcome,
		parentContext: context,
		parentNode,
	};
}
