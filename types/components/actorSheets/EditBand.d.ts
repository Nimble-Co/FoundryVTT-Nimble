export interface EditBandProps {
	title: string;
	hint: string;
	/** the label of the button that ends edit mode */
	done: string;
	ondone: () => void;
}
