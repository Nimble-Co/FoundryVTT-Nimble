import localize from '#utils/localize.js';

/** A data value of a free use line: plain text, or a lang key and its data that each reader localizes. */
export type FreeUseReasonValue = string | { key: string; data?: Record<string, string> };

/** The "For free" line of a card, stored as a lang key and its data. */
export interface FreeUseReason {
	key: string;
	data?: Record<string, FreeUseReasonValue>;
}

function isReason(value: unknown): value is FreeUseReason {
	return !!value && typeof value === 'object' && typeof (value as FreeUseReason).key === 'string';
}

function valueText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (isReason(value)) return freeUseReasonText(value);
	return '';
}

/** The line in the language of this client. Text from older cards shows as it is. */
export function freeUseReasonText(reason: unknown): string {
	if (typeof reason === 'string') return reason;
	if (!isReason(reason) || !reason.key) return '';
	const data = Object.fromEntries(
		Object.entries(reason.data ?? {}).map(([name, value]) => [name, valueText(value)]),
	);
	return localize(reason.key, data);
}
