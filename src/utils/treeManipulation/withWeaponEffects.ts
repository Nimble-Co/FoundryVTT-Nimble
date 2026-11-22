import { firstDamageNode } from './firstDamageNode.js';

interface TreeNode {
	id?: string;
	type?: string;
	parentNode?: string | null;
	parentContext?: string | null;
	on?: Record<string, unknown>;
	sharedRolls?: unknown[];
	[key: string]: unknown;
}

const LINK_KEYS = new Set(['id', 'parentNode', 'parentContext', 'on', 'sharedRolls']);

/** What a node does, without its place in the tree. */
function contentOf(node: TreeNode): string {
	const entries = Object.entries(node).filter(([key]) => !LINK_KEYS.has(key));
	return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
}

/** A copy of the subtree with each id given the prefix, and each child pointing at its new parent. */
function withPrefixedIds(node: TreeNode, prefix: string, parentNode: string | null): TreeNode {
	const id = `${prefix}${node.id ?? ''}`;
	const copy: TreeNode = { ...node, id, parentNode };
	const relink = (children: unknown) =>
		Array.isArray(children)
			? children.map((child) => withPrefixedIds(child as TreeNode, prefix, id))
			: children && typeof children === 'object'
				? Object.fromEntries(Object.entries(children).map(([key, nested]) => [key, relink(nested)]))
				: children;
	if (node.on) copy.on = relink(node.on) as Record<string, unknown>;
	if (node.sharedRolls) copy.sharedRolls = relink(node.sharedRolls) as unknown[];
	return copy;
}

/** A weapon child that adds nothing the attack's own children do not already do. */
function alreadyThere(child: TreeNode, siblings: TreeNode[]): boolean {
	if (child.type === 'damageOutcome') {
		return siblings.some((sibling) => sibling.type === 'damageOutcome');
	}
	const content = contentOf(child);
	return siblings.some((sibling) => contentOf(sibling) === content);
}

const WEAPON_NODE_PREFIX = 'weapon-';

/**
 * The ability's effect tree with the weapon's nodes added. What the weapon's attack does on a
 * hit, miss or crit goes under the ability's attack, after the ability's own nodes; a node the
 * ability's attack already has in that place (or a second damage outcome) is left out, so the
 * ability decides how its attack lands. The weapon's other nodes go after the ability's nodes.
 * Weapon ids get a prefix, so every id stays unique.
 */
export function withWeaponEffects(effects: unknown[], weaponEffects: unknown[]): unknown[] {
	const weaponNodes = (foundry.utils.deepClone(weaponEffects) as TreeNode[]).map((node) =>
		withPrefixedIds(node, WEAPON_NODE_PREFIX, null),
	);
	const weaponAttack = weaponNodes.find((node) => node.type === 'damage');
	const merged = foundry.utils.deepClone(effects) as TreeNode[];
	const attack = firstDamageNode(merged);
	if (attack && weaponAttack) {
		attack.on ??= {};
		for (const [context, children] of Object.entries(weaponAttack.on ?? {})) {
			if (!Array.isArray(children)) continue;
			const own = (attack.on[context] ?? []) as TreeNode[];
			const added = (children as TreeNode[])
				.filter((child) => !alreadyThere(child, own))
				.map((child) => ({ ...child, parentNode: attack.id ?? null, parentContext: context }));
			if (added.length > 0) attack.on[context] = [...own, ...added];
		}
	}
	return [...merged, ...weaponNodes.filter((node) => node !== weaponAttack)];
}
