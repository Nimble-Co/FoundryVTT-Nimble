import { docLink, type LinkedPart, linkedParts, partsText } from '#utils/documents/docLink.ts';
import localize from '#utils/localize.js';
import type { Ricochet } from '../../../models/rules/ricochet.js';

interface RicochetCard {
	cardRicochet: {
		ricochet(): Ricochet | null;
		record: { targetUuid?: string; applied?: boolean; amount?: number };
		damage(tokenUuid: string): number | null;
	};
	system: { targets?: string[] };
	isOwner?: boolean;
}

interface RicochetViewer {
	/** The tokens the viewer targets, in the order they targeted them. */
	targets: ReadonlyArray<{ uuid: string; name?: string | null }>;
	isGM: boolean;
	/** The name of a token, by its uuid. */
	names: (tokenUuid: string) => string;
}

interface RicochetAction {
	/** The GM applies the damage; a player picks the creature for the GM. */
	kind: 'apply' | 'pick';
	targetUuid: string;
	label: string;
}

export interface RicochetLine {
	/** The line, with the feature and the weapon as links. */
	parts: LinkedPart[];
	/** The plain text twin of `parts`. */
	text: string;
	action: RicochetAction | null;
	/** What happened, or what to do next, as plain text. */
	note: string;
}

function applyAction(card: RicochetCard, targetUuid: string, name: string): RicochetAction {
	const amount = card.cardRicochet.damage(targetUuid) ?? 0;
	return {
		kind: 'apply',
		targetUuid,
		label: localize('NIMBLE.chat.ricochet.apply', { amount: String(amount), name }),
	};
}

/** The line a ricochet puts on a hit card, as the viewer sees it, or null. */
export function ricochetLineOf(card: RicochetCard, viewer: RicochetViewer): RicochetLine | null {
	const ricochet = card.cardRicochet.ricochet();
	if (!ricochet) return null;
	const reach = String(ricochet.reach);
	const source = docLink(ricochet.source, ricochet.sourceUuid);
	const weapon = ricochet.thrownWeapon ? docLink(ricochet.thrownWeapon, ricochet.weaponUuid) : null;
	const key =
		ricochet.reach > 0
			? weapon
				? 'NIMBLE.chat.ricochet.lineThrown'
				: 'NIMBLE.chat.ricochet.line'
			: weapon
				? 'NIMBLE.chat.ricochet.lineThrownAnyReach'
				: 'NIMBLE.chat.ricochet.lineAnyReach';
	const parts = linkedParts(key, { source, weapon, reach });
	const said = { parts, text: partsText(parts) };
	const { targetUuid, applied, amount } = card.cardRicochet.record;

	if (targetUuid) {
		const name = viewer.names(targetUuid);
		if (applied) {
			const note = localize('NIMBLE.chat.ricochet.took', { name, amount: String(amount ?? 0) });
			return { ...said, action: null, note };
		}
		if (viewer.isGM) return { ...said, action: applyAction(card, targetUuid, name), note: '' };
		return {
			...said,
			action: null,
			note: localize('NIMBLE.chat.ricochet.waitsForGm', { name }),
		};
	}

	if (!viewer.isGM && !card.isOwner) return { ...said, action: null, note: '' };
	const onCard = new Set(card.system.targets ?? []);
	const other = viewer.targets.find((token) => !onCard.has(token.uuid));
	if (!other) {
		return { ...said, action: null, note: localize('NIMBLE.chat.ricochet.noTarget') };
	}
	const name = other.name || viewer.names(other.uuid);
	if (viewer.isGM) return { ...said, action: applyAction(card, other.uuid, name), note: '' };
	return {
		...said,
		action: {
			kind: 'pick',
			targetUuid: other.uuid,
			label: localize('NIMBLE.chat.ricochet.pick', { name }),
		},
		note: '',
	};
}
