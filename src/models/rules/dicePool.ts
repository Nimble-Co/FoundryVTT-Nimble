import type { EncounterContext, InitiativeRolledContext, ItemActivatedContext } from './base.js';
import { NimbleBaseRule } from './base.js';

export type PoolMode = 'resource' | 'accumulate' | 'store' | 'individual';

export interface DicePoolEntry {
	identifier: string;
	label: string;
	faces: number;
	max: number;
	poolMode: PoolMode;
}

interface ActorWithPools {
	dicePools?: Record<string, DicePoolEntry>;
}

function levelOverridesSchema() {
	const { fields } = foundry.data;
	return Array.from({ length: 20 }, (_, i) => i + 1).reduce(
		(acc: Record<string, unknown>, level) => {
			acc[level] = new fields.SchemaField({
				faces: new fields.NumberField({
					required: true,
					nullable: false,
					initial: 0,
					integer: true,
				}),
				quantity: new fields.StringField({ required: true, nullable: false, initial: '' }),
			});
			return acc;
		},
		{},
	);
}

function schema() {
	const { fields } = foundry.data;

	return {
		faces: new fields.NumberField({ required: true, nullable: false, initial: 6, integer: true }),
		quantity: new fields.StringField({ required: true, nullable: false, initial: '1' }),
		levels: new fields.SchemaField(levelOverridesSchema() as any),
		/**
		 * Controls how the pool's value is tracked and updated:
		 * - 'resource'   : count-based; filled by lifecycle hooks, spent one pip at a time
		 * - 'accumulate' : roll one die at a time and add value to a running total
		 * - 'store'      : roll the full pool at once, store the total; expend to clear
		 */
		poolMode: new fields.StringField({ required: true, nullable: false, initial: 'resource' }),
		resetOnEncounterEnd: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
		}),
		fillOnInitiative: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		rollOnActivation: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'dicePool' }),
	};
}

declare namespace DicePoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that declares a named dice pool on the actor.
 *
 * Each rule instance registers one pool under a unique identifier. During data
 * preparation the rule resolves the effective die size and maximum quantity for
 * the character's current level (using optional per-level overrides) and writes
 * them to `actor.system.dicePools[identifier]`. The live value (how much is
 * currently stored or remaining) is kept in actor flags so it persists across
 * sessions without a schema change.
 *
 * The rule's base `identifier` field (from NimbleBaseRule) serves as the pool
 * key on the actor. The base `label` field provides the display name.
 *
 * Pool modes (see `poolMode` field above) control both how the UI presents
 * the pool and what rolling the badge does.
 */
class DicePoolRule extends NimbleBaseRule<DicePoolRule.Schema> {
	declare faces: number;
	declare quantity: string;
	declare poolMode: PoolMode;
	declare resetOnEncounterEnd: boolean;
	declare fillOnInitiative: boolean;
	declare rollOnActivation: boolean;

	static override defineSchema(): DicePoolRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['faces', 'number'],
				['quantity', 'string'],
				['poolMode', "'resource' | 'accumulate' | 'store'"],
				['resetOnEncounterEnd', 'boolean'],
				['fillOnInitiative', 'boolean'],
				['rollOnActivation', 'boolean'],
			]),
		);
	}

	private resolveEffectiveConfig(): { faces: number; quantity: string } {
		const characterLevel = Math.round(this.resolveFormula('@level') ?? 1);
		let effectiveFaces = this.faces;
		let effectiveQuantity = this.quantity;
		const levels = this.levels as unknown as Record<number, { faces: number; quantity: string }>;
		for (let lvl = 1; lvl <= characterLevel; lvl++) {
			const override = levels[lvl];
			if (override?.faces > 0) effectiveFaces = override.faces;
			if (override?.quantity) effectiveQuantity = override.quantity;
		}
		return { faces: effectiveFaces, quantity: effectiveQuantity };
	}

	override afterPrepareData(): void {
		if (!this.item.isEmbedded) return;
		if (!this.test()) return;

		const identifier = this.identifier;
		if (!identifier) return;

		const actor = this.item.actor as unknown as ActorWithPools;
		const { faces, quantity } = this.resolveEffectiveConfig();
		const resolvedMax = Math.max(1, Math.round(this.resolveFormula(quantity) ?? 1));

		if (!actor.dicePools) {
			actor.dicePools = {};
		}

		const existing = actor.dicePools[identifier];
		if (existing && this.poolMode === 'resource') {
			// Multiple rules can contribute to the same resource pool (e.g. a base
			// pool plus a player-selected "Additional Combat Die" choice item).
			existing.max += resolvedMax;
		} else {
			actor.dicePools[identifier] = {
				identifier,
				label: this.label || identifier,
				faces,
				max: resolvedMax,
				poolMode: this.poolMode,
			} satisfies DicePoolEntry;
		}
	}

	override async onEncounterEnd(_context: EncounterContext): Promise<void> {
		if (!this.item.isEmbedded) return;
		if (!this.test()) return;
		if (!this.resetOnEncounterEnd) return;
		const update: Record<string, unknown> = {};
		if (this.poolMode === 'individual') {
			foundry.utils.setProperty(update, `flags.nimble.dicePools.${this.identifier}.dice`, []);
		} else {
			foundry.utils.setProperty(update, `flags.nimble.dicePools.${this.identifier}.current`, 0);
		}
		await this.item.actor?.update(update);
	}

	override async onInitiativeRolled(_context: InitiativeRolledContext): Promise<void> {
		if (!this.item.isEmbedded) return;
		if (!this.test()) return;
		if (!this.fillOnInitiative) return;
		const { quantity } = this.resolveEffectiveConfig();
		const max = Math.max(1, Math.round(this.resolveFormula(quantity) ?? 1));
		const update: Record<string, unknown> = {};
		foundry.utils.setProperty(update, `flags.nimble.dicePools.${this.identifier}.current`, max);
		await this.item.actor?.update(update);
	}

	override async onItemActivated(_context: ItemActivatedContext): Promise<void> {
		if (!this.item.isEmbedded) return;
		if (!this.test()) return;
		if (!this.rollOnActivation) return;

		const { faces, quantity } = this.resolveEffectiveConfig();
		const max = Math.max(1, Math.round(this.resolveFormula(quantity) ?? 1));
		const actor = this.item.actor as unknown as Record<string, unknown>;

		if (this.poolMode === 'individual') {
			const currentDice =
				((actor as any).flags?.nimble?.dicePools?.[this.identifier]?.dice as number[]) ?? [];
			if (currentDice.length >= max) return;
			const roll = new Roll(`1d${faces}`);
			await roll.evaluate();
			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
				flavor: this.label,
			});
			const update: Record<string, unknown> = {};
			foundry.utils.setProperty(update, `flags.nimble.dicePools.${this.identifier}.dice`, [
				...currentDice,
				roll.total ?? 1,
			]);
			await this.item.actor?.update(update);
			return;
		}

		const roll = new Roll(`1d${faces}`);
		await roll.evaluate();
		await roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
			flavor: this.label,
		});

		const current =
			((actor as any).flags?.nimble?.dicePools?.[this.identifier]?.current as number) ?? 0;
		const update: Record<string, unknown> = {};

		if (this.poolMode === 'resource') {
			foundry.utils.setProperty(
				update,
				`flags.nimble.dicePools.${this.identifier}.current`,
				Math.min(max, current + 1),
			);
		} else if (this.poolMode === 'accumulate') {
			foundry.utils.setProperty(
				update,
				`flags.nimble.dicePools.${this.identifier}.current`,
				current + (roll.total ?? 0),
			);
		}

		await this.item.actor?.update(update);
	}
}

export { DicePoolRule };
