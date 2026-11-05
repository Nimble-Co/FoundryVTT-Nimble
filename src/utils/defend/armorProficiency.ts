interface ArmorObject {
	type?: string;
	system?: { objectType?: string; armorType?: string; equipped?: boolean };
}

interface ArmorWearer {
	type?: string;
	items?: Iterable<ArmorObject> | { contents?: ArmorObject[] };
	system?: { proficiencies?: { armor?: Set<string> | string[] } };
}

/** The armor type of a worn armor or shield, or '' when the item does not say. */
export function armorTypeOf(item: ArmorObject): string {
	if (item.system?.objectType === 'shield') return 'shield';
	if (item.system?.objectType === 'armor') return item.system.armorType ?? '';
	return '';
}

/**
 * Whether the hero wears armor or a shield without proficiency, which makes a
 * Defend cost 1 more action (Core Rules, Equipment Proficiency). Armor with no
 * armor type is not checked.
 */
export function wearsArmorWithoutProficiency(actor: ArmorWearer | null | undefined): boolean {
	if (actor?.type !== 'character') return false;
	const known = new Set(actor.system?.proficiencies?.armor ?? []);
	const items =
		(actor.items as { contents?: ArmorObject[] } | undefined)?.contents ??
		(actor.items as Iterable<ArmorObject> | undefined) ??
		[];
	for (const item of items) {
		if (item.type !== 'object' || item.system?.equipped !== true) continue;
		const armorType = armorTypeOf(item);
		if (armorType && !known.has(armorType)) return true;
	}
	return false;
}
