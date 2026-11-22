import localize from '#utils/localize.js';

/** "Free (<feature>): it spends no action.", with the Rushed Attack note when it ignores them. */
export function freeAttackNote(source: string, ignoresRushed: boolean): string {
	if (!source) return '';
	return localize(`NIMBLE.rollWindow.${ignoresRushed ? 'freeAttackNoRushed' : 'freeAttack'}`, {
		source,
	});
}
