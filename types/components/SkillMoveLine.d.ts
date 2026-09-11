import type { OptionSwapSectionState } from '#view/dialogs/components/optionSwap/OptionSwapSection.state.svelte.ts';

export interface SkillMoveLineProps {
	section: OptionSwapSectionState;
	/** The lines this card shows, by their number across the whole offer. */
	moveIndices: number[];
}
