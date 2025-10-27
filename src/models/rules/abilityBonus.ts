import type { NimbleCharacter } from '../../documents/actor/character.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		// TODO: Implement choices
		abilities: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{ required: true, nullable: false },
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'abilityBonus' }),
	};
}

declare namespace AbilityBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class AbilityBonusRule extends NimbleBaseRule<AbilityBonusRule.Schema> {
	static override defineSchema(): AbilityBonusRule.Schema {
		return {
			...super.defineSchema(),
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

	override prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

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
