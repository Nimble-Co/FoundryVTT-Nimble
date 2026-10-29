export interface ChoiceMenuItem {
	id: string;
	label: string;
	/** Empty when the choice costs nothing the card knows about. */
	cost: string;
	/** The full sentence, for the tooltip and the screen reader. */
	text: string;
}

/** Items under a heading. An empty heading shows no heading. */
export interface ChoiceMenuSection {
	id: string;
	heading: string;
	items: ChoiceMenuItem[];
}

export interface ChoiceMenuProps {
	id: string;
	label: string;
	sections: ChoiceMenuSection[];
	disabled?: boolean;
	/** The button that opened the menu: a click on it is not a click outside. */
	trigger?: HTMLElement;
	class?: string;
	onchoose: (id: string) => void;
	/** `returnFocus` is true when the focus must go back to the trigger. */
	onclose: (returnFocus: boolean) => void;
}
