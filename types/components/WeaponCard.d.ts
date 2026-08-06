export interface WeaponCardToggle {
	enabled: boolean;
	ariaLabel: string;
	onClick: (event: MouseEvent) => void | Promise<void>;
}

import type { NimbleCharacter } from '../../src/documents/actor/character.js';
import type { ChargeIndicatorPoolState } from './ChargeIndicator.js';

export interface WeaponCardProps {
	name: string;
	/** Supply alongside `itemId` to show the item's charge pools on the card. */
	actor?: NimbleCharacter | null;
	/**
	 * The item's charge pools, when the caller already resolved every pool on
	 * the actor once. Omit to let the badge resolve its own.
	 */
	pools?: ChargeIndicatorPoolState[];
	image?: string | null;
	icon?: string;
	damage?: string | null;
	properties?: string[];
	description?: string | null;
	isExpanded?: boolean;
	disabled?: boolean;
	showImage?: boolean;
	itemId?: string | null;
	toggle?: WeaponCardToggle | null;
	onToggleDescription?: ((event: MouseEvent) => void) | null;
	onclick?: () => void;
	ondragstart?: ((event: DragEvent) => void) | null;
}
