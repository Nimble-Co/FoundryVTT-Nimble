import type { DamageNode } from '#types/effectTree.js';

/** Deferred damage whose Roll Damage button has not been pressed yet. */
export function isAwaitingDeferredRoll(node: Pick<DamageNode, 'deferredRoll' | 'roll'>): boolean {
	return node.deferredRoll === true && !node.roll?.class;
}
