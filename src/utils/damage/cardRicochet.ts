import type { Ricochet, RicochetWeapon } from '../../models/rules/ricochet.js';
import { rulesOfType } from '../actor/actorRules.js';
import { UNARMED_STRIKE } from './weaponAttack.js';

interface RicochetCardFlags {
	itemUuid?: string;
	weaponUuid?: string;
}

interface CardItem extends RicochetWeapon {
	type?: string;
	system?: RicochetWeapon['system'] & { objectType?: string };
}

/** The weapon of a card: the weapon a feature attacked with, or the weapon that made the card. */
function weaponOfCard(flags: RicochetCardFlags | null | undefined): CardItem | null {
	if (flags?.weaponUuid) {
		if (flags.weaponUuid === UNARMED_STRIKE) return null;
		return fromUuidSync(flags.weaponUuid as `Item.${string}`) as CardItem | null;
	}
	if (!flags?.itemUuid) return null;
	const item = fromUuidSync(flags.itemUuid as `Item.${string}`) as CardItem | null;
	return item?.type === 'object' && item.system?.objectType === 'weapon' ? item : null;
}

/** The ricochet the attacker's rules give a hit with the weapon of the card, or null. */
export function cardRicochet(
	attacker: { rules?: unknown } | null | undefined,
	flags: RicochetCardFlags | null | undefined,
): Ricochet | null {
	const rules = rulesOfType(attacker, 'ricochet');
	if (rules.length < 1) return null;
	const weapon = weaponOfCard(flags);
	for (const rule of rules) {
		const ricochet = rule.ricochetFor(weapon);
		if (ricochet) return ricochet;
	}
	return null;
}
