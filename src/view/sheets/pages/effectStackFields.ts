import type { ItemEffectSelectItem } from '#types/components/ItemEffectSelect.d.ts';

/** "At [N] stacks": a whole number of 2 or more; blank or less is no count. */
export function stackAtUpdate(text: string): Record<string, unknown> {
	const whole = Math.floor(Number(text));
	return { 'system.stacks.at': text.trim() && whole >= 2 ? whole : null };
}

/** "Stacks now": a whole number of 1 or more. */
export function stackCountUpdate(text: string): Record<string, unknown> {
	const whole = Math.floor(Number(text));
	return { 'system.stacks.count': Number.isFinite(whole) && whole >= 1 ? whole : 1 };
}

interface StackEffectDocument {
	parent?: { documentName?: string | null } | null;
	origin?: string | null;
}

/** The item whose effects the "they gain" select lists: the effect's item, or its origin item. */
export function stackEffectItem(effect: StackEffectDocument): ItemEffectSelectItem | null {
	if (effect.parent?.documentName === 'Item') return effect.parent as ItemEffectSelectItem;
	if (!effect.origin) return null;
	const origin = fromUuidSync(effect.origin as never, { strict: false });
	return origin instanceof Item ? (origin as unknown as ItemEffectSelectItem) : null;
}
