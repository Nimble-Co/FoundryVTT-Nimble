import { SYSTEM_ID } from '#system';
import type { WoundNode } from '#types/effectTree.js';
import { giveWounds, type WoundRecord } from '#utils/actor/giveWounds.js';
import { cardTargets, cardUser, type EffectCard } from './applyEffectFromCard.js';

export const APPLIED_WOUNDS_FLAG = 'appliedWounds';

type WoundTarget = Parameters<typeof giveWounds>[0];

/** A creature's key in the card record: its uuid, with no dots, so two tokens of one actor differ. */
function recordKey(actor: { uuid: string }): string {
	return actor.uuid.replaceAll('.', '_');
}

/** What the Wound step of the card did, by creature. */
export function appliedWounds(
	card: EffectCard,
	nodeId: string,
): Record<string, WoundRecord> | undefined {
	const flags = (card.flags?.[SYSTEM_ID] ?? {}) as {
		[APPLIED_WOUNDS_FLAG]?: Record<string, Record<string, WoundRecord>>;
	};
	return flags[APPLIED_WOUNDS_FLAG]?.[nodeId];
}

/** Gives each creature the Wounds and records on the card what it did, one key per creature. */
export async function giveWoundsOnCard(
	card: EffectCard,
	nodeId: string,
	recipients: readonly WoundTarget[],
	amount: number,
): Promise<void> {
	const results = await Promise.allSettled(recipients.map((actor) => giveWounds(actor, amount)));
	const changes: Record<string, WoundRecord> = {};
	results.forEach((result, index) => {
		if (result.status === 'rejected') console.error(result.reason);
		else if (result.value) {
			const key = recordKey(recipients[index] as WoundTarget);
			changes[`flags.${SYSTEM_ID}.${APPLIED_WOUNDS_FLAG}.${nodeId}.${key}`] = result.value;
		}
	});
	if (Object.keys(changes).length > 0) await card.update(changes);
}

/** The step's Wounds go to the card's targets, or to its user. */
export async function giveWoundsFromCard(card: EffectCard, node: WoundNode): Promise<void> {
	const user = cardUser(card);
	const recipients = node.recipient === 'self' ? (user ? [user] : []) : cardTargets(card);
	await giveWoundsOnCard(card, node.id, recipients as unknown as WoundTarget[], node.amount);
}
