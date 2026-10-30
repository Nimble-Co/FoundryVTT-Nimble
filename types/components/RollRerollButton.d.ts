import type { ChoiceMenuSection } from './ChoiceMenu.d.ts';

export interface RollRerollButtonProps {
	/** The rerolls and changes the icon can use, under the heading of each. */
	sections: ChoiceMenuSection[];
	disabled?: boolean;
	onChoose: (id: string) => void;
}
