import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantSpells' }),
		// Spell source filters
		schools: new fields.ArrayField(
			new fields.StringField({
				choices: () => [...Object.keys(CONFIG.NIMBLE.spellSchools), 'known'],
			}),
			{
				required: false,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.grantSpells.schools.label',
			},
		),
		tiers: new fields.ArrayField(new fields.NumberField({ integer: true, min: 0 }), {
			required: false,
			nullable: false,
			initial: [0],
			label: 'NIMBLE.rules.grantSpells.tiers.label',
		}),
		// When true, only grant utility spells; when false, only grant non-utility spells
		utilityOnly: new fields.BooleanField({
			required: false,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.grantSpells.utilityOnly.label',
		}),
		// Specific spell UUIDs (alternative to school/tier filtering)
		uuids: new fields.ArrayField(
			new fields.StringField(
				withWidget({
					required: false,
					nullable: false,
					initial: '',
					widget: 'documentUuid',
					documentTypes: ['Item.spell'],
				}),
			),
			{
				required: false,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.grantSpells.uuids.label',
				hint: 'NIMBLE.rules.grantSpells.uuids.hint',
			},
		),
		// Grant mode
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'auto',
			label: 'NIMBLE.rules.grantSpells.mode.label',
			choices: ['auto', 'selectSchool', 'selectSpell'],
		}),
		// For selectSchool / selectSpell: how many schools/spells to choose. Hidden in `auto`.
		count: new fields.NumberField({
			required: false,
			nullable: true,
			initial: null,
			integer: true,
			min: 1,
			label: 'NIMBLE.rules.grantSpells.count.label',
			showWhen: (data) => data.mode === 'selectSchool' || data.mode === 'selectSpell',
		} as unknown as never),
	};
}

declare namespace GrantSpellsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that grants spells during character creation.
 *
 * Supports four grant modes:
 * 1. Auto-grant by school - Grant all spells matching school(s) + tier(s)
 * 2. Auto-grant by UUID - Grant specific spells by UUID
 * 3. School selection - User chooses N schools, then grants all matching spells
 * 4. Spell selection - User chooses N individual spells from the filtered pool
 */
class GrantSpellsRule extends NimbleBaseRule<GrantSpellsRule.Schema> {
	static override group = 'grants';
	static override description = 'NIMBLE.rules.grantSpells.description';

	declare schools: string[];

	declare tiers: number[];

	declare utilityOnly: boolean;

	declare uuids: string[];

	declare mode: 'auto' | 'selectSchool' | 'selectSpell';

	declare count: number | null;

	static override defineSchema(): GrantSpellsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['schools', 'string[]'],
				['tiers', 'number[]'],
				['utilityOnly', 'boolean'],
				['uuids', 'string[]'],
				['mode', "'auto' | 'selectSchool' | 'selectSpell'"],
				['count', 'number | null'],
			]),
		);
	}

	/**
	 * Returns whether this rule requires user selection (school or spell selection mode)
	 */
	get requiresSelection(): boolean {
		return this.mode === 'selectSchool' || this.mode === 'selectSpell';
	}

	/**
	 * Returns whether this rule grants specific spells by UUID
	 */
	get grantsSpecificSpells(): boolean {
		return this.uuids.length > 0;
	}
}

export { GrantSpellsRule };
