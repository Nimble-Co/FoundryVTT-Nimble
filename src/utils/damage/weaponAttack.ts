import type { WeaponAttack } from '#types/weaponAttack.d.ts';
import localize from '#utils/localize.js';
import { deliveryOfAttack } from './attackDelivery.js';
import { getUnarmedDamageFormula } from './attackUtils.js';

/** Which weapons an ability attacks with. Empty: the ability has its own damage. */
export const WEAPON_ATTACKS = ['', 'any', 'melee', 'ranged', 'unarmed'] as const;

/** The weapon choice that is the hero's Unarmed Strike, in place of a weapon uuid. */
export const UNARMED_STRIKE = 'unarmedStrike';

/** An Unarmed Strike is a melee attack at Reach 1 with bludgeoning damage. */
export const UNARMED_STRIKE_ATTACK = {
	attackType: 'reach',
	distance: 1,
	damageType: 'bludgeoning',
} as const;

interface WeaponEffect {
	type?: string;
	formula?: string;
	damageType?: string;
}

interface WeaponItem {
	id?: string | null;
	uuid?: string;
	name?: string;
	type?: string;
	system?: {
		objectType?: string;
		equipped?: boolean;
		activation?: {
			effects?: WeaponEffect[];
			targets?: { attackType?: string; distance?: number };
		};
	};
}

export interface WeaponOption {
	uuid: string;
	name: string;
	formula: string;
	damageType: string;
	attackType: string;
	distance?: number;
	equipped: boolean;
}

const firstDamage = (item: WeaponItem) =>
	item.system?.activation?.effects?.find((effect) => effect.type === 'damage');

/** The ability's kind of weapon, or empty for an ability with its own damage. */
export function weaponAttackOf(item: unknown): WeaponAttack {
	const value = (item as { system?: { activation?: { weaponAttack?: WeaponAttack } } } | null)
		?.system?.activation?.weaponAttack;
	return value ?? '';
}

interface WeaponOwner {
	type?: string | null;
	system?: unknown;
	items?: Iterable<WeaponItem>;
}

/** The hero's Unarmed Strike as a weapon choice. Its damage bonuses come with the attack roll. */
function unarmedStrikeOption(actor: WeaponOwner): WeaponOption {
	return {
		uuid: UNARMED_STRIKE,
		name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
		formula: getUnarmedDamageFormula(actor as Parameters<typeof getUnarmedDamageFormula>[0]),
		...UNARMED_STRIKE_ATTACK,
		equipped: true,
	};
}

/**
 * Every weapon this ability can attack with: the equipped ones, then a hero's Unarmed Strike for
 * a melee, any or unarmed ability, then the weapons that are not equipped.
 */
export function weaponOptionsFor(
	actor: WeaponOwner | null | undefined,
	attack: WeaponAttack,
): WeaponOption[] {
	if (!attack) return [];
	const unarmed =
		actor?.type === 'character' && attack !== 'ranged' ? [unarmedStrikeOption(actor)] : [];
	if (attack === 'unarmed') return unarmed;
	const options: WeaponOption[] = [];
	for (const item of actor?.items ?? []) {
		if (item.type !== 'object' || item.system?.objectType !== 'weapon') continue;
		const damage = firstDamage(item);
		const targets = item.system.activation?.targets;
		const delivery = deliveryOfAttack(item.system.activation, actor);
		if (!damage?.formula || (attack !== 'any' && delivery !== attack)) continue;
		options.push({
			uuid: item.uuid ?? '',
			name: item.name ?? '',
			formula: damage.formula,
			damageType: damage.damageType ?? '',
			attackType: targets?.attackType ?? '',
			...(targets?.distance === undefined ? {} : { distance: targets.distance }),
			equipped: item.system.equipped === true,
		});
	}
	return [
		...options.filter((option) => option.equipped),
		...unarmed,
		...options.filter((option) => !option.equipped),
	];
}

interface EffectTreeNode {
	type?: string;
	formula?: string;
	damageType?: string;
	on?: Record<string, EffectTreeNode[]>;
}

function firstDamageIn(nodes: EffectTreeNode[]): EffectTreeNode | null {
	for (const node of nodes) {
		if (node.type === 'damage') return node;
		const found = firstDamageIn(Object.values(node.on ?? {}).flat());
		if (found) return found;
	}
	return null;
}

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
	const attack = firstDamageIn(merged as EffectTreeNode[]) as TreeNode | null;
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

/** The first damage node of the tree rolls the damage of this weapon. */
export function useWeaponDamage(effects: unknown[], weapon: WeaponOption): void {
	const node = firstDamageIn(effects as EffectTreeNode[]);
	if (!node) return;
	node.formula = weapon.formula;
	node.damageType = weapon.damageType;
}
