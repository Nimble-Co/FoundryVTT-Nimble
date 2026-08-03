import type PoolSpendOfferDialog from '#documents/dialogs/PoolSpendOfferDialog.svelte.js';

export interface PoolSpendOfferDialogProps {
	actor: Actor;
	poolId: string;
	ruleId: string;
	/** Disambiguates the consumer: rule ids are only unique within an item */
	itemId: string | null;
	dialog: PoolSpendOfferDialog;
}
