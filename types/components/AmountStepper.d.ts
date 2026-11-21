export interface AmountStepperProps {
	label: string;
	value: number;
	minimum: number;
	limit: number;
	/** The number after the slash, when it is not the limit. */
	shown?: number;
	words: { decrement: string; increment: string; amount: string };
	onadjust: (delta: number) => void;
	/** Sets a typed value and gives the value kept, after the clamp. */
	onset: (value: number) => number;
}
