import type { RevealRequest } from './sheetUiState.ts';

export interface RevealableSheet {
	reveal(request: RevealRequest): void;
}

/**
 * The new sheets take requests from outside code through `reveal()`. The old sheets have no
 * `reveal`, so their callers keep the old path until the delete PR.
 */
export function asRevealable(sheet: unknown): RevealableSheet | null {
	return typeof (sheet as { reveal?: unknown } | null)?.reveal === 'function'
		? (sheet as RevealableSheet)
		: null;
}
