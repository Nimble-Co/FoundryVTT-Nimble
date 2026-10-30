import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import localize from '#utils/localize.js';
import { documentName } from './incomingReactionText.ts';
import { leftOutRerollReason } from './leftOutRerollReason.ts';

/** Lists the GM opened, by message id: a card renders again on every update. */
const openLists = new Set<string>();

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
		return {
			feature: documentName(entry.itemUuid) || entry.label,
			name: documentName(entry.actorUuid),
		};
	}

	function onToggle(event: Event) {
		if (!listKey) return;
		if ((event.currentTarget as HTMLDetailsElement).open) openLists.add(listKey);
		else openLists.delete(listKey);
	}

	function reason(entry: IncomingReactionEntry): string {
		return leftOutRerollReason(entry, {
			allyName: documentName(entry.actorUuid),
			allyDisposition: dispositionOf(entry.tokenUuid),
			rollerDisposition: dispositionOf(rollerTokenUuid(message)),
		});
	}

	async function add(entry: IncomingReactionEntry): Promise<void> {
		if (adding) return;
		adding = true;
		try {
			await message?.addLeftOutReroll(entry.id);
		} catch (error) {
			console.error('Nimble | Failed to add a left-out reroll', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
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
