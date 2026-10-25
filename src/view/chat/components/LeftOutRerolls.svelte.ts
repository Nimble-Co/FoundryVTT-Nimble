import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';
import localize from '#utils/localize.js';
import { leftOutRerollReason } from './leftOutRerollReason.ts';

/** Lists the GM opened, by message id: a card renders again on every update. */
const openLists = new Set<string>();

function nameOf(uuid: string | null | undefined): string {
	if (!uuid) return '';
	return ((fromUuidSync(uuid) as { name?: string } | null)?.name ?? '').trim();
}

function dispositionOf(tokenUuid: string | null | undefined): number | null {
	if (!tokenUuid) return null;
	return (fromUuidSync(tokenUuid) as { disposition?: number } | null)?.disposition ?? null;
}

/** The token of the one who rolled: the card's own, else the speaker's. */
function rollerTokenUuid(message: NimbleChatMessage | undefined): string | null {
	const system = message?.system as { tokenUuid?: string | null } | undefined;
	if (system?.tokenUuid) return system.tokenUuid;
	const speaker = (message as { speaker?: { scene?: string; token?: string } } | undefined)
		?.speaker;
	if (!speaker?.scene || !speaker.token) return null;
	return `Scene.${speaker.scene}.Token.${speaker.token}`;
}

export function createLeftOutRerollsState(message: NimbleChatMessage | undefined) {
	const listKey = message?.id ?? '';
	let adding = $state(false);

	function names(entry: IncomingReactionEntry) {
		return { feature: nameOf(entry.itemUuid) || entry.label, name: nameOf(entry.actorUuid) };
	}

	function onToggle(event: Event) {
		if (!listKey) return;
		if ((event.currentTarget as HTMLDetailsElement).open) openLists.add(listKey);
		else openLists.delete(listKey);
	}

	function reason(entry: IncomingReactionEntry): string {
		return leftOutRerollReason(entry, {
			allyName: nameOf(entry.actorUuid),
			allyDisposition: dispositionOf(entry.tokenUuid),
			rollerDisposition: dispositionOf(rollerTokenUuid(message)),
		});
	}

	async function add(entry: IncomingReactionEntry): Promise<void> {
		if (adding) return;
		adding = true;
		try {
			await message?.addLeftOutReroll(entry.id);
		} finally {
			adding = false;
		}
	}

	return {
		get adding() {
			return adding;
		},
		open: openLists.has(listKey),
		onToggle,
		featureText: (entry: IncomingReactionEntry) =>
			localize('NIMBLE.chat.incomingReactions.leftOut.feature', names(entry)),
		addLabel: (entry: IncomingReactionEntry) =>
			localize('NIMBLE.chat.incomingReactions.leftOut.addLabel', names(entry)),
		reason,
		add,
	};
}
