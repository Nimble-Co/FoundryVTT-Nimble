import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
import {
	formEventsOf,
	type NewMomentKind,
	newMoment,
	removeAt,
	replaceAt,
} from '#utils/lastsUntil/momentForm.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import type { LastsUntilEvent } from '../../../models/activeEffect/nimbleEffectChoices.js';

export const LASTS_UNTIL_WORDS = 'NIMBLE.effectSheet.lastsUntil';
export const ESCAPE_WORDS = 'NIMBLE.effectSheet.escape';

interface EffectSystem {
	lastsUntil?: Moment[];
	escape?: { dc: string; saves: string };
}

export function lastsUntilWord(path: string, data?: Record<string, string>): string {
	return localize(`${LASTS_UNTIL_WORDS}.${path}`, data);
}

/** The word of an event; an event that has no word in the form shows its id. */
export function eventLabel(event: LastsUntilEvent): string {
	const key = `${LASTS_UNTIL_WORDS}.event.${event}`;
	const label = localize(key);
	return label === key ? event : label;
}

/** The form's events, and an event from the data that the form does not offer. */
export function eventsFor(moment: Moment): LastsUntilEvent[] {
	const events: LastsUntilEvent[] = [...formEventsOf(moment.who)];
	if (moment.event && !events.includes(moment.event)) events.push(moment.event);
	return events;
}

export function createEffectLastsUntilTabState(getEffect: () => NimbleActiveEffect) {
	const system = $derived(getEffect().reactive.system as unknown as EffectSystem);
	const moments = $derived(system.lastsUntil ?? []);
	const escapeData = $derived(system.escape ?? { dc: '', saves: 'strOrDex' });

	/** The label of an older core duration, which still ends the effect. */
	const coreDuration = $derived.by(() => {
		const duration = getEffect().reactive.duration as
			| { value?: number | null; label?: string }
			| undefined;
		return Number.isFinite(duration?.value) ? (duration?.label ?? '') : '';
	});

	function save(next: Moment[]) {
		return getEffect().update({ 'system.lastsUntil': next } as never);
	}

	function change(index: number, next: Moment) {
		return save(replaceAt(moments, index, next));
	}

	function remove(index: number) {
		return save(removeAt(moments, index));
	}

	function add(kind: NewMomentKind | '') {
		if (!kind) return;
		return save([...moments, newMoment(kind)]);
	}

	function setEscapeDc(dc: string) {
		return getEffect().update({ 'system.escape.dc': dc.trim() } as never);
	}

	function setEscapeSaves(saves: string) {
		return getEffect().update({ 'system.escape.saves': saves } as never);
	}

	return {
		get moments() {
			return moments;
		},
		get escape() {
			return escapeData;
		},
		get coreDuration() {
			return coreDuration;
		},
		change,
		remove,
		add,
		setEscapeDc,
		setEscapeSaves,
	};
}
