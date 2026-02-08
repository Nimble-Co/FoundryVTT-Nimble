import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'speedBonus' }),
	};
}

declare namespace SpeedBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class SpeedBonusRule extends NimbleBaseRule<SpeedBonusRule.Schema> {
	declare value: string;

	static override defineSchema(): SpeedBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		const value = this.resolveFormula(this.value) ?? 0;

		interface ActorAttributes {
			attributes: {
				movement: { walk?: number };
			};
		}
		const actorSystem = actor.system as object as ActorAttributes;
		const originalValue = actorSystem.attributes.movement.walk ?? 6;
		const modifiedValue = Math.max(0, originalValue + value);

		foundry.utils.setProperty(actor.system, 'attributes.movement.walk', modifiedValue);
	}
}

export { SpeedBonusRule };
