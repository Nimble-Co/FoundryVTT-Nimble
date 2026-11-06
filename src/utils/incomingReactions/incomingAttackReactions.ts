import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { RerollPick } from '#types/rerollPick.d.ts';
import type { DieRef } from '../../dice/oneDieReroll.js';
import { defineCardOperation } from '../chat/cardOperations.js';
import {
	type IncomingReactionEntry,
	REROLL_KEPT,
	type RerollKept,
} from './incomingReactionEntry.js';

const DAMAGE_BACK_ACTIONS = ['deal', 'double'] as const;
type DamageBackAction = (typeof DAMAGE_BACK_ACTIONS)[number];

/**
 * The dice a player committed in the card-side spend picker. `expectedFaces`
 * is what the picker showed them: the executor re-reads the live pool, so
 * without it a pool that changed mid-dialog would silently spend whichever
 * dice now sit at those indices.
 */
export interface PoolSpendSelection {
	poolId: string;
	faceIndices: number[];
	expectedFaces: number[];
}

function messageOf(messageId: string): NimbleChatMessage | null {
	return (game.messages?.get(messageId) as unknown as NimbleChatMessage | undefined) ?? null;
}

function textFrom(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

/** A face from a socket payload, or null when it is not a whole number above 0. */
function faceFrom(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** A die reference from a socket payload, or null when it is not one. */
function dieRefFrom(value: unknown): DieRef | null {
	const ref = value as Partial<DieRef> | null | undefined;
	const index = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
	return ref && index(ref.term) && index(ref.result)
		? { term: ref.term as number, result: ref.result as number }
		: null;
}

/** Die references from a socket payload, or null when there are none. */
function diceRefsFrom(value: unknown): DieRef[] | null {
	if (!Array.isArray(value)) return null;
	const refs = value.flatMap((each) => dieRefFrom(each) ?? []);
	return refs.length > 0 ? refs : null;
}

function pickFrom(value: unknown): RerollPick {
	const pick = (value ?? {}) as Record<string, unknown>;
	return {
		die: dieRefFrom(pick.die),
		value: faceFrom(pick.value),
		stat: typeof pick.stat === 'string' ? pick.stat : null,
		dice: diceRefsFrom(pick.dice),
	};
}

/**
 * Use a pending offer on an attack card. Routing every kind through the GM
 * narrows `incomingReactions` to a single writing client; serializing the
 * resolvers on that client is the executors' own job.
 */
export const requestIncomingAttackReaction = defineCardOperation<{
	messageId: string;
	entryId: string;
	/** spendPoolForDamage only */
	selection?: PoolSpendSelection;
	/** reroll only: the player confirmed using a heroic reaction already spent */
	forceHeroicReaction?: boolean;
	/** reroll only: the die, dice, face or stat the player picked */
	pick?: RerollPick;
}>({
	type: 'incomingAttackReaction',
	parse: (raw) => {
		const messageId = textFrom(raw.messageId);
		const entryId = textFrom(raw.entryId);
		if (!messageId || !entryId) return null;
		return {
			messageId,
			entryId,
			...(raw.selection ? { selection: raw.selection as PoolSpendSelection } : {}),
			forceHeroicReaction: raw.forceHeroicReaction === true,
			pick: pickFrom(raw.pick),
		};
	},
	run: async ({ messageId, entryId, selection, forceHeroicReaction, pick }, requester) => {
		const message = messageOf(messageId);
		const system = message?.system as { incomingReactions?: IncomingReactionEntry[] } | undefined;
		const entry = system?.incomingReactions?.find((e) => e.id === entryId);
		if (!message || !entry) return;
		const { userId, viaSocket } = requester;
		// The executors revalidate (unused entry, ownership, rule still enabled, and
		// for socket-relayed requests that the userId is not claiming GM identity).
		// A legacy kind has no executor and is ignored.
		if (entry.kind === 'redirectToSelf') {
			await message.resolveRedirectReaction(entryId, userId, viaSocket);
		} else if (entry.kind === 'spendPoolForDamage') {
			if (!selection) return;
			await message.resolveSpendPoolForDamageOffer(entryId, userId, selection, viaSocket);
		} else if (entry.kind === 'reroll') {
			await message.cardRerolls.resolveRerollReaction(
				entryId,
				userId,
				viaSocket,
				forceHeroicReaction === true,
				pick ?? {},
			);
		}
	},
});

/** Keep the new roll or the old one of the reroll that waits on a card. */
export const requestKeepChoice = defineCardOperation<{ messageId: string; choice: RerollKept }>({
	type: 'rerollKeep',
	parse: (raw) => {
		const messageId = textFrom(raw.messageId);
		const choice = REROLL_KEPT.find((kept) => kept === raw.choice);
		return messageId && choice ? { messageId, choice } : null;
	},
	run: async ({ messageId, choice }, { userId, viaSocket }) => {
		await messageOf(messageId)?.cardRerolls.resolveKeepChoice(choice, userId, viaSocket);
	},
});

/** Deal damage given back, or pay a Wound to double it. */
export const requestDamageBack = defineCardOperation<{
	messageId: string;
	recordId: string;
	action: DamageBackAction;
}>({
	type: 'damageBack',
	parse: (raw) => {
		const messageId = textFrom(raw.messageId);
		const recordId = textFrom(raw.recordId);
		const action = DAMAGE_BACK_ACTIONS.find((known) => known === raw.action);
		return messageId && recordId && action ? { messageId, recordId, action } : null;
	},
	run: async ({ messageId, recordId, action }, { userId, viaSocket }) => {
		await messageOf(messageId)?.cardDamageBack.resolve(recordId, action, userId, viaSocket);
	},
});

/** Take a Change a Result line off a card. */
export const requestResultRemoval = defineCardOperation<{ messageId: string; lineId: string }>({
	type: 'resultRemoval',
	parse: (raw) => {
		const messageId = textFrom(raw.messageId);
		const lineId = textFrom(raw.lineId);
		return messageId && lineId ? { messageId, lineId } : null;
	},
	run: async ({ messageId, lineId }, { userId, viaSocket }) => {
		await messageOf(messageId)?.cardRerolls.resolveResultRemoval(lineId, userId, viaSocket);
	},
});
