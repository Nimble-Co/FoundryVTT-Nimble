import type {
	ResourceCost,
	ResourceCostKind,
	UsingBeyondWhatYouHave,
} from '#types/resourceCost.d.ts';
import { RESOURCE_COST_KINDS } from '../../utils/cost/resourceCost.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const RESOURCE_COST_SPEND_MODES = ['fixed', 'variable'] as const;

/** Not Allowed, Allowed, then the consequences a class spell pool offers. */
function beyondChoices(): Record<string, string> {
	const consequences = Object.entries(CONFIG.NIMBLE?.overdraftConsequences ?? {}).filter(
		([key]) => key !== '',
	);
	return {
		notAllowed: 'NIMBLE.rules.resourceCost.beyond.choices.notAllowed',
		allowed: 'NIMBLE.rules.resourceCost.beyond.choices.allowed',
		...Object.fromEntries(consequences),
	};
}

const isVariable = (data: Record<string, unknown>) => data.spendMode === 'variable';

function schema() {
	const { fields } = foundry.data;

	return {
		kind: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'mana',
			label: 'NIMBLE.rules.resourceCost.kind.label',
			hint: 'NIMBLE.rules.resourceCost.kind.hint',
			choices: () =>
				Object.fromEntries(
					RESOURCE_COST_KINDS.map((kind) => [
						kind,
						`NIMBLE.rules.resourceCost.kind.choices.${kind}`,
					]),
				),
		}),
		spendMode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'fixed',
			label: 'NIMBLE.rules.resourceCost.spendMode.label',
			hint: 'NIMBLE.rules.resourceCost.spendMode.hint',
			choices: () =>
				Object.fromEntries(
					RESOURCE_COST_SPEND_MODES.map((mode) => [
						mode,
						`NIMBLE.rules.resourceCost.spendMode.choices.${mode}`,
					]),
				),
		}),
		amount: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.resourceCost.amount.label',
				hint: 'NIMBLE.rules.resourceCost.amount.hint',
				widget: 'formula',
				showWhen: (data: Record<string, unknown>) => !isVariable(data),
			}),
		),
		min: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.resourceCost.min.label',
				hint: 'NIMBLE.rules.resourceCost.min.hint',
				widget: 'formula',
				showWhen: isVariable,
			}),
		),
		max: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.resourceCost.max.label',
				hint: 'NIMBLE.rules.resourceCost.max.hint',
				widget: 'formula',
				showWhen: isVariable,
			}),
		),
		beyond: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'notAllowed',
			label: 'NIMBLE.rules.resourceCost.beyond.label',
			hint: 'NIMBLE.rules.resourceCost.beyond.hint',
			choices: beyondChoices,
		}),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'resourceCost',
		}),
	};
}

declare namespace ResourceCostRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** What one use of its item costs in mana, HP, temp HP or Wounds. */
class ResourceCostRule extends NimbleBaseRule<ResourceCostRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'resource';
	static override description = 'NIMBLE.rules.resourceCost.description';
	static override icon = 'fa-solid fa-hand-holding-droplet';

	declare kind: ResourceCostKind;

	declare spendMode: (typeof RESOURCE_COST_SPEND_MODES)[number];

	/** A number, a formula or a roll such as `1d4`. Fixed mode only. */
	declare amount: string;

	/** The least a variable cost takes, as a formula. */
	declare min: string;

	/** The most a variable cost takes, as a formula. */
	declare max: string;

	/** What a use that needs more than the creature has does. */
	declare beyond: UsingBeyondWhatYouHave;

	static override defineSchema(): ResourceCostRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/**
	 * The cost of one use, for the cost ledger, with its formulas read now. A roll stays as
	 * text, to be rolled when the item is used.
	 */
	get resourceCost(): ResourceCost {
		const cost = {
			kind: this.kind,
			beyond: this.beyond ?? 'notAllowed',
			source: this.parentItem?.name ?? '',
			id: this.id,
		};
		if (this.spendMode === 'variable') {
			const min = this.#amountOf(this.min);
			return {
				...cost,
				amount: min,
				spend: { mode: 'variable', min: String(min), max: String(this.#amountOf(this.max)) },
			};
		}
		const text = String(this.amount ?? '').trim();
		if (this.isDiceExpression(text)) {
			return { ...cost, amount: this.withStacks(text), spend: { mode: 'fixed' } };
		}
		return { ...cost, amount: this.#amountOf(text), spend: { mode: 'fixed' } };
	}

	#amountOf(formula: string): number {
		const amount = Number(this.resolveFormula(String(formula ?? '').trim()) ?? 0);
		return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['kind', '"mana" | "hp" | "tempHp" | "wounds"'],
				['spendMode', '"fixed" | "variable"'],
				['amount', 'string'],
				['min', 'string'],
				['max', 'string'],
				['beyond', '"notAllowed" | "allowed" | "halfMaxHpDamage"'],
			]),
		);
	}
}

export { ResourceCostRule };
