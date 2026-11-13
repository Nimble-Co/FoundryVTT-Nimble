import {
	activationTreeOf,
	itemEffectUsers,
	rulesOf,
	type UserItem,
	type UserRuleHolder,
} from './itemEffectUsers.js';

interface DeletableItem extends UserItem {
	update(data: Record<string, unknown>): Promise<unknown>;
	updateEmbeddedDocuments(
		type: 'ActiveEffect',
		updates: Record<string, unknown>[],
	): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

/** The stored data of a document, not the prepared data. */
function sourceOf(document: UserRuleHolder): { system?: unknown } {
	return (document as { _source?: { system?: unknown } })._source ?? document;
}

/** Sets `effectId` to null on every Apply Effect node, at any depth, that points at the effect. */
function clearNodes(value: unknown, effectId: string): void {
	if (Array.isArray(value)) {
		for (const entry of value) clearNodes(entry, effectId);
		return;
	}
	if (!value || typeof value !== 'object') return;
	const node = value as Record<string, unknown>;
	if (node.type === 'applyEffect' && node.effectId === effectId) node.effectId = null;
	for (const child of Object.values(node)) clearNodes(child, effectId);
}

/**
 * Deletes an effect of the item. The Apply Effect nodes and the rule fields that pointed at it are
 * cleared first, so nothing is left pointing at a missing effect.
 */
export async function deleteItemEffect(item: DeletableItem, effectId: string): Promise<void> {
	const users = itemEffectUsers(item, effectId);
	const itemUpdate: Record<string, unknown> = {};
	if (users.some((user) => user.kind === 'node')) {
		const tree = foundry.utils.deepClone(activationTreeOf(sourceOf(item)));
		clearNodes(tree, effectId);
		itemUpdate['system.activation.effects'] = tree;
	}

	const fieldsByHolder = new Map<UserRuleHolder, Map<string, string[]>>();
	for (const user of users) {
		if (user.kind !== 'rule' || !user.rule.id) continue;
		const byRule = fieldsByHolder.get(user.holder) ?? new Map<string, string[]>();
		byRule.set(user.rule.id, user.fields);
		fieldsByHolder.set(user.holder, byRule);
	}
	const effectUpdates: Record<string, unknown>[] = [];
	for (const [holder, byRule] of fieldsByHolder) {
		if (holder !== item && (!holder.id || holder.id === effectId)) continue;
		const rules = rulesOf(sourceOf(holder)).map((rule) => {
			const fields = rule.id ? byRule.get(rule.id) : undefined;
			if (!fields) return rule;
			return { ...rule, ...Object.fromEntries(fields.map((name) => [name, ''])) };
		});
		if (holder === item) itemUpdate['system.rules'] = rules;
		else effectUpdates.push({ _id: holder.id, 'system.rules': rules });
	}

	if (Object.keys(itemUpdate).length) await item.update(itemUpdate);
	if (effectUpdates.length) await item.updateEmbeddedDocuments('ActiveEffect', effectUpdates);
	await item.deleteEmbeddedDocuments('ActiveEffect', [effectId]);
}
