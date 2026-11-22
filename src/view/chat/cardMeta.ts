import { SYSTEM_ID } from '#system';
import { UNARMED_STRIKE } from '#utils/damage/weaponAttack.js';
import { type DocLink, docLink, type LinkedPart, linkedParts } from '#utils/documents/docLink.ts';
import { shownItemName } from '#utils/documents/shownItemName.js';
import localize from '#utils/localize.js';

const KEY = 'NIMBLE.chat.cardMeta';

/** What a card's meta line reads from the card. */
export interface CardMetaSource {
	system?: {
		activation?: { effects?: readonly { type?: string }[] } | null;
		isCritical?: boolean;
		isMiss?: boolean;
	} | null;
	flags?: Record<string, CardMetaFlags | undefined> | null;
}

interface CardMetaFlags {
	itemUuid?: string | null;
	/** A free attack from a card line. */
	grantedFree?: boolean;
	opportunityAttack?: boolean;
	origin?: { uuid?: string | null } | null;
	weaponUuid?: string | null;
}

type Outcome = 'crit' | 'miss' | 'hit' | 'healing' | 'free';

function outcomeOf(source: CardMetaSource, showsHealing: boolean): Outcome | null {
	const effects = source.system?.activation?.effects ?? [];
	if (effects.some((node) => node.type === 'damage')) {
		if (source.system?.isCritical) return 'crit';
		if (source.system?.isMiss) return 'miss';
		return 'hit';
	}
	if (showsHealing && effects.some((node) => node.type === 'healing')) return 'healing';
	return null;
}

/** A link to another item than the card's own, when it is found. */
function otherItemLink(uuid: string | null | undefined, itemUuid: string | null | undefined) {
	if (!uuid || uuid === itemUuid) return null;
	let item: { name?: string | null; type?: string; system?: unknown } | null;
	try {
		item = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false }) as
			| typeof item
			| null;
	} catch {
		return null;
	}
	const name = shownItemName(item);
	return name ? docLink(name, uuid) : null;
}

function weaponLink(flags: CardMetaFlags | undefined): DocLink | null {
	if (flags?.weaponUuid === UNARMED_STRIKE) {
		return docLink(localize('NIMBLE.ui.heroicActions.unarmedStrike'));
	}
	return otherItemLink(flags?.weaponUuid, flags?.itemUuid);
}

/** What goes in the brackets: the opportunity attack mark first, then the origin feature. */
function bracketParts(flags: CardMetaFlags | undefined): LinkedPart[] | null {
	const origin = otherItemLink(flags?.origin?.uuid, flags?.itemUuid);
	if (!flags?.opportunityAttack) return origin ? [origin] : null;
	return origin
		? linkedParts(`${KEY}.opportunityWithOrigin`, { origin })
		: [localize(`${KEY}.opportunityAttack`)];
}

/**
 * The meta line under a card's title: the outcome of the attack (or Free for a free attack from a
 * card line that has no outcome), the weapon a feature attacked with, and in brackets an
 * opportunity attack and the feature the attack was made through. Null when the card has none of
 * them.
 */
export function cardMeta(
	source: CardMetaSource,
	{ showsHealing = false }: { showsHealing?: boolean } = {},
): LinkedPart[] | null {
	const flags = source.flags?.[SYSTEM_ID];
	const outcome = outcomeOf(source, showsHealing) ?? (flags?.grantedFree ? 'free' : null);
	const weapon = weaponLink(flags);
	const bracket = bracketParts(flags);

	let meta: LinkedPart[] | null = null;
	if (outcome && weapon) {
		meta = linkedParts(`${KEY}.withWeapon`, { outcome: localize(`${KEY}.${outcome}`), weapon });
	} else if (outcome) {
		meta = [localize(`${KEY}.${outcome}`)];
	} else if (weapon) {
		meta = linkedParts(`${KEY}.weaponOnly`, { weapon });
	}
	if (!bracket) return meta;
	return meta
		? linkedParts(`${KEY}.withOrigin`, { meta, origin: bracket })
		: linkedParts(`${KEY}.originOnly`, { origin: bracket });
}
