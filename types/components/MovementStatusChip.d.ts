/**
 * What came of one Movement Offer, as the card tells it. `partial` is a Free
 * Move that stopped short by choice; `short` is a push that covered fewer
 * spaces, or a Free Move whose path was cut short. `untracked` is a move no
 * drag settles, because tracking is off or a toggle changed while it waited.
 */
export type MovementStatus =
	| 'open'
	| 'taken'
	| 'partial'
	| 'short'
	| 'unused'
	| 'lapsed'
	| 'untracked'
	| 'conditional';

export interface MovementChip {
	key: string;
	status: MovementStatus;
	icon: string;
	label: string;
	tooltip: string;
}

export interface MovementStatusChipProps {
	chip: MovementChip;
}
