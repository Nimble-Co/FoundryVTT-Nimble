import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

interface DamageReductionEntry {
	/** Resolved numeric value, always > 0; 0 for `half` entries */
	value: number;
	/** Damage types the reduction applies to; empty = all damage types */
	damageTypes: string[];
	/** `flat` subtracts `value`; `half` halves the damage instead (resistance) */
	mode?: 'flat' | 'half';
	/** Rule label, surfaced in the chat card's damage-modifier breakdown */
	label?: string;
}

function schema() {
	const { fields } = foundry.data;

	return {
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'flat',
			choices: ['flat', 'half'],
			label: 'NIMBLE.rules.damageReduction.mode.label',
			hint: 'NIMBLE.rules.damageReduction.mode.hint',
		}),
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
				showWhen: (data: Record<string, unknown>) => data.mode !== 'half',
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

	declare mode: 'flat' | 'half';
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
				['mode', 'string'],
				['value', 'string'],
				['damageTypes', 'string[]'],
			]),
		);
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		if (this.mode === 'half') {
			this.pushToActorSystemArray<DamageReductionEntry>('damageReductions', {
				value: 0,
				damageTypes: [...this.damageTypes],
				mode: 'half',
				label: this.label || item.name,
			});
			return;
		}

		if (this.isDiceExpression(this.value)) {
			console.warn(
				`Nimble | damageReduction rule "${this.label}" on "${item.name}" has a dice-expression value ("${this.value}"); only deterministic formulas are supported. Skipping.`,
			);
			return;
		}

		const resolvedValue = this.resolveFormula(this.value);
		if (resolvedValue === null || resolvedValue <= 0) return;

		this.pushToActorSystemArray<DamageReductionEntry>('damageReductions', {
			value: resolvedValue,
			damageTypes: [...this.damageTypes],
			label: this.label || item.name,
		});
	}
}

export { DamageReductionRule, type DamageReductionEntry };
