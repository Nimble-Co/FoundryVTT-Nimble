/**
 * Whether `actor` already knows a spell of `school`.
 *
 * This is the rulebook's exemption from a spell scroll's DC 10 Arcana check,
 * which applies only to a wielder who does not already know a spell from the
 * scroll's school. Cantrips count, being spells on the list like any other.
 */
export default function knowsSpellSchool(
	actor: { items?: Iterable<{ type: string; system?: unknown }> } | null | undefined,
	school: string,
): boolean {
	if (!actor?.items || !school) return false;

	for (const item of actor.items) {
		if (item.type !== 'spell') continue;
		if ((item.system as { school?: string } | undefined)?.school === school) return true;
	}

	return false;
}
