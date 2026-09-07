/** Tiered spells cost their tier in mana; cantrips are free. */
export function getSpellManaCost(system: { tier?: number }): number {
	return system.tier ?? 0;
}
