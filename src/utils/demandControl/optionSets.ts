import type { ControlOption, OptionSet } from '#types/optionWindow.d.ts';

/** The Control Table, the default option set of the option window rules. */
export const CONTROL_OPTION_SET: OptionSet = 'control';

/** The option sets an option window rule can name. */
export const OPTION_SETS: readonly OptionSet[] = [CONTROL_OPTION_SET];

/** The options of each option set, in the order the window shows them. */
export const OPTION_SET_OPTIONS: Record<OptionSet, readonly ControlOption[]> = {
	[CONTROL_OPTION_SET]: ['iInsist', 'elementalAffliction', 'no', 'loseControl'],
};
