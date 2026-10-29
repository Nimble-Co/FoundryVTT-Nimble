import type { PoolKind } from '#view/actorSheets/parts/types.ts';

export interface DicePoolProps {
	label: string;
	/** Font Awesome class */
	icon?: string;
	kind?: PoolKind;
	die?: number;
	/** the face of each die in the pool */
	faces?: number[];
	max?: number;
	onremove?: () => void;
	onadd?: () => void;
	/** card (default) or rail (character sheet rail) */
	variant?: 'card' | 'rail';
	/** rail: the note after the label; default "d{die}" */
	sub?: string;
	/** you get the dice when you roll Initiative: the pool does nothing until then */
	idle?: boolean;
	/** edit mode: the steppers fade and ignore the pointer */
	rest?: boolean;
	tooltip?: string;
}
