import applyConditionToActor, {
	type AppliedConditionEffect,
	type ConditionTargetActor,
} from './applyConditionToActor.js';

const CONCENTRATION_CONDITION_ID = 'concentration';

const CONCENTRATION_PROPERTY_TAG = 'property:concentration';

type ConcentratingActor = ConditionTargetActor & {
	uuid?: string | null;
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
};

/** The parts of the activated spell, scroll or object this reads. */
export interface ConcentrationItem {
	uuid?: string | null;
	tags?: { has(tag: string): boolean };
	actor?: ConcentratingActor | null;
}

/**
 * Read from the `concentration` property rather than from rules authored on the item,
 * so a homebrew spell or scroll that ticks the box needs no authoring.
 */
export function requiresConcentration(item: ConcentrationItem): boolean {
	return item.tags?.has(CONCENTRATION_PROPERTY_TAG) ?? false;
}

/**
 * `applyConditionToActor` no-ops on a condition the actor already carries, so the
 * previous instance is removed rather than applied over.
 *
 * @returns the applied effect, or `null` when the item needs no concentration, has
 *          no owner, or a `preApplyCondition` listener refused it.
 */
export default async function applyCasterConcentration(
	item: ConcentrationItem,
): Promise<AppliedConditionEffect | null> {
	if (!requiresConcentration(item)) return null;

	const caster = item.actor;
	if (!caster) return null;

	await caster.toggleStatusEffect(CONCENTRATION_CONDITION_ID, { active: false });

	return applyConditionToActor(caster, CONCENTRATION_CONDITION_ID, {
		sourceItem: item,
		sourceActor: caster,
	});
}
