import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
import type { NimbleBaseItem } from '#documents/item/base.svelte.js';

/** A document that holds rules in `system.rules`: an item or an Active Effect. */
export type RuleHolder = NimbleBaseItem | NimbleActiveEffect;

export function isEffectHolder(holder: RuleHolder): holder is NimbleActiveEffect {
	return holder.documentName === 'ActiveEffect';
}

/** The actor whose data the rules read: the item's owner, or the actor that holds the effect. */
export function actorOfRuleHolder(holder: RuleHolder | null | undefined): Actor | null {
	if (!holder) return null;
	if (!isEffectHolder(holder)) return (holder.actor as Actor | null) ?? null;
	const parent = holder.parent as { documentName?: string; actor?: Actor | null } | null;
	if (parent?.documentName === 'Actor') return parent as unknown as Actor;
	return parent?.actor ?? null;
}
