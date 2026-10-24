/**
 * Where on the card the prompts render. `roll` is inside the roll section:
 * the buttons that change the roll and the last reroll. `options` is after
 * Apply Damage: every other card button.
 */
export type IncomingReactionPlace = 'roll' | 'options';

export interface IncomingReactionPromptsProps {
	place: IncomingReactionPlace;
}
