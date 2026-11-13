import type { TimeUnit } from '../../models/activeEffect/nimbleEffectChoices.js';

const SINGULAR: Record<Exclude<TimeUnit, 'rounds'>, string> = {
	minutes: 'minute',
	hours: 'hour',
	days: 'day',
};

/** World seconds of a time moment. A round is `CONFIG.time.roundTime`, or 6 seconds. */
export function secondsOf(units: TimeUnit, value: number): number {
	if (units === 'rounds') return value * roundSeconds();
	const calendar = game.time?.calendar as
		| { componentsToTime(components: Record<string, number>): number }
		| undefined;
	return calendar?.componentsToTime({ [SINGULAR[units]]: value }) ?? 0;
}

export function roundSeconds(): number {
	return Number(CONFIG.time?.roundTime) || 6;
}
