/** The tags an attack adds to a rule's predicate: `attack:damageType:<type>` for each damage type. */
export function attackTags(damageTypes: readonly string[] | null | undefined): string[] {
	return (damageTypes ?? []).filter(Boolean).map((type) => `attack:damageType:${type}`);
}
