import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantSpells' }),
		// Spell source filters
		schools: new fields.ArrayField(new fields.StringField(), {
			required: false,
			nullable: false,
			initial: [],
		}),
		tiers: new fields.ArrayField(new fields.NumberField({ integer: true, min: 0 }), {
			required: false,
			nullable: false,
			initial: [0],
		}),
		// Whether to include utility spells (default: false)
		includeUtility: new fields.BooleanField({
			required: false,
			nullable: false,
			initial: false,
		}),
		// Specific spell UUIDs (alternative to school/tier filtering)
		uuids: new fields.ArrayField(new fields.StringField(), {
			required: false,
			nullable: false,
			initial: [],
		}),
		// Grant mode
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'auto',
			choices: ['auto', 'selectSchool', 'selectSpell'],
		}),
		// For selectSchool mode: how many schools to choose
		// For selectSpell mode: how many spells to choose
		count: new fields.NumberField({
			required: false,
			nullable: true,
			initial: null,
			integer: true,
			min: 1,
		}),
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
	declare schools: string[];

	declare tiers: number[];

	declare includeUtility: boolean;

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
				['includeUtility', 'boolean'],
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
