import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'restrictSpellSchools',
		}),
		// Schools the actor may still cast from once this rule applies. Spells from
		// any other school are removed on application and never auto-granted again.
		allowedSchools: new fields.ArrayField(
			new fields.StringField({
				choices: () => Object.keys(CONFIG.NIMBLE.spellSchools),
			}),
			{
				required: false,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.restrictSpellSchools.allowedSchools.label',
				hint: 'NIMBLE.rules.restrictSpellSchools.allowedSchools.hint',
			},
		),
		// Schools the player may pick a "keep and convert" exception spell from
		// (e.g. Ice or Lightning for the Invoker of Flame). The chosen spell is
		// retained and retagged to the first allowed school. Empty = no exception.
		exceptionFromSchools: new fields.ArrayField(
			new fields.StringField({
				choices: () => Object.keys(CONFIG.NIMBLE.spellSchools),
			}),
			{
				required: false,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.restrictSpellSchools.exceptionFromSchools.label',
				hint: 'NIMBLE.rules.restrictSpellSchools.exceptionFromSchools.hint',
			},
		),
		// How many exception spells the player may keep and convert.
		exceptionCount: new fields.NumberField({
			required: false,
			nullable: false,
			initial: 1,
			integer: true,
			min: 0,
			label: 'NIMBLE.rules.restrictSpellSchools.exceptionCount.label',
		}),
	};
}

declare namespace RestrictSpellSchoolsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that restricts which spell schools an actor may cast from ("you can only
 * cast fire spells from now on"). Processed by the level-up flow, not during
 * actor data preparation.
 *
 * On application it removes owned automation-granted spells from disallowed
 * schools (except a player-chosen exception, which is retained and retagged to
 * an allowed school). Because the level-up flow re-reads active restrictions on
 * every level, disallowed schools are also filtered out of future auto-grants.
 */
class RestrictSpellSchoolsRule extends NimbleBaseRule<RestrictSpellSchoolsRule.Schema> {
	static override group = 'grants';

	static override description = 'NIMBLE.rules.restrictSpellSchools.description';

	declare allowedSchools: string[];

	declare exceptionFromSchools: string[];

	declare exceptionCount: number;

	static override defineSchema(): RestrictSpellSchoolsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['allowedSchools', 'string[]'],
				['exceptionFromSchools', 'string[]'],
				['exceptionCount', 'number'],
			]),
		);
	}
}

export { RestrictSpellSchoolsRule };
