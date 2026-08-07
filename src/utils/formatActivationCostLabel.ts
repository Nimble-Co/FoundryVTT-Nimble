import localize from './localize.ts';

/**
 * The activation cost types that are rendered as a quantity plus a unit. Every
 * other type (`none`, `special`) carries no number and is labelled by its call
 * site, which decides what extra detail to hang off it.
 */
const QUANTIFIED_COST_TYPES = ['action', 'minute', 'hour'] as const;

type QuantifiedCostType = (typeof QUANTIFIED_COST_TYPES)[number];

export interface ActivationCost {
	type?: string;
	quantity?: number;
	isReaction?: boolean;
}

function isQuantifiedCostType(type: string | undefined): type is QuantifiedCostType {
	return QUANTIFIED_COST_TYPES.includes(type as QuantifiedCostType);
}

/**
 * Whether a cost is paid as a reaction. `isReaction` is the current shape, set
 * alongside an ordinary action cost; `type: 'reaction'` is the legacy shape from
 * before the flag split "what it costs" from "when you pay it", and survives in
 * worlds authored against that model.
 */
function isReactionCost(cost: ActivationCost | null | undefined): boolean {
	if (cost?.type === 'reaction') return true;
	return cost?.isReaction === true && cost.type === 'action';
}

/**
 * Renders an activation cost as "1 Action", "2 Actions", "10 Minutes" or "Free".
 *
 * Reactions read as "Reaction", "Reaction (2 Actions)" or "Free Reaction". A
 * reaction is a single response that costs actions rather than a resource you
 * spend several of, so the count never pluralises the reaction itself, and the
 * action cost is only spelled out when it differs from the default of one
 * (CoreRules-2:438, "Reactions cost 1 action").
 *
 * Returns `null` for costs that carry no quantity, leaving the caller to label
 * them; `PlayerCharacterSpellsTab` appends a tooltip to those, the other sheets
 * print the bare type.
 *
 * A zero-quantity action is the system's free activation. The elapsed-time units
 * have no equivalent — there is no zero minutes — but `min: 0` on the schema is
 * shared by every cost type, so a clamped zero can still reach here through pack
 * JSON or a migration. Those fall back to a single unit rather than rendering a
 * nonsensical "0 Minutes".
 */
export default function formatActivationCostLabel(
	cost: ActivationCost | null | undefined,
): string | null {
	const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;

	if (isReactionCost(cost)) {
		const actionCost = normalizeQuantity(cost?.quantity);

		if (cost?.quantity === 0) return localize('NIMBLE.activationCosts.freeReaction');
		if (actionCost === 1) return localize('NIMBLE.activationCosts.reaction');

		return localize('NIMBLE.activationCosts.reactionWithCost', {
			cost: `${actionCost} ${activationCostTypesPlural.action}`,
		});
	}

	const type = cost?.type;

	if (!isQuantifiedCostType(type)) return null;

	if (type === 'action' && cost?.quantity === 0) {
		return localize('NIMBLE.activationCosts.free');
	}

	const quantity = normalizeQuantity(cost?.quantity);
	const unit = quantity > 1 ? activationCostTypesPlural[type] : activationCostTypes[type];

	return `${quantity} ${unit}`;
}

function normalizeQuantity(quantity: number | undefined): number {
	const parsed = Number(quantity);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
