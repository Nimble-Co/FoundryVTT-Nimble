import { NimbleBaseRule } from './base.js';

type MovementMode = 'fly' | 'climb' | 'swim' | 'burrow';

const ALLOWED_MODES: ReadonlySet<string> = new Set(['fly', 'climb', 'swim', 'burrow']);

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
 *
 * Walk is intentionally excluded from mode choices — walk speed is always present
 * on every actor and is modified via speedBonus, not granted.
 *
 * Uses two-phase processing (matching speedBonus):
 * - prePrepareData: numeric speeds (e.g. '12') — fast path, no Roll construction
 * - afterPrepareData: formula speeds (e.g. '@attributes.movement.walk') — ensures
 *   walk speed is fully resolved before referencing it
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
	 * Check if the speed value is a simple number (not a formula).
	 */
	private isNumericValue(): boolean {
		return /^-?\d+$/.test(this.speed.trim());
	}

	/**
	 * Apply the granted movement speed to the actor.
	 * Uses Math.max so multiple grants take the highest base, not additive.
	 */
	private applyGrantedMovement(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;
		if (!ALLOWED_MODES.has(this.mode)) return;

		const { actor } = item;
		const resolvedSpeed = this.resolveFormula(this.speed);
		if (resolvedSpeed === null || resolvedSpeed <= 0) return;

		const actorSystem = actor as object as ActorSystem;
		const currentSpeed = actorSystem.system.attributes.movement[this.mode] ?? 0;
		const newSpeed = Math.max(currentSpeed, resolvedSpeed);

		foundry.utils.setProperty(actor.system, `attributes.movement.${this.mode}`, newSpeed);
	}

	/**
	 * Phase 1: Process numeric speeds early so the base is established
	 * before any formulas that reference movement values.
	 */
	prePrepareData(): void {
		if (!this.isNumericValue()) return;
		this.applyGrantedMovement();
	}

	/**
	 * Phase 2: Process formula-based speeds (e.g. '@attributes.movement.walk')
	 * after all numeric speed bonuses and grants have been applied.
	 */
	override afterPrepareData(): void {
		if (this.isNumericValue()) return;
		this.applyGrantedMovement();
	}
}

export { GrantMovementRule };
