import applyConditionToActor, {
	type AppliedConditionEffect,
	type ConditionTargetActor,
} from './applyConditionToActor.js';

const CONCENTRATION_CONDITION_ID = 'concentration';

/** The tag `_populateBaseTags` adds for the `concentration` item property. */
const CONCENTRATION_PROPERTY_TAG = 'property:concentration';

/** The caster, who both receives the condition and is credited as its source. */
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
 * Whether using this item makes its owner concentrate.
 *
 * Read from the `concentration` property rather than from rules authored on the
 * item, so a homebrew spell or scroll that ticks the box behaves like a shipped
 * one. Both `SpellDataModel` and `ObjectDataModel` offer the property, and both
 * item classes tag it.
 */
export function requiresConcentration(item: ConcentrationItem): boolean {
	return item.tags?.has(CONCENTRATION_PROPERTY_TAG) ?? false;
}

/**
 * Put the `concentration` condition on the caster, replacing whatever they were
 * concentrating on before.
 *
 * The condition always lands on the caster, never on the item's targets: a spell
 * that buffs an ally is still the caster's concentration to hold, and a spell
 * that targets nobody still occupies it.
 *
 * `applyConditionToActor` refuses to apply a condition the actor already carries,
 * so ending the prior instance first is what makes casting a second concentration
 * spell leave exactly one behind, credited to the new spell.
 *
 * @returns the applied effect, or `null` when the item needs no concentration,
 *          has no owner, or a `preApplyCondition` listener refused it.
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
