import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
import { SYSTEM_ID } from '#system';
import { CARD_TARGETS_READER, describeLastsUntil } from '#utils/lastsUntil/describeLastsUntil.js';
import { turnsSeenOf } from '#utils/lastsUntil/effectSubject.js';
import {
	formEventsOf,
	type NewMomentKind,
	newMoment,
	removeAt,
	replaceAt,
	withEffectName,
} from '#utils/lastsUntil/momentForm.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import {
	untilRemoved as isUntilRemoved,
	statusLastsUntil,
} from '#utils/lastsUntil/statusLastsUntil.js';
import localize from '#utils/localize.js';
import {
	ESCAPE_SAVES,
	ESCAPE_SKILLS,
	type EscapeSave,
	type EscapeSkill,
	type LastsUntilEvent,
} from '../../../models/activeEffect/nimbleEffectChoices.js';

export const LASTS_UNTIL_WORDS = 'NIMBLE.effectSheet.lastsUntil';
export const ESCAPE_WORDS = 'NIMBLE.effectSheet.escape';
export const DEFAULT_ESCAPE_SAVES: readonly EscapeSave[] = ['strength', 'dexterity'];

interface EscapeFields {
	dc: string;
	noDc?: boolean;
	saves: EscapeSave[];
	skills?: EscapeSkill[];
}

interface EffectSystem {
	lastsUntil?: Moment[];
	escape?: EscapeFields;
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

/** The "an effect named..." choice of a "gain" moment. */
export const GAIN_NAMED = '__named';

export function createEffectLastsUntilTabState(getEffect: () => NimbleActiveEffect) {
	const conditions = (CONFIG.statusEffects ?? [])
		.map((entry) => ({ id: entry.id, label: localize(String(entry.name ?? entry.id)) }))
		.sort((a, b) => a.label.localeCompare(b.label));
	const isCondition = (name: string) => conditions.some((each) => each.id === name);

	/** Rows where "an effect named..." is picked and no name is typed yet. */
	let namedRows = $state<Record<number, boolean>>({});

	const system = $derived(getEffect().reactive.system as unknown as EffectSystem);
	const moments = $derived(system.lastsUntil ?? []);
	const escapeData = $derived<Required<EscapeFields>>({
		dc: system.escape?.dc ?? '',
		noDc: system.escape?.noDc ?? false,
		saves: system.escape?.saves ?? [...DEFAULT_ESCAPE_SAVES],
		skills: system.escape?.skills ?? [],
	});

	const untilRemoved = $derived(isUntilRemoved(system));

	/**
	 * With no moments: the status whose Lasts Until the effect gets once applied, in words. An
	 * effect on a creature is applied already, so it has only its own moments.
	 */
	const statusDefault = $derived.by(() => {
		if (moments.length || !(getEffect().parent instanceof Item)) return null;
		const found = statusLastsUntil(getEffect().reactive.statuses ?? []);
		if (!found) return null;
		const entry = (CONFIG.statusEffects ?? []).find((each) => each.id === found.status);
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

	/** A count stays only while the moment counts the same turns, or combat ends. */
	function change(index: number, next: Moment) {
		const seen = turnsSeenOf(getEffect());
		const before = moments[index];
		const sameTurns =
			before?.kind === 'turn' &&
			next.kind === 'turn' &&
			before.clock === next.clock &&
			before.boundary === next.boundary;
		const sameCombatEnds = before?.event === 'combatEnd' && next.event === 'combatEnd';
		return getEffect().update({
			'system.lastsUntil': replaceAt(moments, index, next),
			...((seen[index] ?? 0) > 0 && !sameTurns && !sameCombatEnds
				? { [`flags.${SYSTEM_ID}.turnsSeen`]: seen.map((count, at) => (at === index ? 0 : count)) }
				: {}),
		} as never);
	}

	function gainChoiceOf(index: number, name: string): string {
		if (isCondition(name)) return name;
		return name || namedRows[index] ? GAIN_NAMED : '';
	}

	function pickGain(index: number, choice: string) {
		namedRows[index] = choice === GAIN_NAMED;
		return change(index, withEffectName(moments[index], choice === GAIN_NAMED ? '' : choice));
	}

	/**
	 * The turn counts of the moments after a removed moment move up with them, and so does their
	 * "an effect named..." pick.
	 */
	function remove(index: number) {
		namedRows = Object.fromEntries(
			Object.entries(namedRows).flatMap(([at, on]) => {
				const row = Number(at);
				if (row === index) return [];
				return [[row > index ? row - 1 : row, on]];
			}),
		);
		const seen = turnsSeenOf(getEffect());
		return getEffect().update({
			'system.lastsUntil': removeAt(moments, index),
			...(seen.length > index
				? { [`flags.${SYSTEM_ID}.turnsSeen`]: seen.filter((_, at) => at !== index) }
				: {}),
		} as never);
	}

	function add(kind: NewMomentKind | '') {
		if (!kind) return;
		return save([...moments, newMoment(kind)]);
	}

	/** A typed DC turns No DC off. */
	function setEscapeDc(dc: string) {
		const value = dc.trim();
		return getEffect().update({
			'system.escape.dc': value,
			...(value ? { 'system.escape.noDc': false } : {}),
		} as never);
	}

	function toggleNoDc() {
		return getEffect().update({
			'system.escape.noDc': !escapeData.noDc,
			'system.escape.dc': '',
		} as never);
	}

	function toggled<T>(list: readonly T[], value: T, order: readonly T[]): T[] {
		const on = new Set(list);
		if (on.has(value)) on.delete(value);
		else on.add(value);
		return order.filter((each) => on.has(each));
	}

	/** Turns one save on or off. The last save or skill that is on stays on. */
	function toggleEscapeSave(save: EscapeSave) {
		const saves = toggled(escapeData.saves, save, ESCAPE_SAVES);
		if (!saves.length && !escapeData.skills.length) return;
		return getEffect().update({ 'system.escape.saves': saves } as never);
	}

	/** Turns one skill on or off. The last save or skill that is on stays on. */
	function toggleEscapeSkill(skill: EscapeSkill) {
		const skills = toggled(escapeData.skills, skill, ESCAPE_SKILLS);
		if (!skills.length && !escapeData.saves.length) return;
		return getEffect().update({ 'system.escape.skills': skills } as never);
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
		conditions,
		gainChoiceOf,
		pickGain,
		setUntilRemoved,
		change,
		remove,
		add,
		setEscapeDc,
		toggleNoDc,
		toggleEscapeSave,
		toggleEscapeSkill,
	};
}
