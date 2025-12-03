import type { NimbleCharacter } from '../../documents/actor/character.ts';
import { NimbleBaseRule } from './base.ts';

const PROFICIENCY_TYPE_MAPPING = {
	armors: 'armorTypes',
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
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantProficiency' }),
	};
}

declare namespace GrantProficiencyRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class GrantProficiencyRule extends NimbleBaseRule<GrantProficiencyRule.Schema> {
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
			]),
		);
	}

	afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const actor = item.actor as NimbleCharacter;
		const { proficiencyType } = this;
		let { values } = this;
		const property = foundry.utils.getProperty(
			actor,
			`system.proficiencies.${proficiencyType}`,
		) as string[];

		console.error('Here');

		if (!values.length) return;
		if (values.includes('all')) {
			values = Object.keys(CONFIG.NIMBLE[PROFICIENCY_TYPE_MAPPING[proficiencyType] ?? []]);
		}

		foundry.utils.setProperty(
			actor,
			`system.proficiencies.${proficiencyType}`,
			new Set([...values, ...property]),
		);
	}
}

export { GrantProficiencyRule };
