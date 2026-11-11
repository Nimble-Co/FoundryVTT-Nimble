import {
	activationTreeOf,
	itemEffectUsers,
	rulesOf,
	type UserItem,
	type UserRuleHolder,
} from './itemEffectUsers.js';

interface DeletableItem extends UserItem {
	update(data: Record<string, unknown>): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
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
		const tree = foundry.utils.deepClone(activationTreeOf(item));
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
	const holderUpdates: Promise<unknown>[] = [];
	for (const [holder, byRule] of fieldsByHolder) {
		const rules = rulesOf(holder).map((rule) => {
			const fields = rule.id ? byRule.get(rule.id) : undefined;
			if (!fields) return rule;
			return { ...rule, ...Object.fromEntries(fields.map((name) => [name, ''])) };
		});
		if (holder === item) itemUpdate['system.rules'] = rules;
		else if (holder.id !== effectId && holder.update) {
			holderUpdates.push(holder.update({ 'system.rules': rules }));
		}
	}

	if (Object.keys(itemUpdate).length) await item.update(itemUpdate);
	await Promise.all(holderUpdates);
	await item.deleteEmbeddedDocuments('ActiveEffect', [effectId]);
}
