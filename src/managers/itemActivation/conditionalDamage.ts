import type { ConditionalDamage } from '#types/conditionalDamage.d.ts';
import type { DamageNode } from '#types/effectTree.js';
import { createBonusDamageNode } from '../../utils/treeManipulation/createBonusDamageNode.js';

/**
 * Each conditional damage with a type of its own, rolled as its own damage. The roll window
 * adds untyped conditional damage to the main formula.
 */
export async function rollConditionalDamage(
	actor: { getRollData(): Record<string, unknown> },
	conditionals: readonly ConditionalDamage[],
): Promise<Array<{ node: DamageNode; roll: Roll }>> {
	const parts: Array<{ node: DamageNode; roll: Roll }> = [];
	for (const conditional of conditionals) {
		const formula = conditional.formula?.trim();
		if (!formula) continue;
		const roll = new Roll(formula, actor.getRollData()) as Roll;
		await roll.evaluate();
		const node = createBonusDamageNode({
			damageType: conditional.damageType,
			formula,
			roll: roll.toJSON() as Record<string, unknown>,
			fromItemIdentifier: conditional.fromItemIdentifier,
			source: { label: conditional.label, uuid: conditional.itemUuid ?? '' },
		});
		if (conditional.modifierOnly) node.modifierOnly = true;
		parts.push({ node, roll });
	}
	return parts;
}
