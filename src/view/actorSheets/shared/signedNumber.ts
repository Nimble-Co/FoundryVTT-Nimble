/** `+3`, `+0` or `−1`, with a true minus sign. */
export function signedNumber(value: number): string {
	return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}
