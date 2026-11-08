import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { RerollHistoryProps } from '#types/components/RerollHistory.d.ts';
import { requestKeepChoice } from '#utils/incomingReactions/incomingAttackReactions.js';
import type { KeepChoiceRoll, RerollKept } from '#utils/incomingReactions/incomingReactionEntry.ts';
import localize from '../../../utils/localize.js';

/** The Keep old / Keep new choice of a reroll that waits for its chooser. */
export function createRerollHistoryState(
	message: NimbleChatMessage | undefined,
	getProps: () => Pick<RerollHistoryProps, 'pendingKeep' | 'held'>,
) {
	const chooser = $derived.by(() => {
		const { pendingKeep } = getProps();
		return pendingKeep
			? ((fromUuidSync(pendingKeep.chooserUuid) ?? null) as Actor.Implementation | null)
			: null;
	});
	const canKeep = $derived(
		!!getProps().pendingKeep && (game.user?.isGM === true || chooser?.isOwner === true),
	);
	const keepHeld = $derived.by(() => {
		const { pendingKeep, held } = getProps();
		return !!pendingKeep && held.has(pendingKeep.entryId);
	});

	function keepLabel(roll: KeepChoiceRoll): string {
		const text = localize('NIMBLE.chat.incomingReactions.keepResult', {
			total: String(roll.total),
		});
		return roll.label ? `${roll.label}: ${text}` : text;
	}

	async function keep(choice: RerollKept): Promise<void> {
		const { pendingKeep, held } = getProps();
		if (!pendingKeep || keepHeld) return;
		held.hold(pendingKeep.entryId);
		try {
			await requestKeepChoice({ messageId: message?.id ?? '', choice });
		} catch (error) {
			held.release(pendingKeep.entryId);
			console.error('Nimble | Failed to keep a reroll result', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		}
	}

	return {
		get chooser() {
			return chooser;
		},
		get canKeep() {
			return canKeep;
		},
		get keepHeld() {
			return keepHeld;
		},
		keepLabel,
		keep,
	};
}
