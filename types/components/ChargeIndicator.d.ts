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
	pools: ChargeIndicatorPoolState[];
	actor: NimbleCharacter;
	itemId: string;
}
