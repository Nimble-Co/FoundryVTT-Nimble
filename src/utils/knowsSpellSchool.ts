/**
 * Whether `actor` already knows a spell of `school`.
 *
 * This is the rulebook's exemption from a spell scroll's Arcana check: the DC 10
 * check applies only to a wielder who does *not* already know a spell from the
 * scroll's school. Cantrips count — they are spells on the list like any other.
 *
 * Shared by the scroll chooser, which states which case applies before the
 * player commits, and by the scroll's activation, which decides whether to roll.
 * One definition so the two can never disagree.
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
