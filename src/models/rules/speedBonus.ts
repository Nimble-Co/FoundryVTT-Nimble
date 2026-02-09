import { NimbleBaseRule } from './base.js';

type MovementType = 'walk' | 'fly' | 'climb' | 'swim' | 'burrow';

const DEFAULT_WALK_SPEED = 6;

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

interface ActorSystem {
	system: {
		attributes: {
			movement: Record<string, number>;
		};
	};
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

	/**
	 * Check if the value is a simple number (not a formula)
	 */
	private isNumericValue(): boolean {
		// A numeric value is just digits, optional minus sign, no @ or other formula chars
		return /^-?\d+$/.test(this.value.trim());
	}

	/**
	 * Check if movementType was explicitly set in source data
	 */
	private hasExplicitMovementType(): boolean {
		const sourceData = this._source as { movementType?: string };
		return sourceData.movementType !== undefined;
	}

	/**
	 * Phase 1: Process numeric bonuses early so walk speed is fully calculated
	 * before any formulas that reference @attributes.movement.walk
	 */
	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.isNumericValue()) return; // Only process numeric values in this phase

		const { actor } = item;
		const value = this.resolveFormula(this.value) ?? 0;
		const actorSystem = actor as object as ActorSystem;

		if (this.hasExplicitMovementType()) {
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
	 * Phase 2: Process formula-based bonuses (numeric bonuses already handled in prePrepareData)
	 */
	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (this.isNumericValue()) return; // Already processed in prePrepareData

		const { actor } = item;
		const actorSystem = actor as object as ActorSystem;

		// Formula-based value: evaluate now (walk should have all numeric bonuses applied)
		const value = this.resolveFormula(this.value) ?? 0;

		if (this.hasExplicitMovementType()) {
			// Apply to specific movement type (e.g., "gain climb speed equal to walk")
			const movementType = this.movementType;
			const defaultValue = movementType === 'walk' ? DEFAULT_WALK_SPEED : 0;
			const originalValue = actorSystem.system.attributes.movement[movementType] ?? defaultValue;
			const modifiedValue = Math.max(0, originalValue + value);
			foundry.utils.setProperty(actor.system, `attributes.movement.${movementType}`, modifiedValue);
		} else {
			// Generic formula bonus: apply to walk only
			// (other movement types granted via formula already inherit walk's bonuses)
			const walkValue = actorSystem.system.attributes.movement.walk ?? DEFAULT_WALK_SPEED;
			foundry.utils.setProperty(
				actor.system,
				'attributes.movement.walk',
				Math.max(0, walkValue + value),
			);
		}
	}
}

export { SpeedBonusRule };
