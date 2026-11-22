import type { DiceDivision } from '../../managers/itemActivation/diceDivision.js';
import type { DiceShare } from '../../utils/damage/evenDiceShares.js';
import { evenDiceShares } from '../../utils/damage/evenDiceShares.js';
import localize from '../../utils/localize.js';

/** The rows of the roll window that divide the dice of an attack among its targets. */
export function createDiceDivisionState(division: DiceDivision | undefined) {
	const targets = division?.targets ?? [];
	const dice = division?.dice ?? 0;
	let counts = $state<Record<string, number>>(
		Object.fromEntries(
			evenDiceShares(
				dice,
				targets.map((target) => target.uuid),
			).map((share) => [share.targetUuid, share.dice]),
		),
	);
	const given = $derived(Object.values(counts).reduce((sum, count) => sum + count, 0));

	function limitOf(uuid: string): number {
		return dice - given + (counts[uuid] ?? 0);
	}

	function set(uuid: string, value: number): number {
		const amount = Math.max(0, Math.min(limitOf(uuid), Math.trunc(Number(value) || 0)));
		counts = { ...counts, [uuid]: amount };
		return amount;
	}

	return {
		get rows() {
			return targets.map((target) => ({
				uuid: target.uuid,
				name: target.name,
				dice: counts[target.uuid] ?? 0,
				limit: limitOf(target.uuid),
			}));
		},
		heading: division
			? localize('NIMBLE.rollWindow.divideDice.heading', { source: division.source })
			: '',
		dice,
		get totalLine() {
			return localize('NIMBLE.rollWindow.divideDice.given', {
				given: String(given),
				dice: String(dice),
			});
		},
		get cannotRollReason() {
			return division && given !== dice ? localize('NIMBLE.rollWindow.divideDice.giveAll') : '';
		},
		get shares(): DiceShare[] | undefined {
			if (!division) return undefined;
			return targets.map((target) => ({ targetUuid: target.uuid, dice: counts[target.uuid] ?? 0 }));
		},
		adjust(uuid: string, delta: number) {
			set(uuid, (counts[uuid] ?? 0) + delta);
		},
		set,
	};
}
