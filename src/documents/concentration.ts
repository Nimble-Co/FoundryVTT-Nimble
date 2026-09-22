import { SYSTEM_ID } from '#system';
import { STATUS_EFFECT_IDS } from '../config/registerConditionsConfig.js';

/** The track every school no `concentrationTrack` rule names shares. */
export const DEFAULT_CONCENTRATION_TRACK = 'default';

/** System flag recording which track a concentration effect occupies. */
export const CONCENTRATION_TRACK_FLAG = 'concentrationTrack';

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
 * Master of Storm reads "you can concentrate on 1 lightning spell and 1 wind
 * spell at the same time", so naming a school splits the caster's single
 * concentration instead of adding another: two named schools hold two
 * concentrations, never three. A named track therefore also ends anything held
 * on the default track, and a cast claiming the default track ends every track.
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
