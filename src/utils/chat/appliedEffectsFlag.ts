import { SYSTEM_ID } from '#system';

/** The card flag that records, for each Apply Effect node, the effects it applied. */
export const APPLIED_EFFECTS_FLAG = 'appliedEffects';

/** The record of the Apply Effect node in the card's flags. */
export function appliedRecord<T = unknown>(
	flags: Record<string, unknown> | undefined,
	nodeId: string,
): T[] | undefined {
	const system = flags?.[SYSTEM_ID] as Record<string, unknown> | undefined;
	return (system?.[APPLIED_EFFECTS_FLAG] as Record<string, T[]> | undefined)?.[nodeId];
}

/** The card's flags with the record of the Apply Effect node set to `record`. */
export function withAppliedRecord(
	flags: Record<string, unknown> | undefined,
	nodeId: string,
	record: readonly unknown[],
): Record<string, unknown> {
	const system = (flags?.[SYSTEM_ID] ?? {}) as Record<string, unknown>;
	const applied = (system[APPLIED_EFFECTS_FLAG] ?? {}) as Record<string, unknown>;
	return {
		...flags,
		[SYSTEM_ID]: { ...system, [APPLIED_EFFECTS_FLAG]: { ...applied, [nodeId]: record } },
	};
}
