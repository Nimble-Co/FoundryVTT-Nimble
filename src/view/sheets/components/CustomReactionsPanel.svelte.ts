import type { NimbleCharacter } from '../../../documents/actor/character.js';
import type { NimbleBaseItem } from '../../../documents/item/base.svelte.js';

/** A prepared embedded item always has a non-null `_id`. */
export type ReactionItem = NimbleBaseItem & { _id: string };

/** Activation cost data shared by feature, spell, and object items. */
interface ReactionActivationData {
	cost?: {
		type?: string;
		quantity?: number;
		isReaction?: boolean;
		details?: string;
	};
}

/** Description can be a plain HTML string (features) or a keyed object (spells, objects). */
type ReactionDescription = string | Record<string, string> | null | undefined;

function getActivation(item: Item): ReactionActivationData['cost'] {
	return (item.system as { activation?: ReactionActivationData }).activation?.cost;
}

/** An item is a custom reaction when its activation cost has "Is Reaction" checked. */
export function isCustomReaction(item: Item): boolean {
	return getActivation(item)?.isReaction === true;
}

export function createCustomReactionsPanelState(getActor: () => NimbleCharacter) {
	const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;
	let expandedDescriptions = $state(new Set<string>());

	const reactions = $derived(
		(getActor().reactive.items as unknown as ReactionItem[])
			.filter((item) => isCustomReaction(item as unknown as Item))
			.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
	);

	/**
	 * The action cost label, shown only when the reaction costs more than a single
	 * action (per the issue: "Action cost, if more than one").
	 */
	function getActionCost(item: Item): string | null {
		const cost = getActivation(item);
		if (!cost || cost.type !== 'action') return null;

		const quantity = cost.quantity ?? 1;
		if (quantity <= 1) return null;

		return `${quantity} ${activationCostTypesPlural.action ?? activationCostTypes.action}`;
	}

	/** The free-text reaction trigger configured under Activation > Core. */
	function getReactionTrigger(item: Item): string | null {
		const details = getActivation(item)?.details;
		return details && details.trim().length > 0 ? details : null;
	}

	/** Resolve a display description regardless of the item type's description shape. */
	function getDescription(item: Item): string | null {
		const description = (item.system as { description?: ReactionDescription }).description;
		if (typeof description === 'string') {
			return hasContent(description) ? description : null;
		}
		if (description && typeof description === 'object') {
			const text = description.baseEffect ?? description.public ?? '';
			return hasContent(text) ? text : null;
		}
		return null;
	}

	function hasContent(text: unknown): text is string {
		if (!text || typeof text !== 'string') return false;
		return text.replace(/<[^>]*>/g, '').trim().length > 0;
	}

	function isExpanded(itemId: string): boolean {
		return expandedDescriptions.has(itemId);
	}

	function toggleDescription(itemId: string, event: Event): void {
		event.stopPropagation();
		const next = new Set(expandedDescriptions);
		if (next.has(itemId)) {
			next.delete(itemId);
		} else {
			next.add(itemId);
		}
		expandedDescriptions = next;
	}

	function handleKeydown(event: KeyboardEvent, callback: () => void): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			callback();
		}
	}

	async function activateReaction(itemId: string): Promise<unknown> {
		return getActor().activateItem(itemId);
	}

	return {
		get reactions() {
			return reactions;
		},
		getActionCost,
		getReactionTrigger,
		getDescription,
		isExpanded,
		toggleDescription,
		handleKeydown,
		activateReaction,
	};
}
