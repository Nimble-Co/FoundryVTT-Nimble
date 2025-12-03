import type { NimbleCharacter } from '../../documents/actor/character.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		skills: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{ required: true, nullable: false },
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'skillBonus' }),
	};
}

declare namespace SkillBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class SkillBonusRule extends NimbleBaseRule<SkillBonusRule.Schema> {
	static override defineSchema(): SkillBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['skills', 'string[]'],
			]),
		);
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const actor = item.actor as NimbleCharacter;
		const value = this.resolveFormula(this.value);
		let { skills } = this;

		if (!skills.length) return;
		if (skills.includes('all')) skills = Object.keys(CONFIG.NIMBLE.skills);

		for (const skill of skills) {
			const baseBonus = actor.system.skills[skill]?.bonus ?? 0;
			const modifiedBonus = baseBonus + value;
			foundry.utils.setProperty(actor.system, `skills.${skill}.bonus`, modifiedBonus);
		}
	}
}

export { SkillBonusRule };
