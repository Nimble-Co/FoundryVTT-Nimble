/** One reroll the icon can make, with the same words as the card buttons. */
export interface RollRerollChoice {
	id: string;
	label: string;
	/** Empty when the reroll costs nothing the card knows about. */
	cost: string;
}

export interface RollRerollButtonProps {
	choices: RollRerollChoice[];
	disabled?: boolean;
	onchoose: (id: string) => void;
}
