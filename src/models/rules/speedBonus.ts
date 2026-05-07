import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type MovementType = 'walk' | 'fly' | 'climb' | 'swim' | 'burrow';

const DEFAULT_WALK_SPEED = 6;

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'Bonus',
				hint: 'Bonus to speed in tiles. Negative numbers reduce speed.',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'speedBonus' }),
		movementType: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: 'Movement type (blank = walk)',
			hint: 'Leave blank to apply to walk speed only. Pick a specific type to grant or modify it.',
			choices: ['walk', 'fly', 'climb', 'swim', 'burrow'],
		}),
	};
}

declare namespace SpeedBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActorSystem {
	system: {
		attributes: {
			movement: Record<string, number>;
		};
	};
}

class SpeedBonusRule extends NimbleBaseRule<SpeedBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.ruleDescriptions.speedBonus';

	declare value: string;
	declare movementType: MovementType | null;

	static override defineSchema(): SpeedBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	/**
	 * Check if the value is a simple number (not a formula)
	 */
	private isNumericValue(): boolean {
		// A numeric value is just digits, optional minus sign, no @ or other formula chars
		return /^-?\d+$/.test(this.value.trim());
	}

	/**
	 * Apply the speed bonus to the actor's movement
	 */
	private applySpeedBonus(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		const value = this.resolveFormula(this.value) ?? 0;
		const actorSystem = actor as object as ActorSystem;

		if (this.movementType !== null) {
			// Apply bonus to specific movement type only
			const movementType = this.movementType;
			const defaultValue = movementType === 'walk' ? DEFAULT_WALK_SPEED : 0;
			const originalValue = actorSystem.system.attributes.movement[movementType] ?? defaultValue;
			const modifiedValue = Math.max(0, originalValue + value);
			foundry.utils.setProperty(actor.system, `attributes.movement.${movementType}`, modifiedValue);
		} else {
			// Generic speed bonus: apply to walk only
			const walkValue = actorSystem.system.attributes.movement.walk ?? DEFAULT_WALK_SPEED;
			foundry.utils.setProperty(
				actor.system,
				'attributes.movement.walk',
				Math.max(0, walkValue + value),
			);
		}
	}

	/**
	 * Phase 1: Process numeric bonuses early so walk speed is fully calculated
	 * before any formulas that reference @attributes.movement.walk
	 */
	prePrepareData(): void {
		if (!this.isNumericValue()) return;
		if (!this.test()) return;
		this.applySpeedBonus();
	}

	/**
	 * Phase 2: Process formula-based bonuses (numeric bonuses already handled in prePrepareData)
	 */
	override afterPrepareData(): void {
		if (this.isNumericValue()) return;
		if (!this.test()) return;
		this.applySpeedBonus();
	}
}

export { SpeedBonusRule };
