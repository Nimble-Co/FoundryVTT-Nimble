import { identifierOf } from '../documents/itemIdentifier.js';

/** The feature that caused an attack: the item that granted it, or the item that is the attack. */
export interface AttackOrigin {
	uuid: string;
	identifier: string;
}

interface OriginItem {
	uuid?: string | null;
	identifier?: string;
	system?: { identifier?: string };
}

/**
 * The origin of an attack with `item`. With `throughUuid`, the attack was made through
 * that item, such as a feature that grants the attack.
 */
export function attackOriginOf(item: OriginItem, throughUuid?: string | null): AttackOrigin {
	if (throughUuid) {
		const through = fromUuidSync(throughUuid as `Item.${string}`) as OriginItem | null;
		return { uuid: throughUuid, identifier: through ? identifierOf(through) : '' };
	}
	return { uuid: item.uuid ?? '', identifier: identifierOf(item) };
}

/**
 * Whether an attack with this origin identifier is in the scope of a rule's
 * "Only attacks made through" field. A blank scope takes every attack.
 */
export function isMadeThrough(
	scope: string | null | undefined,
	origin: string | null | undefined,
): boolean {
	const wanted = (scope ?? '').trim();
	return wanted === '' || wanted === origin;
}

interface RolledOriginOptions {
	origin?: Partial<AttackOrigin> | null;
	/** Rolls made before the origin was recorded. */
	offerSource?: string;
}

/** The origin identifier a rolled attack recorded, if any. */
export function originIdentifierOfRoll(
	options: RolledOriginOptions | null | undefined,
): string | undefined {
	return options?.origin?.identifier || options?.offerSource || undefined;
}
