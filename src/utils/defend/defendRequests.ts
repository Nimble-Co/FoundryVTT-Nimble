import { SYSTEM_ID } from '#system';
import applyConditionToActor from '../actor/applyConditionToActor.js';
import { queueReactionWrite } from '../chat/reactionWriteQueue.js';
import { buildCombatantActionDeltaUpdate } from '../combat/requestCombatantActionDelta.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import {
	getHeroicReactionAvailabilityUpdate,
	HEROIC_REACTIONS,
	type HeroicReactionKey,
} from '../incomingReactions/heroicActions.js';
import localize from '../localize.js';
import { refundRerollCost } from '../reroll/rerollCost.js';
import {
	cardTakesDefends,
	type DefendOptionUse,
	type DefendRecord,
	damageAppliedTo,
	defendsOf,
} from './defendRecords.js';
import {
	EXTRA_DEFEND_FLAG,
	roundMarkNow,
	WHOLE_ROUND_DEFEND_FLAG,
	type WholeRoundDefend,
} from './defendRound.js';

const DEFEND_SOCKET_NAME = `system.${SYSTEM_ID}`;
const DEFEND_REQUEST_TYPE = 'defendRequest';
const DEFEND_REJECTED_TYPE = 'defendRejected';
const DEFEND_ALLY_USE_TYPE = 'defendAllyUse';

export type DefendRequest = Omit<DefendRecord, 'id' | 'armorApplies' | 'userId'> & {
	messageId: string;
	/** The Defend covers every attack on the hero until their own turn begins. */
	wholeRound: boolean;
};

interface DefendRequestMessage extends DefendRequest {
	type: typeof DEFEND_REQUEST_TYPE;
	userId: string;
}

/** An ally's option used on a hero's Defend (a reaction when an ally Defends). */
export interface DefendAllyUse {
	messageId: string;
	defendId: string;
	use: DefendOptionUse;
	reminder: string;
}

interface DefendAllyUseMessage extends DefendAllyUse {
	type: typeof DEFEND_ALLY_USE_TYPE;
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
		actionsSpent: request.actionsSpent,
		reactionKeys: request.reactionKeys,
		outcome: request.outcome,
		armorBonus: Math.max(0, Math.floor(request.armorBonus)),
		options: request.options,
		reminders: request.reminders,
		attackerConditions: request.attackerConditions,
		conditionsEndOnAttackerTurn: request.conditionsEndOnAttackerTurn,
		way: request.way,
	};
	await card.update({
		'system.defends': [...defendsOf(card.system), record],
	} as Record<string, unknown>);
	await conditionAttacker(card, record);
	await setRoundMarks(record, request);
	return null;
}

async function setRoundMarks(record: DefendRecord, request: DefendRequest): Promise<void> {
	const mark = roundMarkNow();
	const actor = fromUuidSync(record.actorUuid) as Actor.Implementation | null;
	if (!mark || !actor) return;
	if (record.way === 'extra') await actor.setFlag(SYSTEM_ID, EXTRA_DEFEND_FLAG, mark);
	if (!request.wholeRound) return;
	const whole: WholeRoundDefend = {
		...mark,
		label: record.label,
		armorBonus: record.armorBonus,
		outcome: record.outcome,
		messageId: request.messageId,
		recordId: record.id,
	};
	await actor.setFlag(SYSTEM_ID, WHOLE_ROUND_DEFEND_FLAG, whole);
}

async function conditionAttacker(card: DefendCard, record: DefendRecord): Promise<void> {
	if (record.attackerConditions.length < 1) return;
	const attacker = (card.constructor as typeof ChatMessage).getSpeakerActor(card.speaker);
	const source = fromUuidSync(record.actorUuid) as Actor.Implementation | null;
	const start = attackerTurnStart(card);
	for (const condition of record.attackerConditions) {
		const endsOnTheirTurn = record.conditionsEndOnAttackerTurn.includes(condition);
		await applyConditionToActor(attacker as never, condition, {
			sourceActor: (source ?? undefined) as never,
			...(endsOnTheirTurn ? { duration: { rounds: 1 }, ...(start ? { start } : {}) } : {}),
		});
	}
}

/**
 * Where a one-round duration counts from so it ends as the attacker's next turn
 * starts: their combatant, and a round back when their turn is still to come.
 */
function attackerTurnStart(card: DefendCard): { combatant: string; round: number } | null {
	const combat = game.combat;
	if (!combat?.started) return null;
	const token = card.speaker?.token;
	const combatant = token
		? combat.combatants.find((each) => each.tokenId === token)
		: combat.combatants.find((each) => each.actorId === card.speaker?.actor);
	if (!combatant?.id) return null;
	const index = combat.turns.findIndex((each) => each.id === combatant.id);
	const round = Number(combat.round) || 0;
	return { combatant: combatant.id, round: index > Number(combat.turn) ? round - 1 : round };
}

async function writeAllyUse(request: DefendAllyUse): Promise<boolean> {
	const card = cardOf(request.messageId);
	if (!card) return false;
	const record = defendsOf(card.system).find((entry) => entry.id === request.defendId);
	if (!record || damageAppliedTo(card.system).has(record.tokenUuid)) return false;
	if (
		record.options.some(
			(use) => use.actorUuid === request.use.actorUuid && use.ruleId === request.use.ruleId,
		)
	) {
		return false;
	}
	const defends = defendsOf(card.system).map((entry) =>
		entry.id === record.id
			? {
					...entry,
					options: [...entry.options, request.use],
					reminders: request.reminder ? [...entry.reminders, request.reminder] : entry.reminders,
				}
			: entry,
	);
	await card.update({ 'system.defends': defends } as Record<string, unknown>);
	return true;
}

/**
 * Put an ally's option on a hero's Defend. The cost is paid before; a refused
 * write gives it back.
 */
export async function requestDefendAllyUse(request: DefendAllyUse): Promise<boolean> {
	const userId = game.user?.id;
	if (!userId) return false;
	if (game.user?.isGM) {
		let written = false;
		await queueReactionWrite(request.messageId, async () => {
			written = await writeAllyUse(request);
		});
		if (!written) await refundUses([request.use]);
		return written;
	}
	if (!getPrimaryActiveGmId()) {
		ui.notifications?.warn(localize('NIMBLE.chat.defend.refused.noGm'));
		return false;
	}
	emit({ type: DEFEND_ALLY_USE_TYPE, userId, ...request });
	return true;
}

async function handleAllyUse(payload: DefendAllyUseMessage): Promise<void> {
	if ((game.user?.id ?? null) !== getPrimaryActiveGmId()) return;
	const { type: _type, userId: _userId, ...request } = payload;
	await queueReactionWrite(request.messageId, async () => {
		if (!(await writeAllyUse(request))) await refundUses([request.use]);
	});
}

function emit(payload: DefendRequestMessage | DefendRejectedMessage | DefendAllyUseMessage): void {
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
		const message = payload as Partial<
			DefendRequestMessage | DefendRejectedMessage | DefendAllyUseMessage
		> | null;
		if (message?.type === DEFEND_REQUEST_TYPE) {
			void handleDefendRequest(message as DefendRequestMessage);
		} else if (message?.type === DEFEND_ALLY_USE_TYPE) {
			void handleAllyUse(message as DefendAllyUseMessage);
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
	const { messageId: _messageId, wholeRound: _wholeRound, ...record } = request;
	await refundDefend({ ...record, id: '', armorApplies: true, userId: '' });
}

export async function refundUses(uses: readonly DefendOptionUse[]): Promise<void> {
	for (const use of uses) {
		if (!use.cost || !use.paid) continue;
		const actor = fromUuidSync(use.actorUuid) as Actor.Implementation | null;
		if (actor) await refundRerollCost(actor, use.cost, use.paid);
	}
}

/** Take back the round marks this Defend set on its hero. */
async function clearRoundMarks(record: DefendRecord): Promise<void> {
	const actor = fromUuidSync(record.actorUuid) as Actor.Implementation | null;
	if (!actor) return;
	if (record.way === 'extra') await actor.unsetFlag(SYSTEM_ID, EXTRA_DEFEND_FLAG);
	const whole = actor.getFlag(SYSTEM_ID, WHOLE_ROUND_DEFEND_FLAG) as WholeRoundDefend | undefined;
	if (whole?.recordId === record.id) await actor.unsetFlag(SYSTEM_ID, WHOLE_ROUND_DEFEND_FLAG);
}

async function refundDefend(record: DefendRecord): Promise<void> {
	await refundUses(record.options);
	if (record.id) await clearRoundMarks(record);
	const combat = game.combat;
	const combatant = record.combatantId ? combat?.combatants.get(record.combatantId) : null;
	if (!combat || !combatant) return;
	const keys = record.reactionKeys.filter((key): key is HeroicReactionKey =>
		(HEROIC_REACTIONS as readonly string[]).includes(key),
	);
	const update: Record<string, unknown> = { _id: combatant.id };
	for (const key of keys) Object.assign(update, getHeroicReactionAvailabilityUpdate(key, true));
	if (record.actionsSpent) {
		Object.assign(
			update,
			buildCombatantActionDeltaUpdate(combatant, {
				currentDelta: record.actionsSpent,
				pendingDelta: 0,
			}),
		);
	}
	await combat.updateEmbeddedDocuments('Combatant', [update]);
}
