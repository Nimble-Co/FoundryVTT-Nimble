import type { RuleOf, RuleType } from '#types/ruleTypes.d.ts';
import { isEffectParent } from '../../models/rules/_ruleParent.js';

/** The rules of an actor as an array. Empty when it has no rules to read. */
export function actorRules<T>(actor: { rules?: unknown } | null | undefined): T[] {
	const rules = actor?.rules;
	if (!rules || typeof (rules as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
	return Array.from(rules as Iterable<T>);
}

/** The rules of one type on an actor, typed as that rule's class. */
export function rulesOfType<T extends RuleType>(
	actor: { rules?: unknown } | null | undefined,
	type: T,
): RuleOf<T>[] {
	return actorRules<{ type?: string }>(actor).filter((rule) => rule?.type === type) as RuleOf<T>[];
}

/** What a card or a window calls a rule: its label, or the name of its item. */
export function ruleLabel(rule: {
	label?: string;
	parentDocument?: { name?: string | null } | null;
}): string {
	return rule.label || rule.parentDocument?.name || '';
}

/** The key of a rule on its item. */
export function ruleKey(rule: {
	id?: string | null;
	parentDocument?: { uuid?: string | null } | null;
}): string {
	return `${rule.parentDocument?.uuid ?? ''}:${rule.id ?? ''}`;
}

interface RuleParentLike<T> {
	documentName?: string;
	modifiesActor?: boolean;
	rules?: Map<string, T>;
}

/** The document that holds rules, found from its uuid. Null for an effect that does not change its actor now. */
export function runningRuleParent<T>(uuid: string | null | undefined): RuleParentLike<T> | null {
	if (!uuid) return null;
	const parent = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as RuleParentLike<T> | null;
	if (!parent?.rules) return null;
	if (isEffectParent(parent) && !parent.modifiesActor) return null;
	return parent;
}

/** A rule found from the uuid of its parent and its id, while it runs. */
export function runningRule<T extends { id?: string; disabled?: boolean }>(
	parentUuid: string | null | undefined,
	ruleId: string | null | undefined,
): T | null {
	const parent = runningRuleParent<T>(parentUuid);
	const rule = parent?.rules ? [...parent.rules.values()].find((r) => r.id === ruleId) : null;
	return rule && !rule.disabled ? rule : null;
}
