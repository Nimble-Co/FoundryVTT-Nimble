import { NimbleBaseRule } from './base.js';

type MovementMode = 'fly' | 'climb' | 'swim' | 'burrow';

function schema() {
	const { fields } = foundry.data;

	return {
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'fly',
			choices: ['fly', 'climb', 'swim', 'burrow'],
		}),
		speed: new fields.StringField({
			required: true,
			nullable: false,
			initial: '@attributes.movement.walk',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantMovement' }),
	};
}

declare namespace GrantMovementRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActorSystem {
	system: {
		attributes: {
			movement: Record<string, number>;
		};
	};
}

/**
 * Rule that grants a base movement mode (fly, climb, swim, burrow).
 *
 * Unlike speedBonus which adds to an existing speed, grantMovement sets a base
 * speed for a movement mode. Multiple grants use Math.max — the highest granted
 * base wins. speedBonus then stacks on top additively.
 *
 * The speed field supports formulas: '@attributes.movement.walk' gives "fly = walk speed",
 * while '12' gives a fixed fly speed of 12.
 */
class GrantMovementRule extends NimbleBaseRule<GrantMovementRule.Schema> {
	declare mode: MovementMode;
	declare speed: string;

	static override defineSchema(): GrantMovementRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['mode', 'string'],
				['speed', 'string'],
			]),
		);
	}

	/**
	 * Grant the movement mode to the actor.
	 * Uses Math.max so multiple grants take the highest base, not additive.
	 * Runs in prePrepareData so speedBonus can stack on top in its own phase.
	 */
	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;
		const resolvedSpeed = this.resolveFormula(this.speed);
		if (resolvedSpeed === null || resolvedSpeed <= 0) return;

		const actorSystem = actor as object as ActorSystem;
		const currentSpeed = actorSystem.system.attributes.movement[this.mode] ?? 0;
		const newSpeed = Math.max(currentSpeed, resolvedSpeed);

		foundry.utils.setProperty(actor.system, `attributes.movement.${this.mode}`, newSpeed);
	}
}

export { GrantMovementRule };
