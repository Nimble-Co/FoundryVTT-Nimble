import { attackDeliveryFromAttackType } from './attackDelivery.js';

/** Which weapons an ability attacks with. Empty: the ability has its own damage. */
export const WEAPON_ATTACKS = ['', 'any', 'melee', 'ranged'] as const;
export type WeaponAttack = (typeof WEAPON_ATTACKS)[number];

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
	actor: { items?: Iterable<WeaponItem> } | null | undefined,
	attack: WeaponAttack,
): WeaponOption[] {
	if (!attack) return [];
	const options: WeaponOption[] = [];
	for (const item of actor?.items ?? []) {
		if (item.type !== 'object' || item.system?.objectType !== 'weapon') continue;
		if (item.system.equipped !== true) continue;
		const damage = firstDamage(item);
		const targets = item.system.activation?.targets;
		const delivery = attackDeliveryFromAttackType(targets?.attackType as never);
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
