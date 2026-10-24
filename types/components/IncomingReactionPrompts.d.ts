/**
 * Where on the card the prompts render. `roll` is inside the roll section:
 * the buttons that change the roll and the last reroll. `options` is after
 * Apply Damage: every other card button. A one-line roll splits `roll` in two:
 * `rollButton` is the reroll icon in the roll row, `rollHistory` the reroll
 * lines under it.
 */
export type IncomingReactionPlace = 'roll' | 'rollButton' | 'rollHistory' | 'options';

export interface IncomingReactionPromptsProps {
	place: IncomingReactionPlace;
}
