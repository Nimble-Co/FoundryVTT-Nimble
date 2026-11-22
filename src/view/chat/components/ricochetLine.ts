import type { Ricochet } from '../../../models/rules/ricochet.js';
import localize from '#utils/localize.js';

interface RicochetCard {
	ricochet(): Ricochet | null;
	ricochetRecord: { targetUuid?: string; applied?: boolean };
	ricochetDamage(tokenUuid: string): number | null;
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
	disabled: boolean;
}

export interface RicochetLine {
	text: string;
	action: RicochetAction | null;
	note: string;
}

function applyAction(card: RicochetCard, targetUuid: string, name: string): RicochetAction {
	const amount = card.ricochetDamage(targetUuid) ?? 0;
	return {
		kind: 'apply',
		targetUuid,
		label: localize('NIMBLE.chat.ricochet.apply', { amount: String(amount), name }),
		disabled: false,
	};
}

/** The line a ricochet puts on a hit card, as the viewer sees it, or null. */
export function ricochetLineOf(card: RicochetCard, viewer: RicochetViewer): RicochetLine | null {
	const ricochet = card.ricochet();
	if (!ricochet) return null;
	const text =
		ricochet.reach > 0
			? localize('NIMBLE.chat.ricochet.line', {
					source: ricochet.source,
					reach: String(ricochet.reach),
				})
			: localize('NIMBLE.chat.ricochet.lineAnyReach', { source: ricochet.source });
	const { targetUuid, applied } = card.ricochetRecord;

	if (targetUuid) {
		const name = viewer.names(targetUuid);
		if (applied)
			return { text, action: null, note: localize('NIMBLE.chat.ricochet.applied', { name }) };
		if (viewer.isGM) return { text, action: applyAction(card, targetUuid, name), note: '' };
		return { text, action: null, note: localize('NIMBLE.chat.ricochet.waitsForGm', { name }) };
	}

	if (!viewer.isGM && !card.isOwner) return { text, action: null, note: '' };
	const onCard = new Set(card.system.targets ?? []);
	const other = viewer.targets.find((token) => !onCard.has(token.uuid));
	if (!other) {
		return {
			text,
			action: {
				kind: viewer.isGM ? 'apply' : 'pick',
				targetUuid: '',
				label: localize('NIMBLE.chat.ricochet.noTarget'),
				disabled: true,
			},
			note: '',
		};
	}
	const name = other.name || viewer.names(other.uuid);
	if (viewer.isGM) return { text, action: applyAction(card, other.uuid, name), note: '' };
	return {
		text,
		action: {
			kind: 'pick',
			targetUuid: other.uuid,
			label: localize('NIMBLE.chat.ricochet.pick', { name }),
			disabled: false,
		},
		note: '',
	};
}
