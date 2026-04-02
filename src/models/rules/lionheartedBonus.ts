import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'lionheartedBonus' }),
	};
}

declare namespace LionheartedBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class LionheartedBonusRule extends NimbleBaseRule<LionheartedBonusRule.Schema> {
	static override defineSchema(): LionheartedBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override afterPrepareData(): void {
		if (this.invalid) return;

		const { actor } = this;
		if (!actor || actor.type !== 'character') return;
		if (!(actor as unknown as { statuses?: Set<string> }).statuses?.has('lionhearted')) return;

		const part = {
			mode: 'add',
			priority: this.priority,
			source: this.label,
			value: 2,
		};

		(
			actor.system as object as { attributes: { armor: { components: object[] } } }
		).attributes.armor.components.push(part);
	}

	override tooltipInfo(): string {
		return super.tooltipInfo();
	}
}

export { LionheartedBonusRule };
