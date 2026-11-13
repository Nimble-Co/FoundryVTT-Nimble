import type { EffectNode } from '#types/effectTree.js';
import { itemEffectUsers } from './itemEffectUsers.js';

interface ItemLike {
	name?: string | null;
	img?: string | null;
	system?: unknown;
	effects?: { get(id: string): unknown } | null;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

interface EffectLike {
	name?: string | null;
	img?: string | null;
	description?: string | null;
	statuses?: Set<string>;
	system?: {
		changes?: unknown[];
		rules?: unknown[];
		lastsUntil?: unknown[];
		escape?: { dc?: string; noDc?: boolean; skills?: string[] };
		tempHp?: number | null;
	};
}

/** The effect is as a new Apply Effect node made it: the item's name and image, nothing set. */
export function isUntouchedItemEffect(effect: EffectLike, item: ItemLike): boolean {
	const system = effect.system ?? {};
	return (
		effect.name === item.name &&
		effect.img === item.img &&
		!effect.description &&
		!effect.statuses?.size &&
		!system.changes?.length &&
		!system.rules?.length &&
		!system.lastsUntil?.length &&
		!system.escape?.dc &&
		!system.escape?.noDc &&
		!system.escape?.skills?.length
	);
}

/**
 * After a node or a rule field moves off `effectId`, delete that item effect when no node and no
 * rule field points at it and the author did not change it. An effect the author built stays.
 */
export async function deleteLeftItemEffect(
	item: ItemLike,
	tree: EffectNode[],
	effectId: string | null,
): Promise<void> {
	if (!effectId) return;
	const used = itemEffectUsers(item, effectId, tree).length > 0;
	const effect = item.effects?.get(effectId) as EffectLike | undefined;
	if (used || !effect || !isUntouchedItemEffect(effect, item)) return;
	await item.deleteEmbeddedDocuments('ActiveEffect', [effectId]);
}
