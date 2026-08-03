import { HEROIC_REACTIONS, type HeroicReactionKey } from '#utils/heroicActions.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type ActionCostMode = 'delta' | 'set';

type ActionCostApplies = 'item' | 'heroicReaction';

/** The item types whose activation carries an action cost. */
const ACTION_COST_ITEM_TYPES = ['feature', 'monsterFeature', 'object', 'spell'] as const;

function schema() {
	const { fields } = foundry.data;

	return {
		applies: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			label: 'NIMBLE.rules.actionCost.applies.label',
			hint: 'NIMBLE.rules.actionCost.applies.hint',
			choices: ['item', 'heroicReaction'],
		}),
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
				showWhen: (data: Record<string, unknown>) => data.applies !== 'heroicReaction',
			} as unknown as never,
		),
		itemIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.actionCost.itemIdentifier.label',
				hint: 'NIMBLE.rules.actionCost.itemIdentifier.hint',
				showWhen: (data: Record<string, unknown>) => data.applies !== 'heroicReaction',
			}),
		),
		reactions: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				blank: false,
				choices: [...HEROIC_REACTIONS],
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.actionCost.reactions.label',
				hint: 'NIMBLE.rules.actionCost.reactions.hint',
				showWhen: (data: Record<string, unknown>) => data.applies === 'heroicReaction',
			} as unknown as never,
		),
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
 * A pure cost descriptor: modifies the action cost of activating matching items
 * or of using heroic reactions, per the `applies` field. Carries no lifecycle
 * hooks — the character's activation flow reads matching rules through
 * `resolveCharacterItemActionCost`, and heroic reaction flows through
 * `resolveHeroicReactionActionCost`.
 *
 * Because the rule lives on the actor but prices individual uses, scoping
 * fields decide which uses it affects: `itemTypes` / `itemIdentifier` for item
 * activations, `reactions` for heroic reactions. Empty scoping fields match
 * every use of the selected kind. Cost is orthogonal to per-round use limits —
 * a reaction made free is still limited to once per round.
 */
class ActionCostRule extends NimbleBaseRule<ActionCostRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.actionCost.description';

	declare applies: ActionCostApplies;

	declare mode: ActionCostMode;

	declare value: string;

	// `itemTypes` and `reactions` are inferred from the schema's `choices`
	// (closed sets); re-declaring them as wider `string[]` clashes with those
	// types.

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
				['applies', '"item" | "heroicReaction"'],
				['mode', '"delta" | "set"'],
				['value', 'string'],
				['itemTypes', 'string[]'],
				['itemIdentifier', 'string'],
				['reactions', 'string[]'],
			]),
		);
	}

	/**
	 * True when this rule prices item activations and its scoping matches the
	 * activating item. Empty scoping fields match all items.
	 */
	matchesItem(item: ActionCostTargetItem | null | undefined): boolean {
		if (this.applies !== 'item') return false;
		if (!item) return false;
		const itemTypes = this.itemTypes as unknown as string[];
		if (itemTypes.length > 0 && !itemTypes.includes(item.type ?? '')) return false;
		if (this.itemIdentifier !== '' && this.itemIdentifier !== (item.system?.identifier ?? '')) {
			return false;
		}
		return true;
	}

	/**
	 * True when this rule prices heroic reactions and its scoping matches the
	 * given reaction. An empty `reactions` list matches every heroic reaction.
	 */
	matchesReaction(reactionKey: HeroicReactionKey): boolean {
		if (this.applies !== 'heroicReaction') return false;
		const reactions = this.reactions as unknown as HeroicReactionKey[];
		return reactions.length === 0 || reactions.includes(reactionKey);
	}

	/** Resolves the configured value against the actor's roll data. */
	resolveValue(): number | null {
		return this.resolveFormula(this.value);
	}
}

export { ActionCostRule };
