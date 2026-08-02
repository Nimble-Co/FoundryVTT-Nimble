import localize from './localize.ts';

/**
 * The activation cost types that are rendered as a quantity plus a unit. Every
 * other type (`none`, `special`, `reaction`) carries no number and is labelled
 * by its call site, which decides what extra detail to hang off it.
 */
const QUANTIFIED_COST_TYPES = ['action', 'minute', 'hour'] as const;

type QuantifiedCostType = (typeof QUANTIFIED_COST_TYPES)[number];

export interface ActivationCost {
	type?: string;
	quantity?: number;
}

function isQuantifiedCostType(type: string | undefined): type is QuantifiedCostType {
	return QUANTIFIED_COST_TYPES.includes(type as QuantifiedCostType);
}

/**
 * Renders an activation cost as "1 Action", "2 Actions", "10 Minutes" or "Free".
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
	const type = cost?.type;

	if (!isQuantifiedCostType(type)) return null;

	if (type === 'action' && cost?.quantity === 0) {
		return localize('NIMBLE.activationCosts.free');
	}

	const rawQuantity = Number(cost?.quantity);
	const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
	const unit = quantity > 1 ? activationCostTypesPlural[type] : activationCostTypes[type];

	return `${quantity} ${unit}`;
}
