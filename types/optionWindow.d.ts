/** The options an `optionWindow` rule opens its window with. */
export type OptionSet = 'control';

/** An option of the Control Table. */
export type ControlOption = 'iInsist' | 'elementalAffliction' | 'no' | 'loseControl';

/** A condition that Elemental Affliction gives. */
export type ControlAffliction = 'charged' | 'smoldering' | 'slowed';

/** What the player chose in the Demand Control window. */
export interface ControlChoice {
	option: ControlOption;
	cantripId?: string | null;
	creatureUuid?: string | null;
	protectedUuid?: string | null;
	condition?: ControlAffliction;
	twice?: boolean;
	asReaction?: boolean;
}
