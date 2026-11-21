export interface AmountStepperProps {
	label: string;
	value: number;
	minimum: number;
	limit: number;
	words: { decrement: string; increment: string; amount: string };
	onadjust: (delta: number) => void;
	/** Sets a typed value and gives the value kept, after the clamp. */
	onset: (value: number) => number;
}
