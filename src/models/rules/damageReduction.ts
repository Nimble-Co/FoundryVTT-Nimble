import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

interface DamageReductionEntry {
	/** Resolved numeric value, always > 0 */
	value: number;
	/** Damage types the reduction applies to; empty = all damage types */
	damageTypes: string[];
}

/** Matches dice notation: 1d6, 2d8, 3d20+5, 1d4+@level, etc. Uses negative lookbehind
 *  to avoid matching identifiers like "id6" while still matching "1d6" and bare "d20". */
const DICE_PATTERN = /(?<![a-zA-Z])d\d+/i;

function schema() {
	const { fields } = foundry.data;

	return {
		// Deterministic formulas only — reductions are applied when the GM clicks
		// Apply Damage, where there is no roll to append dice to.
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.damageReduction.value.label',
				hint: 'NIMBLE.rules.damageReduction.value.hint',
				widget: 'formula',
			}),
		),
		damageTypes: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				blank: false,
				choices: () => Object.keys(CONFIG.NIMBLE.damageTypes),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.damageReduction.damageTypes.label',
				hint: 'NIMBLE.rules.damageReduction.damageTypes.hint',
			},
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'damageReduction' }),
	};
}

declare namespace DamageReductionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActorSystem {
	system: {
		damageReductions?: DamageReductionEntry[];
	};
}

/**
 * Rule that reduces incoming damage by a flat or formula-based amount,
 * optionally scoped to specific damage types.
 *
 * Reductions are accumulated in an array on the actor during data prep and
 * consumed when damage is applied to the actor (after outcome/armor halving,
 * before temp HP absorption). Multiple matching reductions sum.
 */
class DamageReductionRule extends NimbleBaseRule<DamageReductionRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.damageReduction.description';

	declare value: string;
	declare damageTypes: string[];

	static override defineSchema(): DamageReductionRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['damageTypes', 'string[]'],
			]),
		);
	}

	/**
	 * Push a reduction entry to the actor's damageReductions array,
	 * initializing the array if it doesn't exist.
	 */
	private pushReduction(entry: DamageReductionEntry): void {
		const { actor } = this.item;
		const actorSystem = actor as object as ActorSystem;
		if (!actorSystem.system.damageReductions) {
			foundry.utils.setProperty(actor.system, 'damageReductions', []);
		}
		actorSystem.system.damageReductions!.push(entry);
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		if (DICE_PATTERN.test(this.value)) {
			console.warn(
				`Nimble | damageReduction rule "${this.label}" on "${item.name}" has a dice-expression value ("${this.value}"); only deterministic formulas are supported. Skipping.`,
			);
			return;
		}

		const resolvedValue = this.resolveFormula(this.value);
		if (resolvedValue === null || resolvedValue <= 0) return;

		this.pushReduction({
			value: resolvedValue,
			damageTypes: [...this.damageTypes],
		});
	}
}

export { DamageReductionRule, type DamageReductionEntry };
