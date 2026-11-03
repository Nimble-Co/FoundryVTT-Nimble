/** The true minus sign (U+2212), for numbers a reader sees. */
export const TRUE_MINUS = '−';

/** `+3`, `+0` or `−1`, with a true minus sign. */
export function signedNumber(value: number): string {
	return value < 0 ? `${TRUE_MINUS}${Math.abs(value)}` : `+${value}`;
}

/** `+ 3`, `+ 0` or `− 1`: the sign of a term in a sum, with a true minus sign. */
export function spacedSignedNumber(value: number): string {
	return value < 0 ? `${TRUE_MINUS} ${Math.abs(value)}` : `+ ${value}`;
}
