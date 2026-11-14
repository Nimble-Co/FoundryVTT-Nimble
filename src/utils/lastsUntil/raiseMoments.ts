import type { MomentRaise } from '#types/spellScaling.js';
import { type Moment, momentCount } from './momentReached.js';

/** The number an upcast can raise: the count of a "2nd next turn", or a time. Null for others. */
export function raisableNumber(moment: Moment): number | null {
	if (moment.kind === 'time') return moment.value ?? 1;
	if (moment.kind === 'turn' && moment.span === 'nextTurn' && moment.clock !== 'nextHero') {
		return momentCount(moment);
	}
	return null;
}

/** The moments with each raise added to the number of the moment at its index. */
export function raiseMoments(moments: Moment[], raises: readonly MomentRaise[]): Moment[] {
	if (!raises.length) return moments;
	return moments.map((moment, index) => {
		const amount = raises
			.filter((raise) => raise.index === index)
			.reduce((sum, raise) => sum + raise.amount, 0);
		const number = raisableNumber(moment);
		if (!amount || number === null) return moment;
		return { ...moment, value: number + amount };
	});
}
