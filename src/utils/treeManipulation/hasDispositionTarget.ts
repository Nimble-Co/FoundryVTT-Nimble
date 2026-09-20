import type { EffectNodeDisposition } from '#types/effectTree.js';

/**
 * Whether a node is aimed at a particular kind of target. `any` is the option
 * the config sheet shows when nothing has been chosen, so it is stored like a
 * choice but means the same as no choice at all.
 */
export function hasDispositionTarget<T extends { targetDisposition?: EffectNodeDisposition }>(
	node: T,
): node is T & { targetDisposition: Exclude<EffectNodeDisposition, 'any'> } {
	return node.targetDisposition != null && node.targetDisposition !== 'any';
}
