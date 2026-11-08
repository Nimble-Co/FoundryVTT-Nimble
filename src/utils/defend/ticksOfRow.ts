import type { DefendOption } from '#types/components/DefendDialog.d.ts';

/** The picked "When you Defend" ticks that can go with this row. */
export function ticksOfRow(
	row: Pick<DefendOption, 'tickIds'>,
	picked: readonly string[],
): string[] {
	return picked.filter((id) => row.tickIds.includes(id));
}
