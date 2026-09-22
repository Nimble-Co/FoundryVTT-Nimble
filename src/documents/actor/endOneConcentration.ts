import localize from '../../utils/localize.js';
import { getSpellSchoolLabel } from '../../utils/spellLabels.js';
import {
	concentrationTrackOf,
	DEFAULT_CONCENTRATION_TRACK,
	type HeldConcentration,
} from '../concentration.js';

const END_EVERY_TRACK = 'all';

export interface ConcentrationChoice {
	id: string;
	label: string;
}

/**
 * Resolved here rather than through `ActiveEffect#sourceName`, which answers
 * "None" or "Unknown" instead of nothing when the origin does not resolve.
 */
function concentrationSourceName(effect: HeldConcentration): string | null {
	if (!effect.origin) return null;

	const resolve = (globalThis as Record<string, unknown>).fromUuidSync as
		| ((uuid: string) => unknown)
		| undefined;
	if (typeof resolve !== 'function') return null;

	return (resolve(effect.origin) as { name?: string } | null)?.name ?? null;
}

/** Names a held concentration by its spell, with the track it occupies when that is a school. */
function concentrationLabel(effect: HeldConcentration): string {
	const source = concentrationSourceName(effect);
	const track = concentrationTrackOf(effect);

	if (track === DEFAULT_CONCENTRATION_TRACK) {
		return source ?? localize('NIMBLE.conditions.concentration');
	}

	const school = getSpellSchoolLabel(track);

	return source ? `${source} (${school})` : school;
}

export function concentrationChoices(held: HeldConcentration[]): ConcentrationChoice[] {
	return held
		.filter((effect): effect is HeldConcentration & { id: string } => Boolean(effect.id))
		.map((effect) => ({ id: effect.id, label: concentrationLabel(effect) }));
}

/**
 * Which of the caster's concentrations to end. A caster holding two tracks has a
 * real choice, so it is asked rather than decided for them.
 *
 * @returns the effect ids to delete, empty when the choice was dismissed.
 */
export async function promptForConcentrationToEnd(held: HeldConcentration[]): Promise<string[]> {
	const choices = concentrationChoices(held);
	if (choices.length < 2) return choices.map((choice) => choice.id);

	const chosen = await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.concentration.endPrompt.title') },
		content: `<p>${localize('NIMBLE.concentration.endPrompt.content')}</p>`,
		buttons: [
			...choices.map((choice) => ({ action: choice.id, label: choice.label })),
			{ action: END_EVERY_TRACK, label: localize('NIMBLE.concentration.endPrompt.all') },
		],
		rejectClose: false,
	});

	if (chosen === END_EVERY_TRACK) return choices.map((choice) => choice.id);

	return choices.some((choice) => choice.id === chosen) ? [chosen as string] : [];
}
