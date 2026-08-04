import type { NimbleCharacter } from '../../src/documents/actor/character.js';

export interface ChargeIndicatorPoolState {
	id: string;
	label: string;
	current: number;
	max: number;
	icon?: string;
	sourceItemId: string;
	sourceItemName: string;
	recoveries: Array<{
		trigger: string;
		mode: string;
		value: string;
	}>;
}

export interface ChargeIndicatorProps {
	/**
	 * The pools to render. Omit this to let the component resolve the item's own
	 * pools; supply it only where the caller already fetched every pool on the
	 * actor once and is handing each row its slice, which keeps a long list from
	 * re-resolving per row.
	 */
	pools?: ChargeIndicatorPoolState[];
	actor: NimbleCharacter;
	itemId: string;
}
