export interface EditBandProps {
	title: string;
	hint: string;
	/** the label of the button that ends edit mode */
	done: string;
	ondone: () => void;
	/** in a tab body with 8 by 12 px padding (the NPC sheet) */
	tight?: boolean;
}
