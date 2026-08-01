import type { DamageNode } from '#types/effectTree.js';
import { createDamageOutcomeNode } from './createDamageOutcomeNode.js';

/**
 * Build a damage node for an amount derived from damage that has already been
 * rolled, carrying its own damage type so it applies as a second packet rather
 * than being mislabelled as the type of the damage it rides along with.
 *
 * `parentNode` / `parentContext` place it beside the node it derives from, so
 * it reaches the card and resolves the same way that node does. The outcome
 * children follow from that placement, mirroring `createDamageNode`:
 *
 * - A root node gets a `hit` child. Without one it never surfaces at all:
 *   `findNodesByContexts` collects a bare root damage node only when it carries
 *   a `targetDisposition`, or when base damage nodes are explicitly requested,
 *   which the card only does on a miss.
 * - A node under `sharedRolls` gets both save outcomes, so a passed save halves
 *   it exactly as it halves the damage it accompanies.
 * - A node hung directly under a save context (`on.failedSave`) surfaces with
 *   that context and needs no children of its own.
 *
 * `canCrit` and `canMiss` are false to record that the amount already accounts
 * for how the attack landed. They are descriptive here rather than load
 * bearing: only `ItemActivationManager` reads them, and only off the first
 * damage node while building its `DamageRoll`, which this node never is.
 */
export function createBonusDamageNode(params: {
	damageType: string;
	formula: string;
	roll: Record<string, unknown>;
	parentNode?: string | null;
	parentContext?: string | null;
}): DamageNode {
	const id = foundry.utils.randomID();
	const parentNode = params.parentNode ?? null;
	const parentContext = params.parentContext ?? null;

	const node: DamageNode = {
		id,
		type: 'damage',
		damageType: params.damageType,
		formula: params.formula,
		canCrit: false,
		canMiss: false,
		parentContext,
		parentNode,
		roll: params.roll,
	};

	if (!parentNode) {
		node.on = { hit: [createDamageOutcomeNode(id, 'hit')] };
	} else if (parentContext === 'sharedRolls') {
		node.on = {
			failedSave: [createDamageOutcomeNode(id, 'failedSave')],
			passedSave: [createDamageOutcomeNode(id, 'passedSave')],
		};
	}

	return node;
}
