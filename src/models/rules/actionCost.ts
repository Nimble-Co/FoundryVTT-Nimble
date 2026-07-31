import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type ActionCostMode = 'delta' | 'set';

/** The item types whose activation carries an action cost. */
const ACTION_COST_ITEM_TYPES = ['feature', 'monsterFeature', 'object', 'spell'] as const;

function schema() {
	const { fields } = foundry.data;

	return {
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'delta',
			label: 'NIMBLE.rules.actionCost.mode.label',
			hint: 'NIMBLE.rules.actionCost.mode.hint',
			choices: ['delta', 'set'],
		}),
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.actionCost.value.label',
				hint: 'NIMBLE.rules.actionCost.value.hint',
				widget: 'formula',
			}),
		),
		itemTypes: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				blank: false,
				choices: [...ACTION_COST_ITEM_TYPES],
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.actionCost.itemTypes.label',
				hint: 'NIMBLE.rules.actionCost.itemTypes.hint',
			},
		),
		itemIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.actionCost.itemIdentifier.label',
			hint: 'NIMBLE.rules.actionCost.itemIdentifier.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'actionCost' }),
	};
}

declare namespace ActionCostRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActionCostTargetItem {
	type?: string;
	system?: {
		identifier?: string;
	};
}

/**
 * A pure cost descriptor: modifies the action cost of activating matching items.
 * Carries no lifecycle hooks — the character's activation flow reads matching
 * rules through `resolveCharacterItemActionCost` when an item is activated.
 *
 * Because the rule lives on the actor but prices individual activations, the
 * `itemTypes` / `itemIdentifier` scoping fields decide which activations it
 * affects. Both empty means every activation with an action cost.
 */
class ActionCostRule extends NimbleBaseRule<ActionCostRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.actionCost.description';

	declare mode: ActionCostMode;

	declare value: string;

	// `itemTypes` is inferred from the schema's `choices` (the closed set of
	// activatable item types); re-declaring it as the wider `string[]` clashes
	// with that type.

	declare itemIdentifier: string;

	static override defineSchema(): ActionCostRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['mode', '"delta" | "set"'],
				['value', 'string'],
				['itemTypes', 'string[]'],
				['itemIdentifier', 'string'],
			]),
		);
	}

	/** True when this rule's scoping matches the activating item. Empty scoping fields match all. */
	matchesItem(item: ActionCostTargetItem | null | undefined): boolean {
		if (!item) return false;
		const itemTypes = this.itemTypes as unknown as string[];
		if (itemTypes.length > 0 && !itemTypes.includes(item.type ?? '')) return false;
		if (this.itemIdentifier !== '' && this.itemIdentifier !== (item.system?.identifier ?? '')) {
			return false;
		}
		return true;
	}

	/** Resolves the configured value against the actor's roll data. */
	resolveValue(): number | null {
		return this.resolveFormula(this.value);
	}
}

export { ActionCostRule };
