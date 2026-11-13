import type { ItemEffectSelectItem } from '#types/components/ItemEffectSelect.d.ts';

/** The Stacks fields of the effect window, with the defaults of an older effect. */
export interface StackFieldsView {
	on: boolean;
	count: number;
	at: number | null;
	effectId: string;
}

export function stackFieldsOf(system: unknown): StackFieldsView {
	const stacks = (system as { stacks?: Partial<StackFieldsView> } | null | undefined)?.stacks;
	return {
		on: stacks?.on === true,
		count: Math.max(1, Number(stacks?.count) || 1),
		at: typeof stacks?.at === 'number' ? stacks.at : null,
		effectId: stacks?.effectId ?? '',
	};
}

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
