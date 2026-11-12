import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
import { CARD_TARGETS_READER, describeLastsUntil } from '#utils/lastsUntil/describeLastsUntil.js';
import {
	formEventsOf,
	type NewMomentKind,
	newMoment,
	removeAt,
	replaceAt,
} from '#utils/lastsUntil/momentForm.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import {
	untilRemoved as isUntilRemoved,
	statusLastsUntil,
} from '#utils/lastsUntil/statusLastsUntil.js';
import localize from '#utils/localize.js';
import {
	ESCAPE_SAVES,
	type EscapeSave,
	type LastsUntilEvent,
} from '../../../models/activeEffect/nimbleEffectChoices.js';

export const LASTS_UNTIL_WORDS = 'NIMBLE.effectSheet.lastsUntil';
export const ESCAPE_WORDS = 'NIMBLE.effectSheet.escape';
export const DEFAULT_ESCAPE_SAVES: readonly EscapeSave[] = ['strength', 'dexterity'];

interface EffectSystem {
	lastsUntil?: Moment[];
	escape?: { dc: string; saves: EscapeSave[] };
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
	const escapeData = $derived(system.escape ?? { dc: '', saves: [...DEFAULT_ESCAPE_SAVES] });

	const untilRemoved = $derived(isUntilRemoved(system));

	/**
	 * With no moments: the status whose Lasts Until the effect gets once applied, in words. An
	 * effect on a creature is applied already, so it has only its own moments.
	 */
	const statusDefault = $derived.by(() => {
		if (moments.length || !(getEffect().parent instanceof Item)) return null;
		const found = statusLastsUntil(getEffect().reactive.statuses ?? []);
		if (!found) return null;
		const entry = CONFIG.statusEffects.find((each) => each.id === found.status);
		return {
			condition: localize(String(entry?.name ?? found.status)),
			lasts: describeLastsUntil({
				moments: found.moments,
				reader: CARD_TARGETS_READER,
				localize,
				format: localize,
			}),
		};
	});

	function setUntilRemoved(on: boolean) {
		return getEffect().update({ 'system.untilRemoved': on } as never);
	}

	/** The label of an older core duration, which still ends the effect. */
	const coreDuration = $derived.by(() => {
		const duration = getEffect().reactive.duration as
			| { value?: number | null; units?: string | null }
			| undefined;
		if (!Number.isFinite(duration?.value) || !duration?.units) return '';
		return `${duration.value} ${localize(`EFFECT.DURATION.UNITS.${duration.units}`)}`;
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

	/** Turns one save on or off. The last save that is on stays on. */
	function toggleEscapeSave(save: EscapeSave) {
		const on = new Set(escapeData.saves);
		if (on.has(save)) on.delete(save);
		else on.add(save);
		if (!on.size) return;
		const saves = ESCAPE_SAVES.filter((each) => on.has(each));
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
		get statusDefault() {
			return statusDefault;
		},
		get untilRemoved() {
			return untilRemoved;
		},
		setUntilRemoved,
		change,
		remove,
		add,
		setEscapeDc,
		toggleEscapeSave,
	};
}
