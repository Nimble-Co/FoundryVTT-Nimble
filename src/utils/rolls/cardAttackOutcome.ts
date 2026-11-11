import type { EffectNode } from '#types/effectTree.js';
import { critTriggerOutcome } from '#utils/reroll/firesCritTriggers.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { pendingKeepOf } from './cardRollState.js';

interface AttackCardSystem {
	activation?: { effects?: EffectNode[] } | null;
	isCritical?: boolean;
	isMiss?: boolean;
	discardedCritTriggers?: boolean;
}

function rollsDamage(system: AttackCardSystem): boolean {
	return flattenEffectsTree(system.activation?.effects ?? []).some(
		(node) => node.type === 'damage' && !node.deferredRoll,
	);
}

/**
 * The outcome of the attack roll on an item card, as triggers read it. Null when the card rolls
 * no damage, or while a Keep a Result waits on it.
 */
export function cardAttackOutcome(
	card: { system?: unknown } | null | undefined,
): { isCritical: boolean; isMiss: boolean } | null {
	const system = (card?.system ?? null) as AttackCardSystem | null;
	if (!system || pendingKeepOf(system) || !rollsDamage(system)) return null;
	return critTriggerOutcome({
		isCritical: system.isCritical === true,
		isMiss: system.isMiss === true,
		discardedCritTriggers: system.discardedCritTriggers === true,
	});
}
