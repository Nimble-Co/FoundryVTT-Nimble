import { getPools } from './dicePoolSync.js';
import type { DicePoolState } from './types.js';

interface EmptyPoolsRuleLike {
	type?: string;
	disabled?: boolean;
	poolIdentifiers?: string[];
	appliesTo?: () => boolean;
}

/** An effect as the pool lookup reads it: its holder, its origin, and its prepared rules. */
export interface EndingEffect {
	parent?: unknown;
	origin?: string | null;
	rules?: { values(): Iterable<unknown> } | null;
}

interface ItemLike {
	id?: string | null;
	isEmbedded?: boolean;
	actor?: unknown;
}

function ownerOf(item: ItemLike): Actor | null {
	if (!item.isEmbedded) return null;
	return item.actor instanceof Actor ? item.actor : null;
}

function holderOf(effect: EndingEffect): Actor | null {
	if (effect.parent instanceof Actor) return effect.parent;
	if (effect.parent instanceof Item) return ownerOf(effect.parent as ItemLike);
	return null;
}

/** The id of the effect's origin item, when that item is on the holder. */
function originItemIdOf(effect: EndingEffect, holder: Actor): string | null {
	if (effect.parent instanceof Item) return (effect.parent as ItemLike).id ?? null;
	if (!effect.origin) return null;
	const origin = fromUuidSync(effect.origin as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as unknown;
	if (!(origin instanceof Item)) return null;
	const item = origin as ItemLike;
	return ownerOf(item) === holder ? (item.id ?? null) : null;
}

function emptyPoolsRules(effect: EndingEffect): EmptyPoolsRuleLike[] {
	const rules = effect.rules ? [...effect.rules.values()] : [];
	return (rules as EmptyPoolsRuleLike[]).filter(
		(rule) =>
			rule?.type === 'emptyPoolsAtEnd' &&
			!rule.disabled &&
			(typeof rule.appliesTo !== 'function' || rule.appliesTo()),
	);
}

/**
 * The dice pools that the Empty Pools at End rules of the effect empty when it ends. A name
 * finds the pool of the effect's origin item first, then the pool of the holder.
 */
export function poolsEmptiedAtEnd(
	effect: EndingEffect,
): { holder: Actor; pools: DicePoolState[] } | null {
	const holder = holderOf(effect);
	if (!holder) return null;
	const identifiers = emptyPoolsRules(effect).flatMap((rule) => rule.poolIdentifiers ?? []);
	if (identifiers.length < 1) return { holder, pools: [] };

	const all = getPools(holder);
	const originItemId = originItemIdOf(effect, holder);
	const found = new Map<string, DicePoolState>();
	for (const identifier of identifiers) {
		const pool =
			all.find(
				(each) =>
					each.scope === 'item' &&
					each.identifier === identifier &&
					originItemId !== null &&
					each.sourceItemId === originItemId,
			) ?? all.find((each) => each.scope === 'actor' && each.identifier === identifier);
		if (pool) found.set(pool.id, pool);
	}
	return { holder, pools: [...found.values()] };
}

/** The labels of the pools that hold dice now and are lost when the effect ends, for a confirm. */
export function poolsLostOnEnd(effect: EndingEffect): string[] {
	const emptied = poolsEmptiedAtEnd(effect);
	if (!emptied) return [];
	return emptied.pools.filter((pool) => pool.faces.length > 0).map((pool) => pool.label);
}
