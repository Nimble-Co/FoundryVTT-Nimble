import { endToggleEffectFromAE } from '#utils/actor/toggleEffectControl.js';
import localize from '#utils/localize.js';

/** What the Effects tab of both sheets does to an actor: End, Remove, and a condition on or off. */

type EffectHolder = { effects?: { get(id: string): ActiveEffect | undefined } };

function effectOf(actor: Actor.Implementation, effectId: string, itemId: string | null) {
	const holder = (itemId ? actor.items.get(itemId) : actor) as EffectHolder | undefined;
	return holder?.effects?.get(effectId);
}

/** The toggle lifecycle ends it: its confirm prompt and pool clearing run. */
export async function endEffect(actor: Actor.Implementation, effectId: string): Promise<void> {
	const effect = [...actor.allApplicableEffects()].find((entry) => entry.id === effectId);
	if (!effect) return;
	try {
		await endToggleEffectFromAE(
			actor as unknown as Parameters<typeof endToggleEffectFromAE>[0],
			effect as unknown as Parameters<typeof endToggleEffectFromAE>[1],
		);
	} catch (_error) {
		ui.notifications?.error(localize('NIMBLE.ui.failedToRemoveEffect'));
	}
}

export async function removeEffect(
	actor: Actor.Implementation,
	effectId: string,
	itemId: string | null,
): Promise<void> {
	try {
		await effectOf(actor, effectId, itemId)?.delete();
	} catch (_error) {
		ui.notifications?.error(localize('NIMBLE.ui.failedToRemoveEffect'));
	}
}

/** A custom status that `toggleStatusEffect` does not know goes with the effects that carry it. */
export async function setCondition(
	actor: Actor.Implementation,
	conditionId: string,
	active: boolean,
): Promise<void> {
	try {
		const standard = conditionId in (CONFIG.NIMBLE.conditions ?? {});
		const carriers = [...actor.effects]
			.filter((effect) => effect.statuses?.has(conditionId))
			.map((effect) => effect.id)
			.filter((id): id is string => Boolean(id));
		if (!active && !standard && carriers.length) {
			await actor.deleteEmbeddedDocuments('ActiveEffect', carriers);
			return;
		}
		await actor.toggleStatusEffect(conditionId, { active });
	} catch (_error) {
		ui.notifications?.error(
			localize(active ? 'NIMBLE.ui.failedToUpdateCondition' : 'NIMBLE.ui.failedToRemoveCondition'),
		);
	}
}
