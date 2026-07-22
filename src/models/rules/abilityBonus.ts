import type { NimbleCharacter } from '../../documents/actor/character.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.abilityBonus.value.label',
				hint: 'NIMBLE.rules.abilityBonus.value.hint',
				widget: 'formula',
			}),
		),
		abilities: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
				choices: () => [...Object.keys(CONFIG.NIMBLE.abilityScores), 'all'],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.abilityBonus.abilities.label',
				hint: 'NIMBLE.rules.abilityBonus.abilities.hint',
			},
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'abilityBonus' }),
	};
}

declare namespace AbilityBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class AbilityBonusRule extends NimbleBaseRule<AbilityBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.abilityBonus.description';

	static override defineSchema(): AbilityBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['abilities', 'string[]'],
			]),
		);
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const actor = item.actor as NimbleCharacter;
		const value = this.resolveFormula(this.value);
		let { abilities } = this;

		if (!abilities.length) return;
		if (abilities.includes('all')) abilities = Object.keys(CONFIG.NIMBLE.abilityScores);

		for (const ability of abilities) {
			const baseBonus = actor.system.abilities[ability]?.bonus ?? 0;
			const modifiedBonus = baseBonus + value;
			foundry.utils.setProperty(actor.system, `abilities.${ability}.bonus`, modifiedBonus);
		}
	}
}

export { AbilityBonusRule };
