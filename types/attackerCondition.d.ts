/** A condition the GM puts on the attacker of a Defended attack. */
export interface AttackerCondition {
	condition: string;
	/** It ends at the start of the attacker's next turn. */
	endsOnAttackerTurn: boolean;
}
