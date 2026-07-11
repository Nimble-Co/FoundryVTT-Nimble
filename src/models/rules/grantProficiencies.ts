import type { NimbleCharacter } from '../../documents/actor/character.ts';
import { NimbleBaseRule } from './base.ts';

const PROFICIENCY_TYPE_MAPPING = {
	armor: 'armorTypes',
	languages: 'languages',
	weapons: null,
};

function schema() {
	const { fields } = foundry.data;

	return {
		proficiencyType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'languages',
			choices: ['armor', 'languages', 'weapons'],
		}),
		values: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
			}),
			{ required: true, nullable: false },
		),
		// For language grants only: the name the granting item's ancestry uses for
		// the language (e.g. a Gnome "calls Dwarvish Gnomish"). Drives the
		// ancestry-scoped alternate name shown on sheets. Empty = use the default.
		displayAs: new fields.StringField({
			required: false,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.grantProficiency.displayAs.label',
			hint: 'NIMBLE.rules.grantProficiency.displayAs.hint',
			showWhen: (data) => data.proficiencyType === 'languages',
		} as unknown as never),
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantProficiency' }),
	};
}

declare namespace GrantProficiencyRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class GrantProficiencyRule extends NimbleBaseRule<GrantProficiencyRule.Schema> {
	static override group = 'grants';
	static override description = 'NIMBLE.rules.grantProficiency.description';

	declare proficiencyType: 'armor' | 'languages' | 'weapons';

	declare values: string[];

	static override defineSchema(): GrantProficiencyRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['values', 'string[]'],
				['propertyType', 'armor | languages | weapons'],
				['displayAs', 'string'],
			]),
		);
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const actor = item.actor as NimbleCharacter;
		const { proficiencyType } = this;

		// Ancestry language grants are governed by the In-Game Languages settings
		// (seeded from these same rules, then editable and authoritative at runtime).
		// Once that layer is active the character applies them itself, so skip here
		// to honor GM edits/removals. Falls through normally until then (e.g. tests,
		// initial load) so languages are never silently dropped.
		if (
			proficiencyType === 'languages' &&
			item.type === 'ancestry' &&
			(CONFIG.NIMBLE as unknown as { languageGrantsManaged?: boolean }).languageGrantsManaged
		) {
			return;
		}
		let { values } = this;
		const property = foundry.utils.getProperty(
			actor,
			`system.proficiencies.${proficiencyType}`,
		) as string[];

		if (!values.length) return;
		if (values.includes('all')) {
			const configKey = PROFICIENCY_TYPE_MAPPING[proficiencyType];
			if (configKey) {
				values = Object.keys(CONFIG.NIMBLE[configKey]);
			}
		}

		foundry.utils.setProperty(
			actor,
			`system.proficiencies.${proficiencyType}`,
			new Set([...values, ...property]),
		);
	}
}

export { GrantProficiencyRule };
