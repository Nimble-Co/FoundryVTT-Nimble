import { NimbleBaseRule } from './base.js';

type MovementType = 'walk' | 'fly' | 'climb' | 'swim' | 'burrow';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'speedBonus' }),
		movementType: new fields.StringField({
			required: false,
			nullable: false,
			initial: 'walk',
			choices: ['walk', 'fly', 'climb', 'swim', 'burrow'],
		}),
	};
}

declare namespace SpeedBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class SpeedBonusRule extends NimbleBaseRule<SpeedBonusRule.Schema> {
	declare value: string;
	declare movementType: MovementType;

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
		const movementType = this.movementType ?? 'walk';

		interface ActorAttributes {
			attributes: {
				movement: Record<string, number>;
			};
		}
		const actorSystem = actor.system as object as ActorAttributes;
		const defaultValue = movementType === 'walk' ? 6 : 0;
		const originalValue = actorSystem.attributes.movement[movementType] ?? defaultValue;
		const modifiedValue = Math.max(0, originalValue + value);

		foundry.utils.setProperty(actor.system, `attributes.movement.${movementType}`, modifiedValue);
	}
}

export { SpeedBonusRule };
