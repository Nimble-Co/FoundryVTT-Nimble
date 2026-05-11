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
				label: 'NIMBLE.rules.savingThrowBonus.value.label',
				hint: 'NIMBLE.rules.savingThrowBonus.value.hint',
				widget: 'formula',
			}),
		),
		savingThrows: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
				// `'all'` is a runtime sentinel resolved in prePrepareData to mean
				// "every saving throw". Must remain a valid choice.
				choices: () => [...Object.keys(CONFIG.NIMBLE.savingThrows), 'all'],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.savingThrowBonus.savingThrows.label',
				hint: 'NIMBLE.rules.savingThrowBonus.savingThrows.hint',
			},
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'savingThrowBonus' }),
	};
}

declare namespace SavingThrowBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class SavingThrowBonusRule extends NimbleBaseRule<SavingThrowBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.savingThrowBonus.description';

	static override defineSchema(): SavingThrowBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['savingThrows', 'string[]'],
			]),
		);
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const actor = item.actor as NimbleCharacter;
		const value = this.resolveFormula(this.value);
		let { savingThrows } = this;

		if (!savingThrows.length) return;
		if (savingThrows.includes('all')) savingThrows = Object.keys(CONFIG.NIMBLE.savingThrows);

		for (const saveKey of savingThrows) {
			const baseBonus = actor.system.savingThrows[saveKey]?.bonus ?? 0;
			const modifiedBonus = baseBonus + value;
			foundry.utils.setProperty(actor.system, `savingThrows.${saveKey}.bonus`, modifiedBonus);
		}
	}
}

export { SavingThrowBonusRule };
