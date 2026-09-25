import { SYSTEM_ID } from '#system';
import { STATUS_EFFECT_IDS } from '../config/registerConditionsConfig.js';
import { isConditionImmune } from '../hooks/conditionImmunityGuard.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import applyConditionToActor from './applyConditionToActor.js';
import { getSpellScrollData } from './createScrollFromSpell.js';

/** The track every school no `concentrationTrack` rule names shares. */
export const DEFAULT_CONCENTRATION_TRACK = 'default';

/** System flag recording which track a concentration effect occupies. */
export const CONCENTRATION_TRACK_FLAG = 'concentrationTrack';

/** Where a `concentrationTrack` rule publishes the schools it names. */
export const CONCENTRATION_TRACKS_PATH = 'concentrationTracks';

/** A concentration the actor is holding, as the track paths read it. */
export interface HeldConcentration {
	id?: string;
	statuses?: Set<string>;
	origin?: string | null;
	getFlag?(scope: string, key: string): unknown;
	toObject?(): Record<string, unknown>;
}

/** An actor whose concentration is read and replaced. */
export interface ConcentratingActor {
	uuid?: string | null;
	system?: { concentrationTracks?: Set<string> };
	statuses?: Set<string>;
	effects?: Iterable<HeldConcentration>;
}

/** The concentrations the actor holds, one per occupied track. */
export function heldConcentrations(actor: ConcentratingActor): HeldConcentration[] {
	return [...(actor.effects ?? [])].filter(
		(effect) => effect.statuses?.size === 1 && effect.statuses.has(STATUS_EFFECT_IDS.concentration),
	);
}

export function concentrationTrackOf(effect: HeldConcentration): string {
	const track = effect.getFlag?.(SYSTEM_ID, CONCENTRATION_TRACK_FLAG);
	return typeof track === 'string' && track.length > 0 ? track : DEFAULT_CONCENTRATION_TRACK;
}

/**
 * The track a cast in this school claims. A `concentrationTrack` rule gives the
 * schools it names a track of their own; every other school claims the default.
 */
export function concentrationTrackForCast(
	school: string | null,
	actor: ConcentratingActor,
): string {
	if (!school) return DEFAULT_CONCENTRATION_TRACK;

	return actor.system?.concentrationTracks?.has(school) ? school : DEFAULT_CONCENTRATION_TRACK;
}

/**
 * The concentrations a cast claiming this track ends.
 *
 * Named tracks divide the caster's single concentration rather than adding to
 * it, so the number they can hold is the number of named tracks. A named track
 * therefore also ends anything held on the default track, and a cast claiming
 * the default track ends every track.
 */
export function concentrationsEndedBy(
	actor: ConcentratingActor,
	track: string,
): HeldConcentration[] {
	return heldConcentrations(actor).filter((effect) => {
		if (track === DEFAULT_CONCENTRATION_TRACK) return true;

		const held = concentrationTrackOf(effect);

		return held === DEFAULT_CONCENTRATION_TRACK || held === track;
	});
}

const CONCENTRATION_PROPERTY_TAG = 'property:concentration';

const SPELL_SCHOOL_TAG_PREFIX = 'school:';

/** What came of putting concentration on a caster. */
export type ConcentrationOutcome = 'applied' | 'refused' | 'skipped';

/** The item being activated, as the concentration path reads it. */
export interface ConcentrationSource {
	uuid?: string | null;
	type?: unknown;
	flags?: Record<string, unknown>;
	tags: Set<string>;
	actor?: ConcentratingActor | null;
}

/** The school of the spell being cast, read off a scroll's inscription when it is one. */
function activatedSpellSchool(item: ConcentrationSource): string | null {
	for (const tag of item.tags) {
		if (tag.startsWith(SPELL_SCHOOL_TAG_PREFIX)) return tag.slice(SPELL_SCHOOL_TAG_PREFIX.length);
	}

	return getSpellScrollData(item)?.school ?? null;
}

/**
 * Put concentration on an activated item's owner, ending whatever they were
 * already concentrating on that this cast displaces.
 *
 * Driven by the `concentration` property rather than by anything authored on the
 * item, so homebrew spells and inscribed scrolls need no rules of their own.
 */
export async function applyCasterConcentration(
	item: ConcentrationSource,
): Promise<ConcentrationOutcome> {
	if (!item.tags.has(CONCENTRATION_PROPERTY_TAG)) return 'skipped';
	if (!isRuleAutomationEnabled()) return 'skipped';

	const caster = item.actor;
	if (!caster) return 'skipped';

	// An immune caster is not a failure to report: nothing was meant to land.
	if (isConditionImmune(caster, STATUS_EFFECT_IDS.concentration)) return 'skipped';

	const track = concentrationTrackForCast(activatedSpellSchool(item), caster);

	const effect = await applyConditionToActor(caster, STATUS_EFFECT_IDS.concentration, {
		sourceItem: item,
		sourceActor: caster,
		systemFlags: { [CONCENTRATION_TRACK_FLAG]: track },
		replaces: concentrationsEndedBy(caster, track),
	});

	return effect ? 'applied' : 'refused';
}
