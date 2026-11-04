import { SYSTEM_ID } from '#system';
import { queueReactionWrite } from '../../documents/chatMessage/reactionWriteQueue.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import {
	getHeroicReactionAvailabilityUpdate,
	HEROIC_REACTIONS,
	type HeroicReactionKey,
} from '../incomingReactions/heroicActions.js';
import localize from '../localize.js';
import {
	cardTakesDefends,
	type DefendRecord,
	damageAppliedTo,
	defendsOf,
} from './defendRecords.js';

const DEFEND_SOCKET_NAME = `system.${SYSTEM_ID}`;
const DEFEND_REQUEST_TYPE = 'defendRequest';
const DEFEND_REJECTED_TYPE = 'defendRejected';

export type DefendRequest = Omit<DefendRecord, 'id' | 'armorApplies' | 'userId'> & {
	messageId: string;
};

interface DefendRequestMessage extends DefendRequest {
	type: typeof DEFEND_REQUEST_TYPE;
	userId: string;
}

interface DefendRejectedMessage {
	type: typeof DEFEND_REJECTED_TYPE;
	userId: string;
	reasonKey: string;
}

type DefendCard = ChatMessage.Implementation & {
	system: { targets?: string[]; isMiss?: boolean; defends?: unknown; damageAppliedTo?: unknown };
};

function cardOf(messageId: string): DefendCard | null {
	return (game.messages?.get(messageId) as DefendCard | undefined) ?? null;
}

/** Why the GM refuses this Defend, or null when it can be written. */
export function defendRefusal(card: DefendCard | null, request: DefendRequest): string | null {
	if (!card || !cardTakesDefends(card.system)) return 'NIMBLE.chat.defend.refused.noCard';
	if (!(card.system.targets ?? []).includes(request.tokenUuid)) {
		return 'NIMBLE.chat.defend.refused.notTarget';
	}
	if (damageAppliedTo(card.system).has(request.tokenUuid)) {
		return 'NIMBLE.chat.defend.refused.applied';
	}
	if (defendsOf(card.system).some((record) => record.tokenUuid === request.tokenUuid)) {
		return 'NIMBLE.chat.defend.refused.already';
	}
	return null;
}

async function writeDefend(request: DefendRequest, userId: string): Promise<string | null> {
	const card = cardOf(request.messageId);
	const refusal = defendRefusal(card, request);
	if (refusal || !card) return refusal;

	const record: DefendRecord = {
		id: foundry.utils.randomID(),
		tokenUuid: request.tokenUuid,
		actorUuid: request.actorUuid,
		armor: Math.max(0, Math.floor(request.armor)),
		armorApplies: true,
		label: request.label,
		userId,
		combatantId: request.combatantId,
		previousActions: request.previousActions,
		reactionKeys: request.reactionKeys,
	};
	await card.update({
		'system.defends': [...defendsOf(card.system), record],
	} as Record<string, unknown>);
	return null;
}

function emit(payload: DefendRequestMessage | DefendRejectedMessage): void {
	const socket = game.socket as
		| { emit?: (eventName: string, payload: unknown) => void }
		| undefined;
	socket?.emit?.(DEFEND_SOCKET_NAME, payload);
}

/**
 * Write a Defend to an attack card. A chat message is updatable only by its
 * author or a GM, so a player's request goes to the primary active GM.
 * Returns false when the request could not be sent or was refused here.
 */
export async function requestDefend(request: DefendRequest): Promise<boolean> {
	const userId = game.user?.id;
	if (!userId) return false;

	if (game.user?.isGM) {
		let refusal: string | null = null;
		await queueReactionWrite(request.messageId, async () => {
			refusal = await writeDefend(request, userId);
		});
		if (refusal) {
			ui.notifications?.warn(localize(refusal));
			await refundRefused(refusal, request);
		}
		return !refusal;
	}

	if (!getPrimaryActiveGmId()) {
		ui.notifications?.warn(localize('NIMBLE.chat.defend.refused.noGm'));
		return false;
	}
	emit({ type: DEFEND_REQUEST_TYPE, userId, ...request });
	return true;
}

async function handleDefendRequest(payload: DefendRequestMessage): Promise<void> {
	if ((game.user?.id ?? null) !== getPrimaryActiveGmId()) return;
	const { type: _type, userId, ...request } = payload;
	await queueReactionWrite(request.messageId, async () => {
		const refusal = await writeDefend(request, userId);
		if (!refusal) return;
		await refundRefused(refusal, request);
		emit({ type: DEFEND_REJECTED_TYPE, userId, reasonKey: refusal });
	});
}

let registered = false;

export function registerDefendSocketListener(): void {
	if (registered) return;
	registered = true;
	const socket = game.socket as
		| { on?: (eventName: string, listener: (payload: unknown) => void) => void }
		| undefined;
	socket?.on?.(DEFEND_SOCKET_NAME, (payload) => {
		const message = payload as Partial<DefendRequestMessage | DefendRejectedMessage> | null;
		if (message?.type === DEFEND_REQUEST_TYPE) {
			void handleDefendRequest(message as DefendRequestMessage);
		} else if (message?.type === DEFEND_REJECTED_TYPE && message.userId === game.user?.id) {
			ui.notifications?.warn(localize((message as DefendRejectedMessage).reasonKey));
		}
	});
}

/** GM only: the "Armor applies" toggle of one Defend. */
export async function setDefendArmorApplies(
	messageId: string,
	defendId: string,
	armorApplies: boolean,
): Promise<void> {
	if (!game.user?.isGM) return;
	await queueReactionWrite(messageId, async () => {
		const card = cardOf(messageId);
		if (!card) return;
		const defends = defendsOf(card.system).map((record) =>
			record.id === defendId ? { ...record, armorApplies } : record,
		);
		await card.update({ 'system.defends': defends } as Record<string, unknown>);
	});
}

/** GM only: take a Defend back and give back what it spent. */
export async function undoDefend(messageId: string, defendId: string): Promise<void> {
	if (!game.user?.isGM) return;
	await queueReactionWrite(messageId, async () => {
		const card = cardOf(messageId);
		if (!card) return;
		const record = defendsOf(card.system).find((entry) => entry.id === defendId);
		if (!record || damageAppliedTo(card.system).has(record.tokenUuid)) return;
		await refundDefend(record);
		await card.update({
			'system.defends': defendsOf(card.system).filter((entry) => entry.id !== defendId),
		} as Record<string, unknown>);
	});
}

/** A refused Defend gives back what it spent, unless an earlier Defend of the hero holds it. */
async function refundRefused(refusal: string, request: DefendRequest): Promise<void> {
	if (refusal === 'NIMBLE.chat.defend.refused.already') return;
	await refundDefend({ ...request, id: '', armorApplies: true, userId: '' });
}

async function refundDefend(record: DefendRecord): Promise<void> {
	const combat = game.combat;
	const combatant = record.combatantId ? combat?.combatants.get(record.combatantId) : null;
	if (!combat || !combatant) return;
	const keys = record.reactionKeys.filter((key): key is HeroicReactionKey =>
		(HEROIC_REACTIONS as readonly string[]).includes(key),
	);
	const update: Record<string, unknown> = { _id: combatant.id };
	for (const key of keys) Object.assign(update, getHeroicReactionAvailabilityUpdate(key, true));
	if (record.previousActions !== null) {
		update['system.actions.base.current'] = record.previousActions;
	}
	await combat.updateEmbeddedDocuments('Combatant', [update]);
}
