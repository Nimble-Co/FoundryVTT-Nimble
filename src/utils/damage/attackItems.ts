/** The items an attack is made with: the activated item, and the weapon an ability attacks with. */
export interface AttackItems {
	itemUuid?: string | null;
	weaponUuid?: string | null;
}

/** The uuids of the items the attack is made with. */
export function attackItemUuids(attack: AttackItems): string[] {
	return [attack.itemUuid, attack.weaponUuid].filter(
		(uuid): uuid is string => typeof uuid === 'string' && uuid !== '',
	);
}

/** Whether the attack is made with this item, as the activated item or as its weapon. */
export function isAttackWith(attack: AttackItems, itemUuid: string | null | undefined): boolean {
	return !!itemUuid && attackItemUuids(attack).includes(itemUuid);
}
