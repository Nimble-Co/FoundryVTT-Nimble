import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from './flattenEffectsTree.js';

const WIDGET = 'itemEffectPicker';

export interface UserRule {
	id?: string;
	type?: string;
	label?: string;
	[field: string]: unknown;
}

/** A document with `system.rules`: the item, or one of its effects. */
export interface UserRuleHolder {
	id?: string | null;
	name?: string | null;
	documentName?: string;
	system?: unknown;
	update?(data: Record<string, unknown>): Promise<unknown>;
}

export interface UserItem extends UserRuleHolder {
	effects?: unknown;
}

export type ItemEffectUser =
	| { kind: 'node'; nodeId: string; recipient: 'self' | 'targets' }
	| { kind: 'rule'; holder: UserRuleHolder; rule: UserRule; fields: string[] }
	/** an effect of the item that gives this one at a stack count */
	| { kind: 'stacks'; holder: UserRuleHolder };

type WidgetOption = string | ((data: Record<string, unknown>) => string) | undefined;

const widgetFieldsByType = new Map<string, [string, WidgetOption][]>();

function widgetFields(type: string): [string, WidgetOption][] {
	const cached = widgetFieldsByType.get(type);
	if (cached) return cached;
	const RuleClass = (
		CONFIG.NIMBLE.ruleDataModels as Record<
			string,
			{ defineSchema(): Record<string, unknown> } | undefined
		>
	)[type];
	const found: [string, WidgetOption][] = [];
	for (const [name, field] of Object.entries(RuleClass?.defineSchema() ?? {})) {
		const widget = (field as { options?: { widget?: WidgetOption } } | null)?.options?.widget;
		if (widget) found.push([name, widget]);
	}
	widgetFieldsByType.set(type, found);
	return found;
}

/** The fields of the rule that hold an effect of its item: those with the `itemEffectPicker` widget. */
export function itemEffectRuleFields(rule: UserRule): string[] {
	if (!rule?.type) return [];
	return widgetFields(rule.type)
		.filter(([, widget]) => (typeof widget === 'function' ? widget(rule) : widget) === WIDGET)
		.map(([name]) => name);
}

/** The effects of an item, from a Foundry collection, a Map or a plain iterable. */
export function itemEffectList<T = unknown>(item: { effects?: unknown } | null | undefined): T[] {
	const effects = item?.effects as
		| { values?: () => Iterable<T>; [Symbol.iterator]?: () => Iterator<T> }
		| null
		| undefined;
	if (!effects) return [];
	if (typeof effects.values === 'function') return [...effects.values()];
	if (typeof effects[Symbol.iterator] === 'function') return [...(effects as Iterable<T>)];
	return [];
}

export function activationTreeOf(item: { system?: unknown } | null | undefined): EffectNode[] {
	return (
		(item?.system as { activation?: { effects?: EffectNode[] } } | undefined)?.activation
			?.effects ?? []
	);
}

export function rulesOf(holder: { system?: unknown } | null | undefined): UserRule[] {
	const rules = (holder?.system as { rules?: unknown } | undefined)?.rules;
	return Array.isArray(rules) ? (rules as UserRule[]) : [];
}

/**
 * What points at an item effect: Apply Effect nodes of the item's activation at any depth, rules
 * (on the item or on its effects) whose `itemEffectPicker` fields hold the effect's id, and effects
 * of the item that give it at a stack count.
 */
export function itemEffectUsers(
	item: UserItem,
	effectId: string | null | undefined,
	tree: EffectNode[] = activationTreeOf(item),
): ItemEffectUser[] {
	if (!effectId) return [];
	const users: ItemEffectUser[] = [];
	for (const node of flattenEffectsTree(tree)) {
		if (node.type === 'applyEffect' && node.effectId === effectId) {
			users.push({ kind: 'node', nodeId: node.id, recipient: node.recipient });
		}
	}
	const holders: UserRuleHolder[] = [item, ...itemEffectList<UserRuleHolder>(item)];
	for (const holder of holders) {
		for (const rule of rulesOf(holder)) {
			const fields = itemEffectRuleFields(rule).filter((name) => rule[name] === effectId);
			if (fields.length) users.push({ kind: 'rule', holder, rule, fields });
		}
	}
	for (const holder of itemEffectList<UserRuleHolder>(item)) {
		const stacks = (holder.system as { stacks?: { effectId?: string } } | undefined)?.stacks;
		if (holder.id !== effectId && stacks?.effectId === effectId) {
			users.push({ kind: 'stacks', holder });
		}
	}
	return users;
}
