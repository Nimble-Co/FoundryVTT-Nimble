import type { WeaponAttack } from '#types/weaponAttack.d.ts';
import localize from '#utils/localize.js';
import { firstDamageNode } from '#utils/treeManipulation/firstDamageNode.js';
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

interface Span {
	min?: number | null;
	max?: number | null;
}

interface WeaponItem {
	id?: string | null;
	uuid?: string;
	name?: string;
	type?: string;
	system?: {
		objectType?: string;
		equipped?: boolean;
		properties?: { selected?: string[]; range?: Span; reach?: Span };
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

/** The weapon's Range or Reach property for its attack type, else the distance of its targets. */
function weaponDistanceOf(item: WeaponItem): number | undefined {
	const targets = item.system?.activation?.targets;
	const properties = item.system?.properties;
	const key =
		targets?.attackType === 'range' ? 'range' : targets?.attackType === 'reach' ? 'reach' : null;
	if (key && properties?.selected?.includes(key)) {
		const span = properties[key];
		const distance = span?.max || span?.min;
		if (distance) return distance;
	}
	return targets?.distance;
}

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
		const distance = weaponDistanceOf(item);
		const delivery = deliveryOfAttack(item.system.activation, actor);
		if (!damage?.formula || (attack !== 'any' && delivery !== attack)) continue;
		options.push({
			uuid: item.uuid ?? '',
			name: item.name ?? '',
			formula: damage.formula,
			damageType: damage.damageType ?? '',
			attackType: targets?.attackType ?? '',
			...(distance === undefined ? {} : { distance }),
			equipped: item.system.equipped === true,
		});
	}
	return [
		...options.filter((option) => option.equipped),
		...unarmed,
		...options.filter((option) => !option.equipped),
	];
}

/** A group of a weapon dropdown. The label is null when the dropdown has one group only. */
export interface WeaponGroup {
	label: string | null;
	weapons: WeaponOption[];
}

/** The weapons as the groups "Equipped" and "Not equipped", or as one group when one is empty. */
export function groupWeapons(weapons: WeaponOption[]): WeaponGroup[] {
	const equipped = weapons.filter((weapon) => weapon.equipped);
	const notEquipped = weapons.filter((weapon) => !weapon.equipped);
	if (equipped.length === 0 || notEquipped.length === 0) {
		return weapons.length > 0 ? [{ label: null, weapons }] : [];
	}
	return [
		{ label: localize('NIMBLE.rollWindow.weaponsEquipped'), weapons: equipped },
		{ label: localize('NIMBLE.rollWindow.weaponsNotEquipped'), weapons: notEquipped },
	];
}

interface EffectTreeNode {
	type?: string;
	formula?: string;
	damageType?: string;
	on?: Record<string, EffectTreeNode[]>;
}

/** The first damage node of the tree rolls the damage of this weapon. */
export function useWeaponDamage(effects: unknown[], weapon: WeaponOption): void {
	const node = firstDamageNode(effects as EffectTreeNode[]);
	if (!node) return;
	node.formula = weapon.formula;
	node.damageType = weapon.damageType;
}
