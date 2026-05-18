import { withWidget } from './_widgetOption.js';
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
			label: 'NIMBLE.rules.grantMovement.mode.label',
			hint: 'NIMBLE.rules.grantMovement.mode.hint',
			choices: ['fly', 'climb', 'swim', 'burrow'],
		}),
		speed: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '@attributes.movement.walk',
				label: 'NIMBLE.rules.grantMovement.speed.label',
				hint: 'NIMBLE.rules.grantMovement.speed.hint',
				widget: 'formula',
			}),
		),
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
		movementGrants?: Record<string, number>;
	};
}

interface ActorSource {
	_source: {
		system: {
			attributes: {
				movement: Record<string, number>;
			};
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
 * Grants are accumulated in actor.system.movementGrants during both data prep phases.
 * The final movement value is computed as: max(all grants) + bonuses already applied.
 * This ensures speedBonus values stack on top of the granted base correctly.
 *
 * Uses two-phase processing (matching speedBonus):
 * - prePrepareData: numeric speeds (e.g. '12') — fast path, no Roll construction
 * - afterPrepareData: formula speeds (e.g. '@attributes.movement.walk') — ensures
 *   walk speed is fully resolved before referencing it
 */
class GrantMovementRule extends NimbleBaseRule<GrantMovementRule.Schema> {
	static override group = 'grants';
	static override description = 'NIMBLE.rules.grantMovement.description';

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
	 * Store the grant and apply it to movement.
	 *
	 * Grants are tracked in actor.system.movementGrants so multiple grants
	 * take the highest base (Math.max). The final movement value preserves
	 * any speedBonus values already applied by computing:
	 *   max_grant + (liveSpeed - sourceBase)
	 * where (liveSpeed - sourceBase) captures bonuses applied in earlier phases.
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

		// Track the highest grant per mode in an accumulator
		if (!actorSystem.system.movementGrants) {
			foundry.utils.setProperty(actor.system, 'movementGrants', {});
		}
		const previousGrant = actorSystem.system.movementGrants![this.mode] ?? 0;
		const bestGrant = Math.max(previousGrant, resolvedSpeed);
		actorSystem.system.movementGrants![this.mode] = bestGrant;

		// Compute bonuses already applied by speedBonus rules.
		// Live speed includes both previous grants and bonuses — subtract the
		// previous grant and the source base to isolate just the bonuses.
		const actorSource = actor as object as ActorSource;
		const sourceBase = actorSource._source.system.attributes.movement[this.mode] ?? 0;
		const liveSpeed = actorSystem.system.attributes.movement[this.mode] ?? 0;
		const appliedBonuses = liveSpeed - sourceBase - previousGrant;

		// Final speed = highest grant + source base + bonuses from speedBonus
		const finalSpeed = bestGrant + sourceBase + Math.max(0, appliedBonuses);
		foundry.utils.setProperty(actor.system, `attributes.movement.${this.mode}`, finalSpeed);
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
