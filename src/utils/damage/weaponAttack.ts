import type { WeaponAttack } from '#types/weaponAttack.d.ts';
import { deliveryOfAttack } from './attackDelivery.js';

/** Which weapons an ability attacks with. Empty: the ability has its own damage. */
export const WEAPON_ATTACKS = ['', 'any', 'melee', 'ranged'] as const;

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
}

const firstDamage = (item: WeaponItem) =>
	item.system?.activation?.effects?.find((effect) => effect.type === 'damage');

/** The ability's kind of weapon, or empty for an ability with its own damage. */
export function weaponAttackOf(item: unknown): WeaponAttack {
	const value = (item as { system?: { activation?: { weaponAttack?: WeaponAttack } } } | null)
		?.system?.activation?.weaponAttack;
	return value ?? '';
}

/** The equipped weapons this ability can attack with. */
export function weaponOptionsFor(
	actor: { type?: string | null; items?: Iterable<WeaponItem> } | null | undefined,
	attack: WeaponAttack,
): WeaponOption[] {
	if (!attack) return [];
	const options: WeaponOption[] = [];
	for (const item of actor?.items ?? []) {
		if (item.type !== 'object' || item.system?.objectType !== 'weapon') continue;
		if (item.system.equipped !== true) continue;
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
		});
	}
	return options;
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

/** The first damage node of the tree rolls the damage of this weapon. */
export function useWeaponDamage(effects: unknown[], weapon: WeaponOption): void {
	const node = firstDamageIn(effects as EffectTreeNode[]);
	if (!node) return;
	node.formula = weapon.formula;
	node.damageType = weapon.damageType;
}
