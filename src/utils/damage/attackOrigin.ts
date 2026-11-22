import { SYSTEM_ID } from '#system';
import type { RuleOf, RuleType } from '#types/ruleTypes.d.ts';
import { actorRules, rulesOfType } from '../actor/actorRules.js';
import { identifierOf } from '../documents/itemIdentifier.js';

/** The feature that caused an attack: the item that granted it, or the item that is the attack. */
export interface AttackOrigin {
	uuid: string;
	identifier: string;
}

interface OriginItem {
	uuid?: string | null;
	identifier?: string;
	system?: { identifier?: string };
}

/**
 * The origin of an attack with `item`. With `throughUuid`, the attack was made through
 * that item, such as a feature that grants the attack.
 */
export function attackOriginOf(item: OriginItem, throughUuid?: string | null): AttackOrigin {
	if (throughUuid) {
		const through = fromUuidSync(throughUuid as `Item.${string}`) as OriginItem | null;
		return { uuid: throughUuid, identifier: through ? identifierOf(through) : '' };
	}
	return { uuid: item.uuid ?? '', identifier: identifierOf(item) };
}

/**
 * Whether an attack with this origin identifier is in the scope of a rule's
 * "Only attacks made through" field. A blank scope takes every attack.
 */
export function isMadeThrough(
	scope: string | null | undefined,
	origin: string | null | undefined,
): boolean {
	const wanted = (scope ?? '').trim();
	return wanted === '' || wanted === origin;
}

interface RolledOriginOptions {
	origin?: Partial<AttackOrigin> | null;
	/** Rolls made before the origin was recorded. */
	offerSource?: string;
}

/** The origin identifier a rolled attack recorded, if any. */
export function originIdentifierOfRoll(
	options: RolledOriginOptions | null | undefined,
): string | undefined {
	return options?.origin?.identifier || options?.offerSource || undefined;
}

/** The origin a card of an attack recorded, if any. */
export function originOfCard(
	card: { flags?: Record<string, unknown> } | null | undefined,
): Partial<AttackOrigin> | undefined {
	const flags = card?.flags?.[SYSTEM_ID] as { origin?: Partial<AttackOrigin> } | undefined;
	return flags?.origin ?? undefined;
}

/** The origin identifier a card of an attack recorded, if any. */
export function originIdentifierOfCard(
	card: { flags?: Record<string, unknown> } | null | undefined,
): string | undefined {
	return originOfCard(card)?.identifier || undefined;
}

/** Whose attacks a rule scoped to an origin reaches: the owner's only, or also other creatures'. */
export const ORIGIN_ATTACKERS = ['self', 'anyone'] as const;

export type OriginAttacker = (typeof ORIGIN_ATTACKERS)[number];

/** A rule with an "Only attacks made through" scope and an "Attacks by" field. */
export interface OriginScopedRule {
	type?: string;
	actor?: unknown;
	originAttacker?: string;
	/** The identifier the rule's scope names. Blank when the rule has no scope now. */
	readonly originScope?: string;
}

interface ActorRef {
	uuid?: string | null;
	rules?: unknown;
}

function sameActor(a: unknown, b: unknown): boolean {
	if (!a || !b) return false;
	if (a === b) return true;
	const uuid = (a as ActorRef).uuid;
	return !!uuid && uuid === (b as ActorRef).uuid;
}

/** Whether the item is the actor's own, so no lookup is needed. */
function holdsItem(actor: unknown, itemUuid: string | null | undefined): boolean {
	if (!itemUuid) return true;
	const holder = actor as { uuid?: string | null; items?: Iterable<{ uuid?: string }> } | null;
	if (holder?.uuid && itemUuid.startsWith(`${holder.uuid}.`)) return true;
	const items = holder?.items;
	if (!items || typeof (items as Iterable<unknown>)[Symbol.iterator] !== 'function') return false;
	for (const item of items) if (item?.uuid === itemUuid) return true;
	return false;
}

/** The actor that holds the item an attack was made through. */
function originOwnerOf(originUuid: string | null | undefined): ActorRef | null {
	if (!originUuid) return null;
	const item = fromUuidSync(originUuid as `Item.${string}`, { strict: false }) as {
		actor?: ActorRef | null;
	} | null;
	return item?.actor ?? null;
}

/** Whether a rule also reaches the attacks other creatures make through the item its scope names. */
export function reachesOthersAttacks(rule: OriginScopedRule | null | undefined): boolean {
	return rule?.originAttacker === 'anyone' && !!rule.originScope?.trim();
}

/**
 * The rules that reach an attack another creature made through an item of this actor:
 * the opted-in rules of the item's owner. Empty when the attacker owns the item.
 */
export function originOwnerRules<T = OriginScopedRule>(
	attacker: unknown,
	origin: Partial<AttackOrigin> | null | undefined,
): T[] {
	if (holdsItem(attacker, origin?.uuid)) return [];
	const owner = originOwnerOf(origin?.uuid);
	if (!owner || sameActor(owner, attacker)) return [];
	return actorRules<OriginScopedRule>(owner).filter(reachesOthersAttacks) as T[];
}

/**
 * The rules of one type that reach an attack: the attacker's own, then the opted-in rules
 * of the creature whose item the attack was made through.
 */
export function rulesReachingAttack<T extends RuleType>(
	attacker: { rules?: unknown } | null | undefined,
	type: T,
	origin: Partial<AttackOrigin> | null | undefined,
): RuleOf<T>[] {
	const others = originOwnerRules(attacker, origin).filter((rule) => rule.type === type);
	return [...rulesOfType(attacker, type), ...(others as unknown as RuleOf<T>[])];
}

/** Whether a rule reaches an attack that `attacker` made through the item with `originUuid`. */
export function ruleReachesAttack(
	rule: OriginScopedRule,
	attacker: unknown,
	originUuid: string | null | undefined,
): boolean {
	if (sameActor(attacker, rule.actor)) return true;
	return reachesOthersAttacks(rule) && sameActor(originOwnerOf(originUuid), rule.actor);
}
