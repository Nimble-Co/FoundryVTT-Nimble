import type { ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const RESOURCE_COST_KINDS = ['mana', 'hp', 'tempHp', 'wounds'] as const;
const RESOURCE_COST_SPEND_MODES = ['fixed'] as const;

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
			}),
		),
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

	/** A number or a formula. */
	declare amount: string;

	static override defineSchema(): ResourceCostRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** The cost of one use, for the cost ledger, with its formula read now. */
	get resourceCost(): ResourceCost {
		const amount = Number(this.resolveFormula(String(this.amount ?? '').trim()) ?? 0);
		return {
			kind: this.kind,
			amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
			spend: { mode: 'fixed' },
			beyond: 'notAllowed',
			source: this.parentItem?.name ?? '',
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['kind', '"mana" | "hp" | "tempHp" | "wounds"'],
				['spendMode', '"fixed"'],
				['amount', 'string'],
			]),
		);
	}
}

export { ResourceCostRule };
